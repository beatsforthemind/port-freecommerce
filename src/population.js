import * as THREE from 'three';
import { sectorAt } from './navigation.js';
import {createHumanHeadGeometry,createHumanTorsoGeometry,createHumanLimbGeometry,HUMAN_PALETTE,HUMAN_PROFILE} from './humanoid.js';

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
  const sectorIndex=(x,z)=>({concourse:0,observation:1,market:2,docks:3})[sectorAt(x,z)];

  function route(points) {
    const segments=[];let length=0;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(distance){segments.push({a,b,start:length,length:distance});length+=distance;}
    }
    return {segments,length};
  }
  function sampleRoute(a,distance) {
    const path=a.path;
    const along=((distance%path.length)+path.length)%path.length;
    const segment=path.segments.find(s=>along<s.start+s.length)||path.segments[path.segments.length-1];
    const t=(along-segment.start)/segment.length;
    a.x=segment.a[0]+(segment.b[0]-segment.a[0])*t;
    a.z=segment.a[1]+(segment.b[1]-segment.a[1])*t;
    a.yaw=Math.atan2(segment.b[0]-segment.a[0],segment.b[1]-segment.a[1]);
  }

  function actor(x, z, options = {}) {
    // Standing visitors belong in public aisles, seated readers in their seats.
    if(navigation&&!options.route&&options.pose!=='seated'&&!navigation.canWalk(x,z,options.floor)) {
      search:for(let radius=.7;radius<=6;radius+=.7)for(let i=0;i<12;i++) {
        const nx=x+Math.cos(i*Math.PI/6)*radius,nz=z+Math.sin(i*Math.PI/6)*radius;
        if(sectorAt(nx,nz)===sectorAt(x,z)&&navigation.canWalk(nx,nz,options.floor)){x=nx;z=nz;break search;}
      }
    }
    const record = {x, z, baseX: x, baseZ: z, yaw: options.yaw || 0, scale: options.scale || .89 + random() * .24,
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
    const workwear=a.sector===3||index%8===0;
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
    else if(index%3===0) {
      part(a,'gear',index%2?'#89694f':'#68786b',.365,1.02,-.10,.235,.29,.17,0,0,-.05,'',true);
      part(a,'robe','#393d3b',.115,1.195,.164,.035,.49,.014,0,0,-.46,'',true);
    } else if(index%4===2)part(a,'gear','#58685f',0,1.17,-.20,.32,.42,.16,0,0,0,'',true);
    // A few collars and practical credentials, rather than glowing chest LEDs
    // and identical staring eyes, establish role without caricature.
    if(workwear)part(a,'gear','#424b49',0,1.46,.045,.31,.075,.18,0,0,0,'',true);
    if(index%4===0)part(a,'light','#aaa891',-.105,1.29,.153,.036,.053,.009,0,0,0,'',true);
    if(seated||a.pose==='standing') {
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

  // Long-haul streams keep the central five metres and all kiosk footprints clear.
  const mainLanes = [6.4, 8.8, 11.1, 14.1];
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? -1 : 1;
    actor(side * mainLanes[Math.floor(i / 2) % mainLanes.length], -112 + (i * 31.7) % 197, {
      route: 'z', min: -116, max: 89, direction: side, yaw: side > 0 ? 0 : Math.PI,
      scale: i % 9 === 0 ? 1.07 : .94 + random() * .12, height: .97 + random() * .05,
    });
  }
  const routeGroups=[{id:'promenade',routes:promenadeRoutes,count:8,floor:7.625,speed:.55},
    ...districtLayouts.map(layout=>({id:layout.id,routes:layout.routes,count:layout.id==='market'?10:6,speed:layout.id==='observation'?.36:.65}))];
  let pathRoutes=0;
  for(const section of routeGroups) {
    const paths=(section.routes||[]).map(route).filter(path=>path.length>0);pathRoutes+=paths.length;
    for(let i=0;i<section.count&&paths.length;i++) {
      const path=paths[i%paths.length],offset=path.length*(i+.23)/section.count;
      const a=actor(path.segments[0].a[0],path.segments[0].a[1],{route:'path',path,offset,floor:section.floor,speed:section.speed*(.9+random()*.2)});
      sampleRoute(a,offset);a.sector=sectorIndex(a.x,a.z);
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
    visibleActors = detailedActors = submittedTriangles = 0;
    for (const type of renderTypes) {type.count = 0; type.colorChanged = false;}
    for (const a of actors) {
      if(a.route==='path')sampleRoute(a,a.offset+simulationTime*a.speed);
      else if (a.route) {
        const span = a.max - a.min;
        const offset = a.route === 'z' ? a.baseZ : a.baseX;
        const along = a.min + ((offset - a.min + simulationTime * a.direction * a.speed) % span + span) % span;
        if (a.route === 'z') a.z = along; else a.x = along;
      }
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
      const gait = Math.sin(simulationTime * (a.speed * 5.6 + .8) + a.phase);
      const floor=navigation?.heightAt(a.x,a.z,a.floor)??0;
      if(Number.isFinite(floor))a.floor=floor;
      const cache=a.poseCache;
      const staticPose=Boolean(cache&&!a.route&&(a.pose==='seated'||a.pose==='standing'));
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
  const stats = Object.freeze({actors:actors.length, travelers:56, seated:8, social:12, serviceUnits:4,pathRoutes,upperDeckTravelers:8, drawCalls:batches.size, triangles:triangleCount, updateHz:20, textures:0, lights:0, humanStyle:'tailored adult proportions / understated faces', humanHeadHeight:.26,
    get visibleActors(){return visibleActors;}, get submittedTriangles(){return submittedTriangles;}, get detailedActors(){return detailedActors;}});
  group.userData.population = stats;
  return {group,update,stats,dispose(){if(disposed)return;disposed=true;for(const type of renderTypes){type.mesh.dispose();type.geometry.dispose();}for(const material of [cloth,skin,equipment,lights])material.dispose();group.clear();}};
}
