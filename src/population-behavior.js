const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const angleMix=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;

/** Compile once; walking uses bounded scalar sampling, never a frame-time search. */
export function createJourneyPlanner({navigation,clearance=.12}={}) {
  const cache=new Map(),fitCache=new Map(),clearCache=new Map();
  let probes=0,repairs=0,failed=0,fitCacheHits=0,clearCacheHits=0,compiledConnections=0;
  function ground(x,z,reference){return navigation?.heightAt(x,z,reference)??(reference||0);}
  function fits(x,z,reference){
    const key=`${x},${z},${reference}`;
    if(fitCache.has(key)){fitCacheHits++;return fitCache.get(key);}
    probes++;
    const h=ground(x,z,reference);
    if(!Number.isFinite(h))return false;
    if(!navigation)return true;
    const result=navigation.canWalk(x,z,h)&&navigation.canWalk(x+clearance,z,h)&&navigation.canWalk(x-clearance,z,h)
      &&navigation.canWalk(x,z+clearance,h)&&navigation.canWalk(x,z-clearance,h);
    fitCache.set(key,result);return result;
  }
  function locate(point,reference){
    if(fits(point[0],point[1],reference))return[point[0],point[1],ground(point[0],point[1],reference)];
    for(let radius=.4;radius<=2.8;radius+=.4)for(let i=0;i<16;i++){
      const x=point[0]+Math.cos(i*TAU/16)*radius,z=point[1]+Math.sin(i*TAU/16)*radius;
      if(fits(x,z,reference))return[x,z,ground(x,z,reference)];
    }
    return null;
  }
  function clear(a,b){
    const key=`${a.join(',')}:${b.join(',')}`;
    if(clearCache.has(key)){clearCacheHits++;return clearCache.get(key);}
    const result=clearUncached(a,b);clearCache.set(key,result);return result;
  }
  function clearUncached(a,b){
    const distance=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(distance/.4));
    let height=a[2];
    for(let i=0;i<=steps;i++){
      const t=i/steps,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,next=ground(x,z,height);
      if(!Number.isFinite(next)||Math.abs(next-height)>.32||!fits(x,z,next))return false;
      height=next;
    }
    return Math.abs(height-b[2])<.32;
  }
  function detour(a,b){
    // A small local grid is only needed when a new connector meets a kiosk.
    // The authored district streets bypass this work through the clear cache.
    const step=.8,pad=5.6,minX=Math.floor((Math.min(a[0],b[0])-pad)/step)*step,minZ=Math.floor((Math.min(a[1],b[1])-pad)/step)*step;
    const width=Math.ceil((Math.abs(b[0]-a[0])+pad*2)/step)+1,height=Math.ceil((Math.abs(b[1]-a[1])+pad*2)/step)+1;
    if(width*height>14000)return null;
    const key=(x,z)=>z*width+x,gridPoint=(x,z)=>[minX+x*step,minZ+z*step,ground(minX+x*step,minZ+z*step,a[2])];
    const sx=Math.round((a[0]-minX)/step),sz=Math.round((a[1]-minZ)/step),tx=Math.round((b[0]-minX)/step),tz=Math.round((b[1]-minZ)/step);
    const open=[{x:sx,z:sz,g:0,f:Math.hypot(tx-sx,tz-sz)}],cost=new Map([[key(sx,sz),0]]),parent=new Map(),closed=new Set();
    const points=new Map([[key(sx,sz),a]]);let visited=0;
    while(open.length&&visited++<10000){
      let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;
      const current=open[best];open[best]=open[open.length-1];open.pop();const id=key(current.x,current.z);
      if(closed.has(id))continue;closed.add(id);
      const here=points.get(id)||gridPoint(current.x,current.z);
      if(Math.hypot(here[0]-b[0],here[1]-b[1])<step*1.8&&clear(here,b)){
        const path=[b,here];let back=id;
        while(parent.has(back)){back=parent.get(back);path.push(points.get(back));}
        path.reverse();if(path[0]!==a)path.unshift(a);
        // Remove grid zigzags without cutting through static geometry.
        const simple=[path[0]];let i=0;
        while(i<path.length-1){let j=path.length-1;while(j>i+1&&!clear(path[i],path[j]))j--;simple.push(path[j]);i=j;}
        return simple;
      }
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dz)continue;const x=current.x+dx,z=current.z+dz;
        if(x<0||z<0||x>=width||z>=height)continue;const nid=key(x,z);if(closed.has(nid))continue;
        const next=gridPoint(x,z);if(!clear(here,next))continue;
        const g=current.g+Math.hypot(dx,dz);if(g>=(cost.get(nid)??Infinity))continue;
        cost.set(nid,g);parent.set(nid,id);points.set(nid,next);open.push({x,z,g,f:g+Math.hypot(tx-x,tz-z)});
      }
    }
    return null;
  }
  function connect(a,b){
    const id=[...a,...b].map(v=>v.toFixed(3)).join(',');if(cache.has(id))return cache.get(id);
    let result=clear(a,b)?[a,b]:detour(a,b);
    if(result?.length>2)repairs++;if(!result){failed++;result=[a];}
    cache.set(id,result);cache.set([...b,...a].map(v=>v.toFixed(3)).join(','),[...result].reverse());return result;
  }
  function soften(points){
    if(points.length<3)return points;
    const result=[points[0]];
    for(let i=1;i<points.length-1;i++){
      const a=points[i-1],b=points[i],c=points[i+1],ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]);
      if(ab<.02||bc<.02){result.push(b);continue;}
      const radius=Math.min(.8,ab*.2,bc*.2),entry=[b[0]-(b[0]-a[0])/ab*radius,b[1]-(b[1]-a[1])/ab*radius,0],exit=[b[0]+(c[0]-b[0])/bc*radius,b[1]+(c[1]-b[1])/bc*radius,0];
      entry[2]=ground(entry[0],entry[1],b[2]);exit[2]=ground(exit[0],exit[1],b[2]);
      const curve=[entry];
      for(let j=1;j<=5;j++){const t=j/5,u=1-t,x=u*u*entry[0]+2*u*t*b[0]+t*t*exit[0],z=u*u*entry[1]+2*u*t*b[1]+t*t*exit[1];curve.push([x,z,ground(x,z,b[2])]);}
      if(clear(result[result.length-1],entry)&&curve.every((p,j)=>j===0||clear(curve[j-1],p)))result.push(...curve);
      else result.push(b);
    }
    result.push(points[points.length-1]);return result;
  }
  function pathFrom(points,reference){
    const anchored=[];let floor=reference;
    for(const point of points){
      // Follow the floor along the approach before selecting an overlapping
      // deck at the anchor (the promenade shares X/Z with the lower floor).
      if(anchored.length){
        const previous=anchored[anchored.length-1],steps=Math.max(1,Math.ceil(Math.hypot(point[0]-previous[0],point[1]-previous[1])/.75));
        for(let i=1;i<=steps;i++){const t=i/steps,h=ground(previous[0]+(point[0]-previous[0])*t,previous[1]+(point[1]-previous[1])*t,floor);if(Number.isFinite(h)&&(!Number.isFinite(floor)||Math.abs(h-floor)<.32))floor=h;}
      }
      const p=locate(point,floor);if(!p)return null;anchored.push(p);floor=p[2];
    }
    const connected=[anchored[0]];
    for(let i=1;i<anchored.length;i++){const connection=connect(anchored[i-1],anchored[i]);if(connection.length<2)return null;connected.push(...connection.slice(1));}
    const path=soften(connected),segments=[];let distance=0;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<1e-6)continue;
      segments.push({a,b,start:distance,length});distance+=length;
    }
    return{segments,distance,start:anchored[0],end:anchored[anchored.length-1]};
  }
  return {
    compile({id,role,stops,speed=.82,floor,phase=0}){
      const legs=[];let duration=0,totalDistance=0,valid=true,reference=floor;
      for(let i=0;i<stops.length;i++){
        const from=stops[i],to=stops[(i+1)%stops.length];
        const path=pathFrom([from.point,...(from.via||[]),to.point],from.floor??reference);
        if(!path?.distance){valid=false;break;}
        reference=path.end[2];
        const acceleration=Math.min(.95,path.distance/speed*.4),walkDuration=path.distance/speed+acceleration,wait=Math.max(2,to.wait??8);
        legs.push({from,to,path,acceleration,walkDuration,wait,start:duration,distanceStart:totalDistance,beginYaw:averagedYaw(path,0),endYaw:averagedYaw(path,path.distance)});duration+=walkDuration+wait;totalDistance+=path.distance;
      }
      return{id,role,stops,legs,speed,phase,duration,totalDistance,valid};
    },
    finish(){compiledConnections=cache.size;cache.clear();fitCache.clear();clearCache.clear();},
    get stats(){return{clearance,probes,repairedSegments:repairs,failedSegments:failed,cachedConnections:compiledConnections||cache.size,fitCacheHits,clearCacheHits};},
  };
}

