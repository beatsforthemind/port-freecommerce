const TAU=Math.PI*2;
const TIMETABLE_PERIOD=720;
// Coordinated against the complete repeating paths, including their holding
// pockets. Independent periods let faster walkers eventually overlap forever.
const TIMETABLE_PHASES=[502.5,679,664.5,393,596.5,81.5,188.5,540,78.5,477.5,498,484,371,194.5,278.5,520.5,699.5,282,356.5,170];
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const turn=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*smooth(t);

/** Rounded, measured pedestrian paths. Construction is the only allocation work. */
function path(points) {
  const unique=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>.0001);
  const segments=[];let length=0,previous=unique[0];
  function line(a,b){const distance=Math.hypot(b[0]-a[0],b[1]-a[1]);if(distance>.0001){segments.push({a,b,start:length,length:distance});length+=distance;}}
  for(let i=1;i<unique.length-1;i++){
    const a=unique[i-1],b=unique[i],c=unique[i+1],before=Math.hypot(b[0]-a[0],b[1]-a[1]),after=Math.hypot(c[0]-b[0],c[1]-b[1]);
    const trim=Math.min(.65,before*.3,after*.3);
    const enter=[b[0]-(b[0]-a[0])*trim/before,b[1]-(b[1]-a[1])*trim/before];
    const exit=[b[0]+(c[0]-b[0])*trim/after,b[1]+(c[1]-b[1])*trim/after];
    line(previous,enter);
    const arc=new Float64Array(17);let px=enter[0],pz=enter[1];
    for(let n=1;n<=16;n++){const t=n/16,u=1-t,x=u*u*enter[0]+2*u*t*b[0]+t*t*exit[0],z=u*u*enter[1]+2*u*t*b[1]+t*t*exit[1];arc[n]=arc[n-1]+Math.hypot(x-px,z-pz);px=x;pz=z;}
    segments.push({a:enter,b:exit,control:b,arc,start:length,length:arc[16]});length+=arc[16];previous=exit;
  }
  line(previous,unique[unique.length-1]);
  return {segments,length};
}

function samplePath(route,distance,out) {
  const d=Math.max(0,Math.min(route.length,distance));
  const s=route.segments.find(segment=>d<=segment.start+segment.length)||route.segments[route.segments.length-1];
  let t=(d-s.start)/s.length,dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1];
  if(s.control){
    const at=d-s.start;let n=1;while(n<16&&s.arc[n]<at)n++;
    t=(n-1+(at-s.arc[n-1])/(s.arc[n]-s.arc[n-1]))/16;
    const u=1-t;out.x=u*u*s.a[0]+2*u*t*s.control[0]+t*t*s.b[0];out.z=u*u*s.a[1]+2*u*t*s.control[1]+t*t*s.b[1];
    dx=u*(s.control[0]-s.a[0])+t*(s.b[0]-s.control[0]);dz=u*(s.control[1]-s.a[1])+t*(s.b[1]-s.control[1]);
  }else{out.x=s.a[0]+dx*t;out.z=s.a[1]+dz*t;}
  out.yaw=Math.atan2(dx,dz);
}

