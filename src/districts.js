import * as THREE from 'three';
import { applyGlassSheen, readableTiles } from './kit.js';
import { createSignage } from './signage.js';
import { createHumanHeadGeometry, createHumanHairGeometry, createHumanTorsoGeometry, createHumanLimbGeometry, HUMAN_PALETTE, HUMAN_PROFILE } from './humanoid.js';
import { buildObservationDistrict } from './district-observation.js';
import { buildMarketDistrict } from './district-market.js';
import { buildDocksDistrict } from './district-docks.js';
import { createCommuterBehavior } from './commuter-behavior.js';
import {TRAVEL_PACK_BODY,TRAVEL_PACK_STRAPS,TRAVEL_PACK_TRIM,travelPackPieceColor} from './travel-gear.js';
import {applyIndustrialSurface,createSurfaceLibrary,createPavingSurface} from './surfaces.js';
import {createContactShadows} from './contact-shadows.js';
import {CROWD_PACE} from './population-timetable.js';

/** Connected station districts, all built locally without model downloads. */
export function createDistricts({glow = null, signage = null} = {}) {
  const group = new THREE.Group();
  group.name = 'FreeCommerce · outer districts';
  const ownSignage = signage ? null : createSignage();
  const signs = signage || ownSignage;
  const colliders = [];
  const batches = new Map();
  const transform = new THREE.Object3D();
  let disposed = false;
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .74, metalness: .38, ...extra });
  const m = {
    floor: mat('#253334'), wall: mat('#354345'), dark: mat('#152528'), steel: mat('#667371'),
    cream: mat('#c0b194'), rust: mat('#985b3d'), sage: mat('#627a68'), red: mat('#995c51'),
    cloth: mat('#b36d43', { metalness: .05 }),
    amber: new THREE.MeshBasicMaterial({ color: '#edb96c' }),
    warm: new THREE.MeshBasicMaterial({ color: '#e2cfab' }),
    soft: new THREE.MeshBasicMaterial({ color: '#8aafa1' }),
    glass: applyGlassSheen(new THREE.MeshBasicMaterial({ color: '#69989a', transparent: true, opacity: .045, side: THREE.DoubleSide, depthWrite: false }), {edge: .34}),
  };
  // The districts share the concourse's panel language instead of flat paint.
  for (const key of ['wall', 'rust', 'sage']) applyIndustrialSurface(m[key]);
  for (const key of ['floor', 'dark', 'steel', 'cream', 'red']) applyIndustrialSurface(m[key], {relief: false});
  // Boxes are batched per district as well as per material, so a district
  // that is out of view is culled instead of riding along with the others.
  let district = 'shared';
  function box(material, x, y, z, w, h, d, ry = 0) {
    transform.position.set(x, y, z); transform.rotation.set(0, ry, 0); transform.scale.set(w, h, d);
    transform.updateMatrix();
    let byMaterial = batches.get(district);
    if (!byMaterial) batches.set(district, byMaterial = new Map());
    if (!byMaterial.has(material)) byMaterial.set(material, []);
    byMaterial.get(material).push(transform.matrix.clone());
  }
  function footprint(x, y, z, w, h, d) {
    colliders.push({ minX: x - w / 2 - .25, maxX: x + w / 2 + .25, minZ: z - d / 2 - .25, maxZ: z + d / 2 + .25, minY:y-h/2,maxY:y+h/2 });
  }
  function solid(material, x, y, z, w, h, d, ry = 0) {
    box(material, x, y, z, w, h, d, ry);
    footprint(x,y,z,w,h,d);
  }
  /** A backed sign on the shared lettering sheet, in the layer of the district being built. */
  function sign(text, x, y, z, width, height = 1, ry = 0, color = '#eed2a2', background = '#1a2b2d') {
    return signs.add(text, {x, y, z, width, height, yaw: ry, color, background, layer: district});
  }
  function mesh(geometry, material, x, y, z, rotation) {
    const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z);
    if (rotation) object.rotation.set(...rotation);
    group.add(object); return object;
  }

  // One local atlas supplies all of the tiny information layers. Keeping the
  // display faces in a single geometry is much cheaper than dozens of canvases
  // and independent screen meshes, and it keeps text crisp at walking distance.
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = atlasCanvas.height = 1024;
  const ac = atlasCanvas.getContext('2d');
  const atlasTitles = ['LOCAL / ARRIVALS', 'HOT NOODLES / 24', 'CAUTION / SERVICE', 'PFC / FREIGHT', 'PELAGOS / ORBIT', 'OPTICAL ARRAY', 'SEALED / DRY GOODS', 'AIR / RECOVERY', 'SECOND ORBIT', 'PFC / PUBLIC DECK', 'RECLAIM / REUSE', 'DEPARTURES / 07', 'LOCAL EXCHANGE', 'GLAZING / 09', 'TRADE CLEARANCE', 'PERSONAL TRANSIT'];
  for (let tile = 0; tile < 16; tile++) {
    const ox = (tile % 4) * 256, oy = Math.floor(tile / 4) * 256;
    ac.save(); ac.translate(ox, oy);
    ac.fillStyle = tile === 2 ? '#ad8255' : tile === 8 ? '#947554' : '#203437';
    ac.fillRect(0, 0, 256, 256);
    ac.strokeStyle = '#8aa496'; ac.lineWidth = 2; ac.strokeRect(12, 12, 232, 232);
    ac.fillStyle = tile === 2 ? '#203033' : '#d6d7b5';
    ac.font = '600 16px sans-serif'; ac.fillText(atlasTitles[tile], 22, 40, 215);
    ac.fillStyle = '#9db7a5'; ac.fillRect(22, 53, 211, 2);
    if (tile === 4 || tile === 5 || tile === 13) {
      ac.strokeStyle = '#9bb6a3'; ac.lineWidth = 1;
      for (const r of [28, 53, 77]) { ac.beginPath(); ac.ellipse(128, 145, r, r * .64, -.25, 0, Math.PI * 2); ac.stroke(); }
      ac.beginPath(); ac.moveTo(37, 145); ac.lineTo(219, 145); ac.moveTo(128, 73); ac.lineTo(128, 220); ac.stroke();
      ac.fillStyle = '#d8b27c'; ac.beginPath(); ac.arc(171, 111, 4, 0, Math.PI * 2); ac.fill();
      ac.font = '12px sans-serif'; ac.fillText('327.06  /  NOMINAL', 30, 229);
    } else if (tile === 2) {
      ac.strokeStyle = '#233235'; ac.lineWidth = 14;
      for (let i = -1; i < 7; i++) { ac.beginPath(); ac.moveTo(i * 48, 80); ac.lineTo(i * 48 - 60, 150); ac.stroke(); }
      ac.fillStyle = '#243134'; ac.font = '600 23px sans-serif'; ac.fillText('KEEP CLEAR', 33, 188); ac.font = '13px sans-serif'; ac.fillText('AUTOMATED EQUIPMENT', 24, 215);
    } else if (tile === 3 || tile === 6 || tile === 14 || tile === 15) {
      ac.fillStyle = '#d4d5b7'; ac.font = '600 38px sans-serif'; ac.fillText(`7${tile}—048`, 22, 107);
      ac.font = '12px sans-serif'; ac.fillText('ORIGIN VERIFIED / SEAL INTACT', 22, 131, 211);
      for (let x = 22; x < 230; x += 5) { ac.fillStyle = x % 3 ? '#bdcbb1' : '#6e8b7e'; ac.fillRect(x, 160, x % 7 ? 2 : 4, 52); }
      ac.font = '11px sans-serif'; ac.fillText('PFC   048  /  62071', 22, 232);
    } else {
      for (let row = 0; row < 5; row++) {
        ac.fillStyle = row % 2 ? '#88a291' : '#b5bea2'; ac.font = '13px sans-serif';
        const line = tile === 1 ? ['BROTH / GINGER', 'NOODLES / HANDMADE', 'SALT / FERMENT', 'HOT TEA', 'NO QUESTIONS'][row] : ['STATUS / AVAILABLE', 'CYCLE 327 / VERIFIED', 'OPEN ACCESS', 'PORT AUTHORITY', 'TRANSFER COMPLETE'][row];
        ac.fillText(line, 22, 84 + row * 28, 192);
        ac.fillStyle = '#d7b680'; ac.fillRect(220, 74 + row * 28, 6, 6);
      }
      ac.fillStyle = '#96aa95'; ac.fillRect(22, 228, 90, 3); ac.fillRect(120, 228, 110, 3);
    }
    ac.restore();
  }
  const atlas = new THREE.CanvasTexture(atlasCanvas);
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  const decalPositions = [], decalUVs = [];
  function decal(tile, x, y, z, w, h, ry = 0) {
    const cx = Math.cos(ry), sx = Math.sin(ry);
    const u0 = (tile % 4) * .25 + .002, u1 = u0 + .246;
    const v1 = 1 - Math.floor(tile / 4) * .25 - .002, v0 = v1 - .246;
    for (const [px, py, u, v] of [[-.5,-.5,u0,v0],[.5,-.5,u1,v0],[.5,.5,u1,v1],[-.5,-.5,u0,v0],[.5,.5,u1,v1],[-.5,.5,u0,v1]]) {
      decalPositions.push(x + px * w * cx, y + py * h, z - px * w * sx);
      decalUVs.push(u, v);
    }
  }

  /** Add an object a district built for itself, such as a moored craft. */
  function attach(object) { group.add(object); return object; }

  const context={box,solid,footprint,sign,mesh,attach,decal,m,glow};
  const layouts=[];
  for (const [id, build] of [['observation',buildObservationDistrict],['market',buildMarketDistrict],['docks',buildDocksDistrict]]) {
    district = id; layouts.push(build(context));
  }
  district = 'shared';
  if (ownSignage) { ownSignage.build(); group.add(ownSignage.group); }

  // Repeated static box work becomes one draw call per district and material.
  const unitCube = new THREE.BoxGeometry(1, 1, 1);
  const lit = new Map([[m.amber, '#edb96c'], [m.warm, '#e2cfab'], [m.soft, '#8aafa1']]);
  for (const [id, byMaterial] of batches) for (const [material, matrices] of byMaterial) {
    const instances = new THREE.InstancedMesh(unitCube, material, matrices.length);
    instances.name = `District ${id} / boxes`;
    matrices.forEach((matrix, i) => instances.setMatrixAt(i, matrix));
    instances.computeBoundingSphere(); group.add(instances);
    if (glow && lit.has(material)) for (const matrix of matrices) glow.box(matrix, lit.get(material), {strip: .38, panel: .2});
  }
  if (decalPositions.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(decalPositions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(decalUVs, 2));
    geometry.computeBoundingSphere();
    const details = new THREE.Mesh(geometry, readableTiles(new THREE.MeshBasicMaterial({map: atlas, side: THREE.DoubleSide}), 4));
    details.name = 'District information atlas / single batch';
    group.add(details);
  }

  // Small autonomously moving cargo tugs add scale high above the pedestrian deck.
  const drones = [];
  for (let i = 0; i < 4; i++) {
    const drone = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, .85, 1.4), i % 2 ? m.cream : m.rust);
    drone.add(body);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 1.2), m.dark); cargo.position.y = -.8; drone.add(cargo);
    for (const side of [-1, 1]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .6), m.amber); light.position.set(side * 1.27, .05, 0); drone.add(light);
    }
    group.add(drone); drones.push(drone);
  }

  // Adult proportions and tailored travel layers share five batches.
  // Segmented limbs pivot at joints; fitted packs remain on the torso.
  // Each commuter's limb pieces: four leg and four arm segments, then neck, collar, hips, two hands and two boot uppers.
  const LIMBS=15,NECK=8,COLLAR=9,HIPS=10,HAND=11,BOOT=13;
  const crowdCount = 20;
  const packCount=Math.ceil(crowdCount/3);
  const commuterBehavior = createCommuterBehavior(crowdCount);
  const bodies = new THREE.InstancedMesh(createHumanTorsoGeometry(),mat('#ffffff',{roughness:.9,metalness:0}),crowdCount+packCount);
  const heads = new THREE.InstancedMesh(createHumanHeadGeometry(),mat('#ffffff',{roughness:.95,metalness:0,vertexColors:true}),crowdCount);
  const legs = new THREE.InstancedMesh(createHumanLimbGeometry(),mat('#ffffff',{roughness:.92,metalness:0}),crowdCount*LIMBS+packCount*TRAVEL_PACK_STRAPS.length);
  const bags = new THREE.InstancedMesh(unitCube,mat('#ffffff',{roughness:.87,metalness:0}),crowdCount*2+packCount*TRAVEL_PACK_TRIM.length);
  const hair = new THREE.InstancedMesh(createHumanHairGeometry(),mat('#ffffff',{roughness:.88,metalness:0}),crowdCount);
  bodies.name='Commuters / tailored jackets';
  heads.name='Commuters / heads';
  legs.name='Commuters / jointed sleeves and trousers';
  bags.name='Commuters / boot soles and luggage';
  hair.name='Commuters / hair';
  const tint = new THREE.Color();
  const crowdMeshes=[bodies,heads,legs,bags,hair];
  // The commuters never leave the concourse: they are skipped with it.
  for(const object of crowdMeshes){object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);object.frustumCulled=false;object.userData.concourseInterior=true;}
  for(let i=0;i<crowdCount;i++) {
    const coat=HUMAN_PALETTE.coats[i%HUMAN_PALETTE.coats.length];
    const trousers=HUMAN_PALETTE.trousers[i%HUMAN_PALETTE.trousers.length];
    const skin=HUMAN_PALETTE.skin[(i*3)%HUMAN_PALETTE.skin.length];
    // Every third commuter wears a vest over a close undersuit; the rest wear a jacket with a trimmed collar.
    const under=HUMAN_PALETTE.under[i%HUMAN_PALETTE.under.length],sleeve=i%3===1?under:coat;
    bodies.setColorAt(i,tint.set(coat));heads.setColorAt(i,tint.set(skin));
    hair.setColorAt(i,tint.set(HUMAN_PALETTE.hair[(i*3+1)%HUMAN_PALETTE.hair.length]));
    for(let part=0;part<8;part++)legs.setColorAt(i*LIMBS+part,tint.set(part<4?trousers:sleeve));
    legs.setColorAt(i*LIMBS+NECK,tint.set(skin));
    legs.setColorAt(i*LIMBS+COLLAR,tint.set(i%3===1?under:HUMAN_PALETTE.trim[i%HUMAN_PALETTE.trim.length]));
    legs.setColorAt(i*LIMBS+HIPS,tint.set(trousers));
    for(let side=0;side<2;side++){
      legs.setColorAt(i*LIMBS+HAND+side,tint.set(skin));
      legs.setColorAt(i*LIMBS+BOOT+side,tint.set(i%2?'#3b3229':'#293338'));
      bags.setColorAt(i*2+side,tint.set('#1d2325'));
    }
    if(i%3===0){
      const pack=i/3;
      bodies.setColorAt(crowdCount+pack,tint.set(travelPackPieceColor(TRAVEL_PACK_BODY,i)));
      TRAVEL_PACK_STRAPS.forEach((piece,index)=>legs.setColorAt(crowdCount*LIMBS+pack*TRAVEL_PACK_STRAPS.length+index,tint.set(travelPackPieceColor(piece,i))));
      TRAVEL_PACK_TRIM.forEach((piece,index)=>bags.setColorAt(crowdCount*2+pack*TRAVEL_PACK_TRIM.length+index,tint.set(travelPackPieceColor(piece,i))));
    }
  }
  for(const object of crowdMeshes){object.instanceColor.needsUpdate=true;group.add(object);}
  const actorMatrix=new THREE.Matrix4(),partMatrix=new THREE.Matrix4();
  const legPoses=[{},{}];
  function place(object,index,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0) {
    transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();
    partMatrix.multiplyMatrices(actorMatrix,transform.matrix);object.setMatrixAt(index,partMatrix);
  }
  function placePackPiece(object,index,piece){place(object,index,piece.x,piece.y,piece.z,piece.sx,piece.sy,piece.sz,piece.rx,piece.ry,piece.rz);}
  const crowdTriangles=crowdMeshes.reduce((sum,object)=>sum+(object.geometry.index?.count??object.geometry.attributes.position.count)/3*object.count,0);
  group.userData.commuters=Object.freeze({actors:crowdCount,drawCalls:5,triangles:crowdTriangles,updateHz:30,adultHeight:HUMAN_PROFILE.height,purposefulJourneys:crowdCount,travelPacks:packCount,accessoryStyle:'fitted upper-back packs / connected shoulder straps',
    get activities(){return commuterBehavior.counts(motionTime*CROWD_PACE);}});
  // Without the shadow map, a soft blob keeps each commuter on the deck.
  const contact = createContactShadows(crowdCount, 'Commuters / contact shadows');
  contact.mesh.userData.concourseInterior=true;
  group.add(contact.mesh);
  const crowdBounds = new THREE.Box3(new THREE.Vector3(-30,-.5,-124),new THREE.Vector3(30,2.6,91));
  const crowdFrustum = new THREE.Frustum();
  const crowdProjection = new THREE.Matrix4();
  let lastCrowdUpdate = -Infinity;
  let motionTime = 0;
  // Each commuter can fall behind the shared timetable to let the visitor pass,
  // then win the time back. `lag` is timetable seconds; `hold` is their pace.
  const lag=new Float32Array(crowdCount),hold=new Float32Array(crowdCount).fill(1),waited=new Float32Array(crowdCount),ignore=new Float32Array(crowdCount);
  const probe={};
  function yieldPace(i,record,visitor,dt) {
    let blocked=false;
    if(visitor&&record.speed>.1&&ignore[i]<=0&&visitor.y<3.2) {
      const dx=visitor.x-record.x,dz=visitor.z-record.z;
      if(dx*dx+dz*dz<3.4) {
        const fx=Math.sin(record.yaw),fz=Math.cos(record.yaw),ahead=dx*fx+dz*fz;
        blocked=ahead>.05&&ahead<1.7&&Math.abs(dx*fz-dz*fx)<.62;
      }
    }
    if(blocked){waited[i]+=dt;if(waited[i]>4.5){ignore[i]=4;waited[i]=0;blocked=false;}}
    else waited[i]=Math.max(0,waited[i]-dt*2);
    if(ignore[i]>0)ignore[i]-=dt;
    hold[i]+=((blocked?0:1)-hold[i])*(1-Math.exp(-dt*7));
    if(hold[i]>.999)hold[i]=1;
    if(hold[i]===1&&lag[i]<=0)return;
    const rate=hold[i]*(1+Math.min(.3,lag[i]));
    lag[i]=Math.max(0,lag[i]+dt*(1-rate));
  }
  /** A visitor cannot walk through a commuter, but can always step away from one. */
  function obstructs(x,z,feet,fromX,fromZ) {
    if(Math.abs(feet)>1.2||Math.abs(x)>31||z<-126||z>93)return false;
    const clock=motionTime*CROWD_PACE;
    for(let i=0;i<crowdCount;i++) {
      commuterBehavior.sample(i,clock-lag[i],probe);
      const dx=x-probe.x,dz=z-probe.z,distance=dx*dx+dz*dz;
      if(distance>.3)continue;
      const px=fromX-probe.x,pz=fromZ-probe.z;
      if(distance<px*px+pz*pz)return true;
    }
    return false;
  }
  let initialized = false;
  let wasCrowdVisible = true;
  function update(dt, _time, context = {}) {
    if (disposed) return;
    if (!context.reducedMotion) motionTime += Math.max(0,Math.min(dt,.1));
    const time = motionTime;
    const camera = context.camera;
    let crowdVisible = true;
    if (camera?.projectionMatrix && camera?.matrixWorldInverse) {
      camera.updateMatrixWorld();
      crowdProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      crowdFrustum.setFromProjectionMatrix(crowdProjection);
      crowdVisible = crowdFrustum.intersectsBox(crowdBounds);
    }
    // From a district with no opening in view, the hall is not drawn at all.
    if (context.concourseSeen === false) crowdVisible = false;
    const justShown = crowdVisible && !wasCrowdVisible;
    wasCrowdVisible = crowdVisible;
    for (const mesh of crowdMeshes) mesh.visible = crowdVisible;
    contact.mesh.visible = crowdVisible;
    if (!context.reducedMotion || !initialized) {
      for (let i = 0; i < drones.length; i++) {
        const drone = drones[i];
        const phase = time * .035 + i * 1.57;
        drone.position.set(Math.sin(phase) * 15, 11.8 + i * 1.6 + Math.sin(time * .8 + i) * .25, -30 + Math.cos(phase) * 68);
        drone.rotation.y = -phase;
      }
    }
    // Keep the clock advancing offscreen, then reconstruct exact poses on return.
    // Visibility is evaluated even with reduced motion so turning never hides a
    // frozen crowd that should be visible, or uploads its unchanged matrices.
    if (!crowdVisible) return;
    if (time - lastCrowdUpdate < 1 / 30 && !(justShown && time > lastCrowdUpdate)) return;
    const elapsed=Number.isFinite(lastCrowdUpdate)?Math.min(.2,Math.max(0,time-lastCrowdUpdate)):0;
    lastCrowdUpdate = time;
    const visitor=camera&&context.mode&&context.mode!=='arrival'?camera.position:null;
    contact.begin();
    for(let i=0;i<crowdCount;i++) {
      const commuter=commuterBehavior.records[i];
      yieldPace(i,commuter,visitor,elapsed*CROWD_PACE);
      commuterBehavior.sample(i,time*CROWD_PACE-lag[i]);
      const x=commuter.x,z=commuter.z;
      if(!context.shadows)contact.add(x,0,z,commuter.yaw);
      const phase=commuter.gait,motion=smoothWalk(commuter.speed/commuter.cruiseSpeed)*hold[i],gait=Math.sin(phase)*motion,cadence=Math.cos(phase)*motion;
      const stature=.972+(i%5)*.014,breadth=.95+(i%4)*.03;
      let minimumFoot=Infinity;
      for(let side=0;side<2;side++) {
        const p=legPoses[side],sign=side?1:-1;
        p.x=sign*.112;p.thigh=(side?-gait:gait)*.28;
        p.calf=p.thigh+.06+.46*Math.max(0,side?cadence:-cadence);
        p.ky=HUMAN_PROFILE.hipY-Math.cos(p.thigh)*.40;p.kz=-Math.sin(p.thigh)*.40;
        p.ay=p.ky-Math.cos(p.calf)*.38;p.az=p.kz-Math.sin(p.calf)*.38;
        p.foot=Math.max(-.12,Math.min(.12,p.calf*.35));
        p.fy=p.ay-.045*Math.cos(p.foot)-.065*Math.sin(p.foot);
        p.fz=p.az-.045*Math.sin(p.foot)+.065*Math.cos(p.foot);
        minimumFoot=Math.min(minimumFoot,p.fy-.055*Math.abs(Math.cos(p.foot))-.13*Math.abs(Math.sin(p.foot)));
      }
      const bob=Math.max(0,-minimumFoot*stature)+Math.abs(Math.sin(phase*2))*.003*motion;
      transform.position.set(x,bob,z);transform.rotation.set(0,commuter.yaw,0);transform.scale.set(breadth,stature,breadth);transform.updateMatrix();actorMatrix.copy(transform.matrix);
      place(bodies,i,0,HUMAN_PROFILE.torsoY,0,...HUMAN_PROFILE.torsoScale);
      place(heads,i,0,HUMAN_PROFILE.headY,0,...HUMAN_PROFILE.headScale);
      const fuller=i%3===1?1.06:1;
      place(hair,i,0,HUMAN_PROFILE.headY,0,HUMAN_PROFILE.headScale[0]*fuller,HUMAN_PROFILE.headScale[1]*fuller,HUMAN_PROFILE.headScale[2]*fuller);
      place(legs,i*LIMBS+NECK,0,1.492,.003,.112,.125,.115);
      place(legs,i*LIMBS+COLLAR,0,1.458,.003,.152,.06,.148);
      place(legs,i*LIMBS+HIPS,0,.886,0,.33,.12,.22);
      for(let side=0;side<2;side++) {
        const p=legPoses[side],sign=side?1:-1;
        place(legs,i*LIMBS+side*2,p.x,(HUMAN_PROFILE.hipY+p.ky)/2,p.kz/2,.15,.425,.165,p.thigh);
        place(legs,i*LIMBS+side*2+1,p.x,(p.ky+p.ay)/2,(p.kz+p.az)/2,.118,.405,.132,p.calf);
        // A sole on the deck and a rounded upper, turning as one about the centre of the boot.
        const fc=Math.cos(p.foot),fs=Math.sin(p.foot);
        place(bags,i*2+side,p.x,p.fy-.041*fc,p.fz-.041*fs,.13,.028,.26,p.foot);
        place(legs,i*LIMBS+BOOT+side,p.x,p.fy+.012*fc+.004*fs,p.fz+.012*fs-.004*fc,.122,.24,.1,p.foot-Math.PI/2);
        const upper=-p.thigh*.72;
        const lower=upper-.12-.10*Math.max(0,side?-cadence:cadence);
        const sx=sign*.272,ey=HUMAN_PROFILE.shoulderY-Math.cos(upper)*.29,ez=-Math.sin(upper)*.29;
        const wy=ey-Math.cos(lower)*.27,wz=ez-Math.sin(lower)*.27;
        // The sleeve's rounded top is the shoulder, level with the slope of the jacket.
        place(legs,i*LIMBS+4+side*2,sx,HUMAN_PROFILE.shoulderY-Math.cos(upper)*.145,-Math.sin(upper)*.145,.14,.31,.152,upper,0,-sign*.025);
        place(legs,i*LIMBS+5+side*2,sx,(ey+wy)/2,(ez+wz)/2,.108,.295,.12,lower);
        // A resting hand hangs edge-on to the thigh.
        place(legs,i*LIMBS+HAND+side,sx,wy-.047*Math.cos(lower),wz-.047*Math.sin(lower),.054,.125,.088,lower);
      }
      if(i%3===0){
        const pack=i/3;
        placePackPiece(bodies,crowdCount+pack,TRAVEL_PACK_BODY);
        for(let index=0;index<TRAVEL_PACK_STRAPS.length;index++)placePackPiece(legs,crowdCount*LIMBS+pack*TRAVEL_PACK_STRAPS.length+index,TRAVEL_PACK_STRAPS[index]);
        for(let index=0;index<TRAVEL_PACK_TRIM.length;index++)placePackPiece(bags,crowdCount*2+pack*TRAVEL_PACK_TRIM.length+index,TRAVEL_PACK_TRIM[index]);
      }
    }
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = legs.instanceMatrix.needsUpdate = bags.instanceMatrix.needsUpdate = hair.instanceMatrix.needsUpdate = true;
    contact.end();
    initialized = true;
  }
  update(0, 0);
  function smoothWalk(value){const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);}
  return {group,colliders,layouts,update,obstructs,get behaviorSnapshot(){return commuterBehavior.snapshot(motionTime*CROWD_PACE);},dispose(){
    if(disposed)return;disposed=true;
    ownSignage?.dispose();
    // A district releases what the shared traversal below cannot reach.
    for(const layout of layouts)layout.dispose?.();
    contact.mesh.removeFromParent();contact.dispose();
    const geometries=new Set(),materials=new Set(Object.values(m)),textures=new Set([atlas]);
    group.traverse(node=>{if(!node.isMesh&&!node.isPoints)return;node.dispose?.();geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])materials.add(material);});
    for(const material of materials)for(const item of Object.values(material))if(item?.isTexture)textures.add(item);
    // The panel atlas belongs to the station; the paving sheet is used only here.
    const panels=createSurfaceLibrary();textures.delete(panels.albedo);textures.delete(panels.normal);
    createPavingSurface().dispose();
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());batches.clear();drones.length=0;group.clear();
  }};
}
