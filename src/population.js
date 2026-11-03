import * as THREE from 'three';
import { sectorAt } from './navigation.js';

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
  const cloth = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .88, metalness: .05});
  const skin = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .94, metalness: .02});
  const equipment = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .57, metalness: .38});
  const lights = new THREE.MeshBasicMaterial({color: '#ffffff'});
  const types = {
    torso: {geometry: new THREE.CylinderGeometry(.24, .31, .72, 6), material: cloth},
    head: {geometry: new THREE.SphereGeometry(1, 6, 3), material: skin},
    limb: {geometry: new THREE.BoxGeometry(1, 1, 1), material: cloth},
    gear: {geometry: new THREE.BoxGeometry(1, 1, 1), material: equipment},
    robe: {geometry: new THREE.ConeGeometry(1, 1, 6), material: cloth},
    light: {geometry: new THREE.BoxGeometry(1, 1, 1), material: lights},
    bot: {geometry: new THREE.IcosahedronGeometry(1, 0), material: equipment},
  };
  for (const type of Object.keys(types)) batches.set(type, []);
  const coats = ['#8d6a4f', '#456e6a', '#b0a17e', '#77505c', '#4f616f', '#929572', '#b16d43', '#3b4d50', '#a39b91'];
  const faces = ['#ad815e', '#d0b08b', '#76523f', '#b4916f', '#573e35', '#a89d7d', '#c8c0a0'];
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
  function part(a, type, tint, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, motion = '') {
    const records = batches.get(type);
    const p = {actor: a, type, tint, x, y, z, sx, sy, sz, rx, ry, rz, motion, index: records.length, matrix: new THREE.Matrix4(),
      color: new THREE.Color(tint),
      detail: type === 'light' || (type === 'gear' && y > .5) || (type === 'head' && sy < .16) || (type === 'limb' && sy < .2)};
    transform.position.set(x, y, z); transform.rotation.set(rx, ry, rz); transform.scale.set(sx, sy, sz); transform.updateMatrix();
    p.matrix.copy(transform.matrix);
    records.push(p); parts.push(p); a.parts.push(p);
    return p;
  }
  function person(a, index) {
    const coat = coats[index % coats.length];
    const face = faces[(index * 3) % faces.length];
    const suited = a.sector === 3 || index % 6 === 0;
    const robed = index % 4 === 1;
    const prosthetic = index % 7 === 2;
    const seated = a.pose === 'seated';
    const hip = seated ? .98 : .87;
    const shoulder = seated ? 1.46 : 1.47;
    const head = seated ? 1.76 : 1.78;
    part(a, 'torso', coat, 0, seated ? 1.28 : 1.19, 0, suited ? 1.3 : 1.07, seated ? .83 : 1, suited ? 1.22 : 1);
    part(a, 'head', suited ? '#b4b8a4' : face, 0, head, 0, suited ? .245 : .19, suited ? .255 : .215, suited ? .23 : .19);
    if (suited) {
      part(a, 'gear', '#25383b', 0, head + .01, .203, .35, .115, .075);
      part(a, 'light', '#a3b6a1', 0, head + .035, .244, .26, .025, .013);
      part(a, 'gear', '#667676', .18, head - .1, .13, .12, .17, .13);
      part(a, 'gear', '#667676', -.18, head - .1, .13, .12, .17, .13);
      part(a, 'gear', '#9eab9d', 0, shoulder, -.02, .67, .13, .36);
    } else {
      part(a, 'gear', '#29353a', -.063, head + .015, .179, .035, .027, .025);
      part(a, 'gear', '#29353a', .063, head + .015, .179, .035, .027, .025);
      if (index % 3 !== 1) part(a, 'head', index % 3 ? '#363637' : '#9c9b8c', 0, head + .115, -.016, .2, .127, .2);
      if (index % 5 === 2) part(a, 'gear', '#9cac9d', 0, head - .065, .189, .185, .085, .09);
    }
    part(a, 'gear', '#344648', 0, hip + .05, 0, .5, .1, .31);
    if (robed && !seated) part(a, 'robe', coat, 0, .76, 0, .43, 1.07, .39);
    for (const side of [-1, 1]) {
      const sideIndex = side === -1 ? 0 : 1;
      if (seated) {
        part(a, 'limb', coat, side * .14, .91, .27, .17, .2, .66);
        part(a, 'limb', '#394546', side * .14, .48, .57, .14, .7, .14);
        part(a, 'gear', '#2c3b3c', side * .14, .13, .64, .18, .15, .36);
      } else {
        part(a, 'limb', prosthetic && side === 1 ? '#9aa89e' : '#3a4848', side * .14, .47, 0, .16, .76, .17, 0, 0, 0, `leg${sideIndex}`);
        part(a, 'gear', '#293b3c', side * .14, .1, .065, .2, .16, .36, 0, 0, 0, `shoe${sideIndex}`);
      }
      const talking = a.pose === 'talking' && side === -1;
      const reading = a.pose === 'seated';
      part(a, 'limb', prosthetic && side === 1 ? '#9da99d' : coat, side * (suited ? .39 : .34), reading ? 1.22 : talking ? 1.37 : 1.15,
        reading ? .22 : talking ? .16 : 0, .135, reading ? .48 : .61, .15,
        reading ? -.7 : talking ? -1.03 : 0, 0, side * -.055, reading ? '' : talking ? 'gesture' : `arm${sideIndex}`);
      part(a, 'limb', prosthetic && side === 1 ? '#b3bba9' : face, side * (reading ? .26 : .36), reading ? 1.08 : talking ? 1.5 : .83,
        reading ? .43 : talking ? .42 : .02, .12, .135, .12, 0, 0, 0, talking ? 'hand' : '');
    }
    if (seated) part(a, 'gear', index % 2 ? '#bb9f6b' : '#65857f', 0, 1.1, .47, .46, .055, .35, -.18, 0, 0);
    else if (index % 3 === 0) {
      part(a, 'gear', index % 2 ? '#ae7951' : '#738b7a', .47, .88, -.08, .33, .44, .24);
      part(a, 'gear', '#3c4d4d', .32, 1.16, .03, .06, .63, .06, 0, 0, -.32);
    } else if (index % 4 === 2) {
      part(a, 'gear', '#657b73', 0, 1.18, -.25, .43, .63, .25);
    }
    part(a, 'light', suited ? '#c5a26c' : '#a1b09a', -.13, 1.33, .257, .06, .035, .02);
  }

  // Long-haul streams keep the central five metres and all kiosk footprints clear.
  const mainLanes = [6.4, 8.8, 11.1, 14.1];
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? -1 : 1;
    actor(side * mainLanes[Math.floor(i / 2) % mainLanes.length], -112 + (i * 31.7) % 197, {
      route: 'z', min: -116, max: 89, direction: side, yaw: side > 0 ? 0 : Math.PI,
      scale: i % 9 === 0 ? .88 : .94 + random() * .15, height: i % 9 === 0 ? 1.23 : .96 + random() * .07,
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
  for (const side of [-1, 1]) for (const z of [-51, -97]) actor(side * 21.3, z, {pose: 'seated', yaw: -side * Math.PI / 2, scale: .96, height: 1});
  for(const [x,z] of [[47,-33],[46,-6.5],[84.7,-39],[84.7,-1]])actor(x,z,{pose:'seated',yaw:Math.PI/2,scale:.96,height:1});
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
      const bob = a.route ? Math.abs(gait) * .024 : Math.sin(simulationTime * .6 + a.phase) * .004;
      const floor=navigation?.heightAt(a.x,a.z,a.floor)??0;
      if(Number.isFinite(floor))a.floor=floor;
      transform.position.set(a.x,(a.floor||0)+bob,a.z); transform.rotation.set(0,a.yaw,0); transform.scale.set(a.scale,a.scale*a.height,a.scale); transform.updateMatrix();
      a.matrix.copy(transform.matrix);
      for (const p of a.parts) {
        if (p.detail && !a.detailed) continue;
        const type = types[p.type];
        const slot = type.count++;
        if (type.layout[slot] !== p.index) {
          type.layout[slot] = p.index;
          type.mesh.setColorAt(slot,p.color);
          type.colorChanged = true;
        }
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
  const stats = Object.freeze({actors:actors.length, travelers:56, seated:8, social:12, serviceUnits:4,pathRoutes,upperDeckTravelers:8, drawCalls:batches.size, triangles:triangleCount, updateHz:20, textures:0, lights:0,
    get visibleActors(){return visibleActors;}, get submittedTriangles(){return submittedTriangles;}, get detailedActors(){return detailedActors;}});
  group.userData.population = stats;
  return {group,update,stats,dispose(){if(disposed)return;disposed=true;for(const type of renderTypes){type.mesh.dispose();type.geometry.dispose();}for(const material of [cloth,skin,equipment,lights])material.dispose();group.clear();}};
}
