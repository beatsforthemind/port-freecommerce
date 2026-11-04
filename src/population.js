import * as THREE from 'three';
import { sectorAt } from './navigation.js';
import {createHumanHeadGeometry,createHumanTorsoGeometry,createHumanLimbGeometry,HUMAN_PALETTE,HUMAN_PROFILE} from './humanoid.js';
import {createJourneyPlanner,sampleJourney} from './population-behavior.js';
import {applyPopulationTimetable} from './population-timetable.js';
import {TRAVEL_PACK_PARTS,travelPackPieceColor} from './travel-gear.js';

/**
 * A cross-section of the port: commuters, adapted travelers, readers, traders,
 * dock staff and small independent service units. Seven instanced draw calls
 * render the entire population; matrix uploads are limited to twenty Hz.
 */
export function createPopulation({districtLayouts = [], promenadeRoutes = [], navigation} = {}) {
  const group = new THREE.Group();
  group.name = 'FreeCommerce / passing lives';
  const actors = [];
  const parts = [];
  const batches = new Map();
  const transform = new THREE.Object3D();
  const combined = new THREE.Matrix4();
  const color = new THREE.Color();
  let seed = 48917;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const cloth = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .9, metalness: .02});
  const skin = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .94, metalness: 0, vertexColors: true});
  const equipment = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .82, metalness: 0});
  const lights = new THREE.MeshBasicMaterial({color: '#ffffff'});
  const types = {
    torso: {geometry: createHumanTorsoGeometry(), material: cloth},
    head: {geometry: createHumanHeadGeometry(), material: skin},
    limb: {geometry: createHumanLimbGeometry(), material: cloth},
    gear: {geometry: new THREE.BoxGeometry(1, 1, 1), material: equipment},
    robe: {geometry: createHumanLimbGeometry(), material: cloth},
    light: {geometry: new THREE.BoxGeometry(1, 1, 1), material: lights},
    bot: {geometry: new THREE.IcosahedronGeometry(1, 0), material: equipment},
  };
  for (const type of Object.keys(types)) batches.set(type, []);
  const coats = HUMAN_PALETTE.coats;
  const faces = HUMAN_PALETTE.skin;
  const boneDirection=new THREE.Vector3(),boneUp=new THREE.Vector3(0,1,0);
  const sectorNumbers={concourse:0,observation:1,market:2,docks:3};
  const sectorIndex=(x,z)=>sectorNumbers[sectorAt(x,z)];
  const planner=createJourneyPlanner({navigation});
  const journeys=[];
  const invalidJourneys=[];
  let travelPacks=0;

  function actor(x, z, options = {}) {
    // Standing visitors belong in public aisles, seated readers in their seats.
    if(navigation&&!options.route&&options.pose!=='seated'&&!navigation.canWalk(x,z,options.floor)) {
      search:for(let radius=.7;radius<=6;radius+=.7)for(let i=0;i<12;i++) {
        const nx=x+Math.cos(i*Math.PI/6)*radius,nz=z+Math.sin(i*Math.PI/6)*radius;
        if(sectorAt(nx,nz)===sectorAt(x,z)&&navigation.canWalk(nx,nz,options.floor)){x=nx;z=nz;break search;}
      }
    }
    const record = {id:`resident-${actors.length}`,x, z, baseX: x, baseZ: z, yaw: options.yaw || 0, scale: options.scale || .89 + random() * .24,
      height: options.height || .94 + random() * .13, phase: random() * Math.PI * 2,
      speed: .43 + random() * .37, ...options, matrix: new THREE.Matrix4(), parts: [],
      sector: sectorIndex(x,z), detailed: true};
    actors.push(record);
    return record;
  }
  function part(a, type, tint, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, motion = '', detail = false) {
    const records = batches.get(type);
    const p = {actor: a, type, tint, x, y, z, sx, sy, sz, rx, ry, rz, motion, index: records.length, matrix: new THREE.Matrix4(),
      color: new THREE.Color(tint),
      detail};
    transform.position.set(x, y, z); transform.rotation.set(rx, ry, rz); transform.scale.set(sx, sy, sz); transform.updateMatrix();
    p.matrix.copy(transform.matrix);
    records.push(p); parts.push(p); a.parts.push(p);
    return p;
  }
  function jointPart(a,tint,from,to,width,depth) {
    const p=part(a,'limb',tint,0,0,0,width,1,depth);
    p.from=from;p.to=to;
    return p;
  }
  function endpointPart(a,tint,joint,parent,width,height,depth,kind) {
    const p=part(a,'gear',tint,0,0,0,width,height,depth);
    p.endpoint=joint;p.parentJoint=parent;p.endpointKind=kind;
    return p;
  }
  function person(a, index) {
    const coat = coats[index % coats.length];
    const face = faces[(index * 3) % faces.length];
    const trousers=HUMAN_PALETTE.trousers[index%HUMAN_PALETTE.trousers.length];
    const seated=a.pose==='seated';
    const workwear=(a.homeSector??a.sector)===3||index%8===0;
    const longCoat=index%4===1&&!seated;
    a.joints=new Float32Array(36);
    a.seatedShift=seated?(a.seatHeight+.075)/(a.scale*a.height)-HUMAN_PROFILE.hipY:0;
    const shift=a.seatedShift;
    const breadth=workwear?1.055:1;
    part(a,'torso',coat,0,HUMAN_PROFILE.torsoY+shift,0,.49*breadth,.55,.29,seated?.06:0);
    part(a,'head',face,0,HUMAN_PROFILE.headY+shift,seated?.032:0,...HUMAN_PROFILE.headScale,seated?.14:0,(index%5-2)*.035);
    // A short exposed neck connects the shaped collar to the jaw. Main heads,
    // necks and endpoint pieces are essential at every accessory LOD.
    part(a,'limb',face,0,1.49+shift,0,.096,.10,.096);
    part(a,'gear',trousers,0,.875+shift,0,.36,.14,.23);
    if(longCoat)for(const side of [-1,1])part(a,'robe',coat,side*.095,.76,0,.17,.37,.265,0,0,side*.025);
    for(const side of [-1,1]) {
      const base=side<0?0:18;
      jointPart(a,trousers,base,base+3,.172,.185);
      jointPart(a,trousers,base+3,base+6,.133,.145);
      endpointPart(a,'#29353a',base+6,base+3,.125,.11,.285,'shoe');
      jointPart(a,coat,base+9,base+12,.145,.158);
      jointPart(a,coat,base+12,base+15,.112,.123);
      endpointPart(a,face,base+15,base+12,.083,.12,.045,'hand');
      if(seated) {
        const knee=part(a,'bot',trousers,0,0,0,.078,.085,.083);knee.endpoint=base+3;knee.endpointKind='hinge';
      }
      if(seated||(a.pose==='talking'&&side<0)) {
        const elbow=part(a,'bot',coat,0,0,0,.07,.073,.07);elbow.endpoint=base+12;elbow.endpointKind='hinge';
      }
    }
    if(seated)part(a,'gear','#7f8b81',0,1.08+shift,.415,.37,.027,.265,-.13);
    else if(index%3===0||index%4===2) {
      travelPacks++;
      for(const piece of TRAVEL_PACK_PARTS){
        const type=piece.type==='box'?'gear':piece.type==='limb'?'robe':'torso';
        const p=part(a,type,travelPackPieceColor(piece,index),piece.x,piece.y,piece.z,piece.sx,piece.sy,piece.sz,piece.rx,piece.ry,piece.rz,'',true);
        p.accessory='travel-pack';p.accessoryPiece=piece.role;
      }
    }
    // A few collars and practical credentials, rather than glowing chest LEDs
    // and identical staring eyes, establish role without caricature.
    if(workwear)part(a,'gear','#424b49',0,1.46,.045,.31,.075,.18,0,0,0,'',true);
    if(index%4===0)part(a,'light','#aaa891',-.105,1.29,.153,.036,.053,.009,0,0,0,'',true);
    if(seated||a.pose==='standing'||a.journey) {
      a.poseCache={valid:false};
      for(const p of a.parts)p.worldMatrix=new THREE.Matrix4();
    }
  }

  function setJoint(j,index,x,y,z){j[index]=x;j[index+1]=y;j[index+2]=z;}
  function posePerson(a,gait,time) {
    const j=a.joints,shift=a.seatedShift;
    const seated=a.pose==='seated';
    for(let limb=0;limb<2;limb++) {
      const side=limb===0?-1:1,base=limb*18;
      const swing=a.route?gait*side:0;
      const thigh=swing*.27;
      const calf=thigh+.035+Math.max(0,swing)*.36;
      const hip=.88+shift;
      setJoint(j,base,side*.105,hip,0);
      let kneeY,kneeZ,ankleY,ankleZ;
      if(seated) {
        ankleZ=.4;
        const horizontalScale=a.scale,verticalScale=a.scale*a.height;
        const offset=a.seatOffset||0,localX=side*.105*horizontalScale;
        const localZ=offset+ankleZ*horizontalScale;
        const worldX=a.x+Math.cos(a.yaw)*localX+Math.sin(a.yaw)*localZ;
        const worldZ=a.z-Math.sin(a.yaw)*localX+Math.cos(a.yaw)*localZ;
        const ground=navigation?.heightAt(worldX,worldZ,a.floor);
        ankleY=(Number.isFinite(ground)?ground-(a.floor||0):0)/verticalScale+.125;
        // Two-link inverse kinematics keeps both anatomical lengths intact.
        // Pick the forward-knee solution while the shoe rests on the real deck.
        const dy=ankleY-hip,dz=ankleZ,distance=Math.hypot(dy,dz);
        const along=(.35*.35-.405*.405+distance*distance)/(2*distance);
        const bend=Math.sqrt(Math.max(0,.35*.35-along*along));
        kneeY=hip+dy/distance*along+dz/distance*bend;
        kneeZ=dz/distance*along-dy/distance*bend;
      } else {
        kneeY=hip-Math.cos(thigh)*.35;kneeZ=-Math.sin(thigh)*.35;
        ankleY=kneeY-Math.cos(calf)*.405;ankleZ=kneeZ-Math.sin(calf)*.405;
      }
      setJoint(j,base+3,side*.105,kneeY,kneeZ);
      setJoint(j,base+6,side*.105,ankleY,ankleZ);
      setJoint(j,base+9,side*.249,1.38+shift,0);
      if(seated) {
        setJoint(j,base+12,side*.24,1.15+shift,.16);
        setJoint(j,base+15,side*.135,1.105+shift,.365);
      } else if(a.pose==='talking'&&side<0) {
        const gesture=Math.sin(time*.7+a.phase)*.045;
        setJoint(j,base+12,-.285,1.105,.08);
        setJoint(j,base+15,-.24,1.22+gesture,.285);
      } else {
        const upper=-swing*.21,lower=upper-.13;
        const elbowY=1.38-Math.cos(upper)*.285;
        const elbowZ=-Math.sin(upper)*.285;
        setJoint(j,base+12,side*.282,elbowY,elbowZ);
        setJoint(j,base+15,side*.269,elbowY-Math.cos(lower)*.26,elbowZ-Math.sin(lower)*.26);
      }
    }
    // The lower foot is the stance foot: settle it on the floor instead of
    // translating the entire person upward twice per step.
    if(!a.route)return 0;
    let correction=.129-Math.min(j[7],j[25]);
    if(navigation&&a.floor>1e-5&&Math.abs(a.floor-2.8)>1e-5&&Math.abs(a.floor-7.625)>1e-5) {
      const sy=a.scale*a.height,c=Math.cos(a.yaw),s=Math.sin(a.yaw);
      for(let limb=0;limb<2;limb++) {
        const i=limb*18+6,pitch=Math.max(0,gait*(limb===0?-1:1))*.07;
        const cp=Math.cos(pitch),sp=Math.sin(pitch);
        for(let corner=0;corner<4;corner++) {
          const x=j[i]+(corner%2?1:-1)*.0625;
          const z=j[i+2]+.07-.055*sp+(corner<2?1:-1)*.1425*cp;
          const y=j[i+1]-.07-.055*cp-(corner<2?1:-1)*.1425*sp;
          const ground=navigation.heightAt(a.x+(c*x+s*z)*a.scale,a.z+(-s*x+c*z)*a.scale,a.floor);
          if(Number.isFinite(ground))correction=Math.max(correction,(ground-a.floor)/sy-y);
        }
      }
    }
    return correction;
  }
  function posePart(a,p,gait) {
    const j=a.joints;
    if(p.from!==undefined) {
      const from=p.from,to=p.to;
      boneDirection.set(j[from]-j[to],j[from+1]-j[to+1],j[from+2]-j[to+2]);
      const length=boneDirection.length();
      transform.position.set((j[from]+j[to])*.5,(j[from+1]+j[to+1])*.5,(j[from+2]+j[to+2])*.5);
      transform.quaternion.setFromUnitVectors(boneUp,boneDirection.multiplyScalar(1/length));
      transform.scale.set(p.sx,length+.035,p.sz);transform.updateMatrix();p.matrix.copy(transform.matrix);
    } else if(p.endpoint!==undefined) {
      const i=p.endpoint,parent=p.parentJoint;
      if(p.endpointKind==='hinge'){
        transform.position.set(j[i],j[i+1],j[i+2]);transform.quaternion.identity();
      } else if(p.endpointKind==='hand') {
        boneDirection.set(j[i]-j[parent],j[i+1]-j[parent+1],j[i+2]-j[parent+2]).normalize();
        transform.position.set(j[i]+boneDirection.x*.0525,j[i+1]+boneDirection.y*.0525,j[i+2]+boneDirection.z*.0525);
        transform.quaternion.setFromUnitVectors(boneUp,boneDirection);
      } else {
        const pitch=a.route?Math.max(0,gait*(i<18?-1:1))*.07:0;
        transform.position.set(j[i],j[i+1]-.07,j[i+2]+.07);transform.rotation.set(pitch,0,0);
      }
      transform.scale.set(p.sx,p.sy,p.sz);transform.updateMatrix();p.matrix.copy(transform.matrix);
    }
  }

  const stop=(point,intent,wait,facing,activity='waiting',via=[])=>({point,intent,wait,facing,activity,via});
  function residentJourney({id,role,stops,speed=.82,floor,phase=.2},options={}) {
    const journey=planner.compile({id,role,stops,speed,floor});
    if(!journey.valid){
      invalidJourneys.push(id);
      return actor(stops[0].point[0],stops[0].point[1],{...options,role,state:'waiting for clearance',intent:'Waiting for a public route to clear',pose:'standing',speed:0});
    }
    journeys.push(journey);
    const a=actor(journey.legs[0].path.start[0],journey.legs[0].path.start[1],{homeSector:0,...options,route:'journey',journey,role,speed,floor,journeyClock:journey.duration*phase});
    sampleJourney(journey,a.journeyClock,a);a.sector=sectorIndex(a.x,a.z);return a;
  }
  // Arrivals and departures use paired lanes, with unhurried turnaround stops.
  // These retain the established clear lanes between the older commuters.
  for(let i=0;i<10;i++) {
    const family=i%4,side=family<2?1:-1,outer=family%2===1,x=side*(outer?11.1:6.4),back=side*(outer?14.1:8.8),slot=Math.floor(i/4),count=family<2?3:2,homeZ=i===3?95.1:i===5?97.1:77+Math.floor(i/2)*2.7+(family%2)*1.35,gateZ=-108-(family%2)*1.5;
    residentJourney({id:`connection-${i}`,role:'connecting passenger',speed:outer?.94:.86,phase:(slot+.18)/count,stops:[
      stop([side*3,homeZ],'Meeting an arrival',9,0,'meeting',[[x,homeZ],[x,-112],[side*17,-112]]),
      stop([side*17,gateZ],'Checking the gate direction',11,Math.PI,'checking departures',[[back,gateZ],[back,homeZ]]),
    ]},{scale:i%9===0?1.07:.94+random()*.12,height:.97+random()*.05});
  }
  // The pressure locks stay shut: passengers wait beside the real long-haul
  // approach and walk back to arrivals rather than vanishing through a wall.
  for(let i=0;i<6;i++) {
    const side=i%2?1:-1,slot=Math.floor(i/2),x=side*11.1,gateZ=-178-i*2.1,homeZ=91+slot*1.6;
    residentJourney({id:`long-haul-${i}`,role:'long-haul passenger',speed:.94,phase:(i+.43)/6,stops:[
      stop([side*3,homeZ],'Collecting a connection from arrivals',9,0,'checking arrivals',[[x,homeZ],[x,-119],[-2.2,-127],[-2.2,-146],[-2.2,gateZ]]),
      stop([-3.4,gateZ],'Waiting for long-haul boarding clearance',39+slot*7,Math.PI,'waiting for boarding',[[2.6,gateZ],[2.6,-146],[2.6,-127],[side*14.1,-119],[side*14.1,homeZ]]),
    ]});
  }
  for(let i=0;i<4;i++) {
    const slot=i%2,saltZ=24.8+i*1.6,noodleX=-67+i*1.6,homeZ=69+i*1.45;
    residentJourney({id:`market-errand-${i}`,role:'provision shopper',speed:.86,phase:(i+.21)/4,stops:[
      stop([-3,homeZ],'Returning provisions to arrivals',7,0,'checking a shopping list',[[-6.4,homeZ],[-6.4,32],[-28,32],[-36,32],[-40.1,35],[-40.1,saltZ]]),
      stop([-41.3,saltZ],'Browsing Salt + Static produce',14,-Math.PI/2,'browsing',[[-40.1,saltZ],[-41,35],[-56.5,35],[-56.5,26.5],[-71.2,26.5],[-71.2,42],[noodleX,42]]),
      stop([noodleX,41.3],'Ordering a meal at Hot Noodles',22,Math.PI,'ordering food',[[noodleX,42],[-55,42],[-55,36],[-41,36],[-36,34],[-28,34],[-8.8,34],[-8.8,homeZ]]),
    ]});
  }
  for(let i=0;i<4;i++) {
    const slot=i%2,viewZ=[-29,-25,-15,-11][i],homeZ=59+i*1.45;
    residentJourney({id:`gallery-break-${i}`,role:'gallery visitor',speed:.86,phase:(i+.37)/4,stops:[
      stop([3.1,homeZ],'Returning to the concourse after a break',8,0,'checking a connection',[[6.4,homeZ],[6.4,-22],[28,-22],[38,-22],[60,-24],[78,-25],[86,-28]]),
      stop([94,viewZ],'Watching Pelagos and the rings',32+slot*9,Math.PI/2,'watching the planet',[[86,viewZ],[86,-12],[78,-14],[60,-18],[38,-18],[28,-18],[8.8,-18],[8.8,homeZ]]),
    ]});
  }
  for(let i=0;i<2;i++) {
    const side=i?1:-1;
    residentJourney({id:`promenade-break-${i}`,role:'promenade visitor',speed:.785,phase:.23+i*.5,stops:[
      stop([side*3,96],'Returning to arrivals from the promenade',8,0,'checking arrivals',[[side*25.6,96],[side*25.6,56],[side*24,48]]),
      {...stop([side*14,48],'Looking over the interchange',25,Math.PI,'watching the concourse',[[side*24,48],[side*25.6,56],[side*25.6,96],[side*14.1,96]]),floor:7.625},
    ]});
  }
  function pausePocket(points,index,allRoutes,floor) {
    const last=points.length-1,point=points[index],previous=points[index===0?last-1:index-1],next=points[index===last?1:index+1];
    const dx=next[0]-previous[0],dz=next[1]-previous[1],length=Math.hypot(dx,dz)||1;
    function distanceToLine(p,a,b){const x=b[0]-a[0],z=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*z)/(x*x+z*z||1)));return Math.hypot(p[0]-a[0]-x*t,p[1]-a[1]-z*t);}
    for(const offset of[1.25,1.65,2])for(const side of[-1,1]){
      const p=[point[0]-dz/length*offset*side,point[1]+dx/length*offset*side],h=navigation?.heightAt(p[0],p[1],floor)??floor??0;
      if(navigation&&(!navigation.canWalk(p[0],p[1],h)||!navigation.canWalk(p[0]+.12,p[1],h)||!navigation.canWalk(p[0]-.12,p[1],h)||!navigation.canWalk(p[0],p[1]+.12,h)||!navigation.canWalk(p[0],p[1]-.12,h)))continue;
      if(allRoutes.some(path=>path.some((b,i)=>i&&distanceToLine(p,path[i-1],b)<.8)))continue;
      return p;
    }
    return[...point];
  }
  const routeGroups=[{id:'promenade',routes:promenadeRoutes,count:8,floor:7.625,speed:.55},
    ...districtLayouts.map(layout=>({id:layout.id,routes:layout.routes,count:layout.id==='market'?10:6,speed:layout.id==='observation'?.36:.65}))];
  let pathRoutes=0;
  for(const section of routeGroups) {
    const paths=section.routes||[];pathRoutes+=paths.length;
    for(let i=0;i<section.count&&paths.length;i++) {
      if(section.id==='market'){
        const slot=i%5;
        if(i<5){
          const saltZ=24+slot*1.25,partsX=-82.5+slot*1.5;
          residentJourney({id:`market-local-${i}`,role:'local shopper',speed:.86,phase:(slot+.24)/5,stops:[
            stop([-42.5,saltZ],'Comparing produce at Salt + Static',15,-Math.PI/2,'browsing',[[-41.3,saltZ],[-41.3,35],[-56.5,35],[-56.5,26.5],[-72.6,26.5],[-72.6,24.5],[partsX,24.5]]),
            stop([partsX,23.3],'Inspecting equipment at Second Orbit',17,Math.PI,'inspecting equipment',[[partsX,25.5],[-71.2,25.5],[-71.2,42],[-55,42],[-55,36],[-41,36],[-41.3,saltZ]]),
          ]},{homeSector:2});
        }else{
          const noodleX=-67.8+slot*1.6,afterZ=41+slot*1.2;
          residentJourney({id:`market-local-${i}`,role:'local shopper',speed:.86,phase:(slot+.34)/5,stops:[
            stop([noodleX,40.9],'Collecting a meal at Hot Noodles',20,Math.PI,'collecting food',[[noodleX,43],[-85,43],[-85,afterZ]]),
            stop([-86.7,afterZ],'Examining stock at After Hours',16,-Math.PI/2,'examining salvage',[[-85,afterZ],[-85,39],[-86,35],[-94.5,35],[-94.5,33],[-94,26],[-85,26],[-85,42],[-72,42],[noodleX,42]]),
          ]},{homeSector:2});
        }
        continue;
      }
      const original=paths[i%paths.length],points=original.map(p=>[...p]);
      if(Math.hypot(points[0][0]-points[points.length-1][0],points[0][1]-points[points.length-1][1])>.1)points.push([...points[0]]);
      const middle=Math.max(1,Math.floor((points.length-1)/2)),start=points[0],target=points[middle],slot=Math.floor(i/paths.length);
      const startPocket=pausePocket(points,0,paths,section.floor),targetPocket=pausePocket(points,middle,paths,section.floor);
      const activity=section.id==='market'?'browsing':section.id==='observation'?'watching the planet':section.id==='docks'?'checking departures':'meeting';
      const role=section.id==='market'?'local shopper':section.id==='observation'?'gallery observer':section.id==='docks'?(i%paths.length===2?'freight crew':'departing traveler'):'promenade commuter';
      let facing=section.id==='observation'?Math.PI/2:section.id==='docks'?Math.PI:0;
      if(section.id==='market')facing=i%paths.length===0?-Math.PI/2:Math.PI;
      residentJourney({id:`${section.id}-local-${i}`,role,floor:section.floor,speed:section.id==='promenade'?.865:.86,phase:(slot+.24)/(Math.ceil(section.count/paths.length)),stops:[
        stop(startPocket,section.id==='market'?'Comparing stalls':section.id==='observation'?'Reading the gallery information':section.id==='docks'?'Reading gate directions':'Meeting a connection',7,facing,section.id==='docks'?'checking gate directions':activity,points.slice(0,middle+1)),
        stop(targetPocket,section.id==='market'?'Inspecting the neighboring displays':section.id==='observation'?'Taking in the rings':section.id==='docks'?(role==='freight crew'?'Checking the freight tender manifest':'Waiting beside the boarding approach'):'Watching the lower concourse',12,section.id==='docks'&&i%paths.length===2?Math.PI/2:section.id==='docks'&&i%paths.length===3?-Math.PI/2:facing,activity,points.slice(middle)),
      ]},{homeSector:sectorNumbers[section.id]??0});
    }
  }
  for (const side of [-1, 1]) for (const z of [-51, -97]) actor(side * 21.3, z, {pose: 'seated', seatHeight: .55, seatOffset: .6, yaw: -side * Math.PI / 2, scale: .96, height: 1});
  for(const [x,z] of [[47,-33],[46,-6.5],[84.7,-39],[84.7,-1]])actor(x,z,{pose:'seated',seatHeight:.55,seatOffset:x<64?2.7:.7,yaw:Math.PI/2,scale:.96,height:1});
  for (const [x, z, yaw] of [[-13.2,39.3,-Math.PI/2],[-13.2,41.3,-Math.PI/2],[-13.2,43.3,-Math.PI/2],[16,-8,.46],[17.4,-7,-1.33],[16.4,-5.4,3]]) actor(x,z,{pose:'talking',yaw});
  for (const [x,z,yaw] of [[-46,22,Math.PI],[-58,37.6,0],[-85,22,Math.PI],[-87,36.3,0],[92,-22,Math.PI/2],[-8,-166,-Math.PI/2]]) actor(x,z,{pose:'standing',yaw});
  actors.forEach(person);

  // Four independent port units: a concierge, a freight porter, a reclamation
  // attendant and an optical courier. Their compact silhouettes read at a glance.
  for (const [i, x, z] of [[0,-18,-15],[1,18,48],[2,-66,35],[3,65,-27]]) {
    const a = actor(x,z,{bot:true,yaw: i % 2 ? -Math.PI/2 : Math.PI/2,scale:1,height:1});
    const role=['arrival concierge','parcel porter','reclamation attendant','optical courier'][i];
    const jobs=[
      [stop([a.x,a.z],'Helping at the arrivals information aisle',16,Math.PI/2,'assisting travelers',[[-15,-15]]),stop([-15,12],'Checking the public information feed',12,Math.PI/2,'checking information',[[-18,12]])],
      [stop([a.x,a.z],'Collecting small freight at arrivals',13,0,'collecting parcels',[[18,58]]),stop([19,68],'Delivering parcels to the transfer approach',15,Math.PI/2,'unloading parcels',[[19.5,58],[19.5,48]])],
      [stop([-69.2,41.3],'Collecting returned bowls at Hot Noodles',18,Math.PI,'collecting containers',[[-69.2,43],[-72.6,43],[-72.6,25.5],[-56.5,25.5]]),stop([-56.5,24.3],'Sorting containers beside the market service aisle',12,-Math.PI/2,'sorting returns',[[-55.3,24.3],[-55.3,43],[-69.2,43]])],
      [stop([65,-27],'Collecting a sensor packet at the gallery ramp',14,Math.PI/2,'collecting sensor data',[[77,-30],[86,-31]]),stop([93,-30],'Delivering a sensor packet to the optical array',20,Math.PI/2,'servicing the optical array',[[84,-33],[76,-29]])],
    ][i];
    const journey=planner.compile({id:`service-${i}`,role,stops:jobs,speed:.86});
    if(journey.valid){journeys.push(journey);Object.assign(a,{route:'journey',journey,role,journeyClock:journey.duration*(.12+i*.19),speed:.86});sampleJourney(journey,a.journeyClock,a);a.sector=sectorIndex(a.x,a.z);}
    else{invalidJourneys.push(`service-${i}`);Object.assign(a,{role,state:'waiting for clearance',intent:'Waiting for a public service route to clear',speed:0});}
    const shell = ['#a47950','#6f8d83','#a09265','#7d6e84'][i];
    part(a,'bot',shell,0,.64,0,.4,.55,.34);
    part(a,'bot','#667d7b',0,1.17,0,.29,.22,.27);
    part(a,'gear','#344546',-.3,.18,0,.19,.28,.65);
    part(a,'gear','#344546',.3,.18,0,.19,.28,.65);
    part(a,'light','#b5c6aa',0,1.2,.235,.32,.055,.03);
    part(a,'gear','#cfac73',0,.66,.326,.26,.16,.025);
    part(a,'limb','#809286',-.5,.7,.04,.19,.085,.5,0,.3,0,'gesture');
    part(a,'limb','#809286',.5,.7,.04,.19,.085,.5,0,-.3,0);
    part(a,'limb','#71857c',.15,1.48,-.04,.025,.3,.025);
    part(a,'light','#c19d6c',.15,1.64,-.04,.06,.04,.06);
  }

  planner.finish();
  const timetable=applyPopulationTimetable(actors);
  for(const a of actors)if(a.journey){sampleJourney(a.journey,a.journeyClock,a);a.sector=sectorIndex(a.x,a.z);}
  let triangleCount = 0;
  for (const [type, records] of batches) {
    const {geometry, material} = types[type];
    const mesh = new THREE.InstancedMesh(geometry, material, records.length);
    mesh.name = `Passing lives / ${type}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    records.forEach((p,i) => mesh.setColorAt(i,color.set(p.tint)));
    mesh.instanceColor.needsUpdate = true;
    types[type].mesh = mesh;
    types[type].triangleCost = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
    types[type].layout = new Int32Array(records.length).fill(-1);
    triangleCount += types[type].triangleCost * records.length;
    group.add(mesh);
  }

  let simulationTime = 0;
  let uploadTime = 0;
  let lastUpdate = -Infinity;
  let disposed = false;
  let initialized = false;
  let lastCameraX = NaN, lastCameraZ = NaN;
  let lastReduced = false;
  let lastBehaviorTime=0;
  const renderTypes = Object.values(types);
  let visibleActors = actors.length;
  let submittedTriangles = triangleCount;
  let detailedActors = actors.length;

  // Intersect the camera-to-actor line with a branch's doorway. A three-metre
  // margin reveals silhouettes before their centers clear the edge, with no
  // abrupt sector switch and no allocation, sort, or added render batch.
  function throughDoor(sector, a, x, z) {
    if (sector === 3) {
      const along = x + (a.x - x) * ((-130 - z) / (a.z - z));
      return along > -18 && along < 18;
    }
    const wall = sector === 1 ? 32 : -32;
    const along = z + (a.z - z) * ((wall - x) / (a.x - x));
    return sector === 1 ? along > -43 && along < 3 : along > 7 && along < 53;
  }
  function visibleFromRoom(a, view, x, z) {
    if (a.sector === view) return true;
    if (view === 0) return throughDoor(a.sector, a, x, z);
    // The open concourse can connect two branch sightlines. Requiring both
    // thresholds preserves visitors visible through opposite doorways.
    if (a.sector !== 0) return throughDoor(view, a, x, z) && throughDoor(a.sector, a, x, z);
    return throughDoor(view, a, x, z);
  }
  function sameStaticPose(a,cache) {
    return cache.valid&&cache.floor===a.floor&&cache.x===a.x&&cache.z===a.z&&cache.yaw===a.yaw
      &&cache.scale===a.scale&&cache.height===a.height&&cache.seatHeight===a.seatHeight
      &&cache.seatOffset===a.seatOffset&&cache.pose===a.pose;
  }
  function rememberStaticPose(a,cache) {
    cache.valid=true;cache.floor=a.floor;cache.x=a.x;cache.z=a.z;cache.yaw=a.yaw;
    cache.scale=a.scale;cache.height=a.height;cache.seatHeight=a.seatHeight;cache.seatOffset=a.seatOffset;cache.pose=a.pose;
  }
  function refreshSeatedLocals(a) {
    const shift=a.pose==='seated'?(a.seatHeight+.075)/(a.scale*a.height)-HUMAN_PROFILE.hipY:0;
    const delta=shift-a.seatedShift;
    if(delta===0)return;
    a.seatedShift=shift;
    for(const p of a.parts)if(p.from===undefined&&p.endpoint===undefined) {
      p.y+=delta;
      transform.position.set(p.x,p.y,p.z);transform.rotation.set(p.rx,p.ry,p.rz);transform.scale.set(p.sx,p.sy,p.sz);transform.updateMatrix();
      p.matrix.copy(transform.matrix);
    }
  }
  function update(dt, _time, context = {}) {
    if (disposed) return;
    const delta = Math.max(0, Math.min(dt, .1));
    uploadTime += delta;
    if (!context.reducedMotion) simulationTime += delta;
    if (initialized && uploadTime - lastUpdate < .05) return;
    lastUpdate = uploadTime;
    const eye = context.camera?.position;
    if (initialized && context.reducedMotion && lastReduced
      && ((!eye && Number.isNaN(lastCameraX)) || (eye && eye.x === lastCameraX && eye.z === lastCameraZ))) return;
    initialized = true;
    lastReduced = Boolean(context.reducedMotion);
    lastCameraX = eye?.x ?? NaN;
    lastCameraZ = eye?.z ?? NaN;
    const view = eye ? sectorIndex(eye.x,eye.z) : -1;
    const behaviorDelta=simulationTime-lastBehaviorTime;lastBehaviorTime=simulationTime;
    visibleActors = detailedActors = submittedTriangles = 0;
    for (const type of renderTypes) {type.count = 0; type.colorChanged = false;}
    for (const a of actors) {
      if(a.journey){a.journeyClock+=behaviorDelta;sampleJourney(a.journey,a.journeyClock,a);}
      a.sector=sectorIndex(a.x,a.z);
      // Height and behavior keep advancing while a room is hidden. Reappearing
      // on the public ramp must not choose the lower floor under the balcony.
      const floor=navigation?.heightAt(a.x,a.z,a.floor)??0;
      if(Number.isFinite(floor))a.floor=floor;
      const gait = a.journey?Math.sin(a.travelDistance*6.6+a.phase)*a.walkWeight:0;
      a.gait=gait;
      if (eye && !visibleFromRoom(a, view, eye.x, eye.z)) continue;
      visibleActors++;
      if (eye) {
        const distanceSquared = (eye.x - a.x) ** 2 + (eye.z - a.z) ** 2;
        // Accessories disappear only at a sub-pixel distance, with hysteresis
        // to avoid repeated color repacking when someone stands near the cutoff.
        if (distanceSquared > 4900) a.detailed = false;
        else if (distanceSquared < 3600) a.detailed = true;
      } else a.detailed = true;
      if (a.detailed) detailedActors++;
      const cache=a.poseCache;
      const staticPose=Boolean(cache&&((!a.route&&(a.pose==='seated'||a.pose==='standing'))||(a.journey&&a.walkWeight===0)));
      if(cache&&!staticPose)cache.valid=false;
      if(!staticPose||!sameStaticPose(a,cache)) {
        if(staticPose)refreshSeatedLocals(a);
        const bob = a.joints?posePerson(a,gait,simulationTime):0;
        const seatOffset=a.seatOffset||0;
        transform.position.set(a.x+Math.sin(a.yaw)*seatOffset,(a.floor||0)+bob,a.z+Math.cos(a.yaw)*seatOffset); transform.rotation.set(0,a.yaw,0); transform.scale.set(a.scale,a.scale*a.height,a.scale); transform.updateMatrix();
        a.matrix.copy(transform.matrix);
        if(staticPose) {
          // Compute every accessory too, so later visibility/LOD repacking can
          // reuse the exact pose without leaving a newly shown slot at identity.
          for(const p of a.parts){posePart(a,p,gait);p.worldMatrix.multiplyMatrices(a.matrix,p.matrix);}
          rememberStaticPose(a,cache);
        }
      }
      for (const p of a.parts) {
        if (p.detail && !a.detailed) continue;
        const type = types[p.type];
        const slot = type.count++;
        if (type.layout[slot] !== p.index) {
          type.layout[slot] = p.index;
          type.mesh.setColorAt(slot,p.color);
          type.colorChanged = true;
        }
        if(staticPose){type.mesh.setMatrixAt(slot,p.worldMatrix);continue;}
        if(a.joints)posePart(a,p,gait);
        let angle = 0;
        if (a.route && p.motion.startsWith('leg')) angle = gait * (p.motion === 'leg0' ? .23 : -.23);
        else if (a.route && p.motion.startsWith('arm')) angle = gait * (p.motion === 'arm0' ? -.17 : .17);
        else if (a.route && p.motion.startsWith('shoe')) angle = gait * (p.motion === 'shoe0' ? .12 : -.12);
        else if (p.motion === 'gesture') angle = Math.sin(simulationTime * .75 + a.phase) * .13;
        if (angle) {
          transform.position.set(p.x,p.y,p.z); transform.rotation.set(p.rx+angle,p.ry,p.rz); transform.scale.set(p.sx,p.sy,p.sz); transform.updateMatrix();
          combined.multiplyMatrices(a.matrix,transform.matrix);
        } else combined.multiplyMatrices(a.matrix,p.matrix);
        type.mesh.setMatrixAt(slot,combined);
      }
    }
    for (const type of renderTypes) {
      type.mesh.count = type.count;
      type.mesh.instanceMatrix.needsUpdate = true;
      if (type.colorChanged) type.mesh.instanceColor.needsUpdate = true;
      submittedTriangles += type.triangleCost * type.count;
    }
  }
  update(0,0);
  const stats = Object.freeze({actors:actors.length, travelers:56, seated:8, social:12, serviceUnits:4,pathRoutes,upperDeckTravelers:10, drawCalls:batches.size, triangles:triangleCount, updateHz:20, textures:0, lights:0, humanStyle:'tailored adult proportions / understated faces', humanHeadHeight:.26,travelPacks,accessoryStyle:'fitted upper-back packs / connected shoulder straps',
    get behavior(){const states={};for(const a of actors){const state=a.state||a.pose||'standing';states[state]=(states[state]||0)+1;}return{scheduledResidents:journeys.length,crossSectorJourneys:14,crossDeckJourneys:2,destinationStops:journeys.reduce((n,p)=>n+p.stops.length,0),invalidRoutes:[...invalidJourneys],states,planner:planner.stats,timetable};},
    get visibleActors(){return visibleActors;}, get submittedTriangles(){return submittedTriangles;}, get detailedActors(){return detailedActors;}});
  group.userData.population = stats;
  return {group,update,stats,
    get behaviorSnapshot(){return actors.map(a=>({id:a.id,journeyId:a.journey?.id||null,role:a.role||(a.pose==='seated'?'reader':a.pose==='talking'?'conversation partner':'local visitor'),state:a.state||a.pose||'standing',intent:a.intent||(a.pose==='seated'?'Reading while waiting':a.pose==='talking'?'Talking with a companion':'Looking over the nearby display'),x:a.x,z:a.z,floor:a.floor||0,yaw:a.yaw,speed:a.journey?a.speed:0,cruiseSpeed:a.journey?.speed||0,gait:a.gait||0,walkWeight:a.walkWeight||0,travelDistance:a.travelDistance||0,cycleDuration:a.journey?.duration||0,localTime:a.localTime||0,goal:a.goal?{x:a.goal.point[0],z:a.goal.point[1],intent:a.goal.intent,facing:a.goal.facing}:null}));},
    get behaviorPlans(){return journeys.map(p=>structuredClone(p));},
    dispose(){if(disposed)return;disposed=true;for(const type of renderTypes){type.mesh.dispose();type.geometry.dispose();}for(const material of [cloth,skin,equipment,lights])material.dispose();group.clear();}};
}