function stop(name,x,z,yaw,wait,activity){return {name,x,z,yaw,wait,activity};}
function compile(index) {
  const slot=Math.floor(index/4),kind=index%4,side=kind===0||kind===2?1:-1;
  const pocket=side*9.95;
  let role,stops;
  if(kind===0){
    role='connecting passenger';
    stops=[stop('Arrivals meeting point',pocket,88-slot*1.8,0,8+slot,'meeting an arrival'),stop('Departure board',25-slot*1.1,-42,Math.PI/2,12+slot*2,'checking departures'),stop('Dock approach',pocket,-122+slot*1.8,Math.PI,16+slot*2,'waiting for a connection')];
  }else if(kind===1){
    role='exchange visitor';
    stops=[stop('Arrivals transfer',pocket,84-slot*1.8,0,7+slot,'waiting for a companion'),stop('Exchange vestibule',-29+slot*1.1,30,-Math.PI/2,18+slot*2,'waiting at the exchange'),stop('North public feed',pocket,-44-slot*1.8,Math.PI/2,11+slot,'checking local notices')];
  }else if(kind===2){
    role='gallery visitor';
    stops=[stop('Arrivals connector',pocket,74-slot*1.8,0,10+slot,'meeting a companion'),stop('Observation vestibule',29-slot*1.1,-20,Math.PI/2,24+slot*2,'reading gallery directions'),stop('North wayfinding',pocket,-84+slot*1.8,-Math.PI/2,12+slot,'checking the route')];
  }else{
    role='station messenger';
    stops=[stop('South transfer point',pocket,56-slot*1.8,Math.PI,10+slot,'waiting for a handover'),stop('South public feed',pocket,34-slot*1.8,Math.PI/2,12+slot,'verifying a destination'),stop('Dock rendezvous',pocket,-118+slot*1.8,Math.PI,20+slot*2,'meeting a dock contact')];
  }
  const speed=.84+(index%5)*.055,stages=[];let duration=0,totalDistance=0;
  for(let i=0;i<stops.length;i++){
    const from=stops[i],to=stops[(i+1)%stops.length];
    // One-way spine: northbound in the inner lane, southbound in the outer.
    const lane=side*(to.z<from.z?5.2:7.7);
    const route=path([[from.x,from.z],[lane,from.z],[lane,to.z],[to.x,to.z]]);
    const ramp=1.2,cruise=route.length/speed-ramp,walk=cruise+ramp*2;
    const begin={},end={};samplePath(route,0,begin);samplePath(route,route.length,end);
    const leg={kind:'walking',start:duration,duration:walk,from,to,route,speed,ramp,cruise,distanceStart:totalDistance,beginYaw:begin.yaw,endYaw:end.yaw,intent:`To ${to.name}`};
    stages.push(leg);duration+=walk;totalDistance+=route.length;
    stages.push({kind:'waiting',start:duration,duration:to.wait,to,leg,distanceStart:totalDistance});duration+=to.wait;
  }
  for(let i=1;i<stages.length;i+=2)stages[i].next=stages[(i+1)%stages.length];
  // Wait for the next contact/connection at a distinct arrivals slot instead of
  // burning timetable slack in another circuit of the pedestrian spine.
  stages[stages.length-1].duration+=TIMETABLE_PERIOD-duration;
  duration=TIMETABLE_PERIOD;
  return {id:`commuter-${index}`,role,stages,duration,totalDistance,offset:TIMETABLE_PHASES[index],cruiseSpeed:speed};
}

/** Fixed schedules remain deterministic offscreen, without teleporting endpoints. */
export function createCommuterBehavior(count=20) {
  const journeys=Array.from({length:count},(_,index)=>compile(index));
  const records=journeys.map(journey=>({id:journey.id,role:journey.role,x:0,z:0,floor:0,yaw:0,speed:0,travelDistance:0,gait:0,state:'waiting',intent:'',goal:null,cruiseSpeed:journey.cruiseSpeed}));
  function sample(index,time,out=records[index]){
    const journey=journeys[index],clock=Math.max(0,time)+journey.offset,cycles=Math.floor(clock/journey.duration),phase=clock-cycles*journey.duration;
    const stage=journey.stages.find(item=>phase<item.start+item.duration)||journey.stages[journey.stages.length-1],t=phase-stage.start;
    out.id=journey.id;out.role=journey.role;out.floor=0;out.cruiseSpeed=journey.cruiseSpeed;out.goal=stage.to;
    if(stage.kind==='walking'){
      let distance,speed;const {ramp,cruise}=stage;
      if(t<ramp){const u=t/ramp;distance=stage.speed*ramp*(u*u*u-.5*u*u*u*u);speed=stage.speed*smooth(u);}
      else if(t<ramp+cruise){distance=stage.speed*(.5*ramp+t-ramp);speed=stage.speed;}
      else{const u=clamp((t-ramp-cruise)/ramp);distance=stage.speed*(.5*ramp+cruise+ramp*(u-u*u*u+.5*u*u*u*u));speed=stage.speed*(1-smooth(u));}
      samplePath(stage.route,distance,out);out.speed=speed;out.state='walking';out.intent=stage.intent;out.travelDistance=cycles*journey.totalDistance+stage.distanceStart+distance;
    }else{
      out.x=stage.to.x;out.z=stage.to.z;out.speed=0;out.state=stage.to.activity;out.intent=stage.to.activity;
      out.yaw=t<1.8?turn(stage.leg.endYaw,stage.to.yaw,t/1.8):t>stage.duration-1.8?turn(stage.to.yaw,stage.next.beginYaw,(t-stage.duration+1.8)/1.8):stage.to.yaw;
      out.travelDistance=cycles*journey.totalDistance+stage.distanceStart;
    }
    out.gait=out.travelDistance*TAU/1.45+index*.83;
    return out;
  }
  return {
    records,
    update(time){for(let i=0;i<count;i++)sample(i,time);return records;},
    sample,
    snapshot(time){return journeys.map((journey,i)=>{const a=sample(i,time,{});return {...a,goal:{name:a.goal.name,x:a.goal.x,z:a.goal.z}};});},
    counts(time){let walking=0,waiting=0;for(let i=0;i<count;i++){if(sample(i,time).state==='walking')walking++;else waiting++;}return {walking,waiting,roles:4,destinations:count*3,timetableSeconds:TIMETABLE_PERIOD,teleportWraps:0};},
    get routes(){return journeys;},
  };
}