function pointAt(path,distance,out){
  const d=clamp(distance,0,path.distance);let lo=0,hi=path.segments.length-1;
  while(lo<hi){const mid=(lo+hi)>>1,s=path.segments[mid];if(d>s.start+s.length)lo=mid+1;else hi=mid;}
  const segment=path.segments[lo],t=clamp((d-segment.start)/segment.length,0,1);
  out.x=segment.a[0]+(segment.b[0]-segment.a[0])*t;out.z=segment.a[1]+(segment.b[1]-segment.a[1])*t;out.floor=segment.a[2]+(segment.b[2]-segment.a[2])*t;
  out.yaw=Math.atan2(segment.b[0]-segment.a[0],segment.b[1]-segment.a[1]);return out;
}

function averagedYaw(path,distance){
  const before={},after={};pointAt(path,distance-.5,before);pointAt(path,distance+.5,after);
  return Math.atan2(after.x-before.x,after.z-before.z);
}

/** Mutates a caller-owned record; no allocations or pathfinding during playback. */
export function sampleJourney(plan,time,out) {
  if(!plan.valid)return out;
  const cycles=Math.floor(time/plan.duration),local=time-cycles*plan.duration;
  let leg=plan.legs[plan.legs.length-1],index=plan.legs.length-1;
  for(let i=0;i<plan.legs.length;i++)if(local<plan.legs[i].start+plan.legs[i].walkDuration+plan.legs[i].wait){leg=plan.legs[i];index=i;break;}
  const t=local-leg.start,walking=t<leg.walkDuration,goal=leg.to;
  let distance=leg.path.distance,speed=0;
  if(walking){
    const a=leg.acceleration,v=plan.speed,remaining=leg.walkDuration-t;
    if(t<a){distance=v*t*t/(2*a);speed=v*t/a;}
    else if(remaining<a){distance=leg.path.distance-v*remaining*remaining/(2*a);speed=v*remaining/a;}
    else{distance=v*(t-a*.5);speed=v;}
  }
  pointAt(leg.path,distance,out);
  const tangent=out.yaw;
  if(walking){
    const ahead=clamp(distance+.5,0,leg.path.distance),behind=clamp(distance-.5,0,leg.path.distance),x=out.x,z=out.z,floor=out.floor;
    pointAt(leg.path,ahead,out);const dx=out.x,dz=out.z;pointAt(leg.path,behind,out);
    out.yaw=Math.atan2(dx-out.x,dz-out.z);out.x=x;out.z=z;out.floor=floor;
  }else{
    const waitTime=t-leg.walkDuration,next=plan.legs[(index+1)%plan.legs.length];
    const facing=Number.isFinite(goal.facing)?goal.facing:leg.endYaw;
    out.yaw=angleMix(leg.endYaw,facing,smooth(waitTime/.85));
    if(waitTime>leg.wait-.85)out.yaw=angleMix(facing,next.beginYaw,smooth((waitTime-leg.wait+.85)/.85));
  }
  out.speed=speed;out.walkWeight=clamp(speed/plan.speed,0,1);out.travelDistance=cycles*plan.totalDistance+leg.distanceStart+distance;
  out.state=walking?'walking':goal.activity||'waiting';out.intent=goal.intent;out.goal=goal;out.localTime=local;out.legIndex=index;
  return out;
}
