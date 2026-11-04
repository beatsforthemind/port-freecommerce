import * as THREE from 'three';
import { label } from './kit.js';
import { createHumanHeadGeometry, createHumanTorsoGeometry, createHumanLimbGeometry, HUMAN_PALETTE, HUMAN_PROFILE } from './humanoid.js';
import { buildObservationDistrict } from './district-observation.js';
import { buildMarketDistrict } from './district-market.js';
import { buildDocksDistrict } from './district-docks.js';

/** Connected station districts, all built locally without model downloads. */
export function createDistricts() {
  const group = new THREE.Group();
  group.name = 'FreeCommerce · outer districts';
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
    glass: new THREE.MeshBasicMaterial({ color: '#69989a', transparent: true, opacity: .045, side: THREE.DoubleSide, depthWrite: false }),
  };
  function box(material, x, y, z, w, h, d, ry = 0) {
    transform.position.set(x, y, z); transform.rotation.set(0, ry, 0); transform.scale.set(w, h, d);
    transform.updateMatrix();
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(transform.matrix.clone());
  }
  function footprint(x, y, z, w, h, d) {
    colliders.push({ minX: x - w / 2 - .25, maxX: x + w / 2 + .25, minZ: z - d / 2 - .25, maxZ: z + d / 2 + .25, minY:y-h/2,maxY:y+h/2 });
  }
  function solid(material, x, y, z, w, h, d, ry = 0) {
    box(material, x, y, z, w, h, d, ry);
    footprint(x,y,z,w,h,d);
  }
  function sign(text, x, y, z, width, height = 1, ry = 0, color = '#eed2a2', background = '#1a2b2d') {
    const mesh = label(text, { width, height, color, background, fontSize: 100 });
    mesh.position.set(x, y, z); mesh.rotation.y = ry; group.add(mesh); return mesh;
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

  const context={box,solid,footprint,sign,mesh,decal,m};
  const layouts=[buildObservationDistrict(context),buildMarketDistrict(context),buildDocksDistrict(context)];

  // Repeated static box work becomes one draw call per material.
  const unitCube = new THREE.BoxGeometry(1, 1, 1);
  for (const [material, matrices] of batches) {
    const instances = new THREE.InstancedMesh(unitCube, material, matrices.length);
    matrices.forEach((matrix, i) => instances.setMatrixAt(i, matrix));
    instances.computeBoundingSphere(); group.add(instances);
  }
  if (decalPositions.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(decalPositions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(decalUVs, 2));
    geometry.computeBoundingSphere();
    const details = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({map: atlas, side: THREE.DoubleSide}));
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

  // Adult proportions and tailored travel layers share the same four batches.
  // Segmented limbs pivot at joints; hands, boots and luggage follow the chain.
  const crowdCount = 20;
  const commuterLanes = [5.2,7.7,7.7,5.2];
  const bodies = new THREE.InstancedMesh(createHumanTorsoGeometry(),mat('#ffffff',{roughness:.9,metalness:0}),crowdCount);
  const heads = new THREE.InstancedMesh(createHumanHeadGeometry(),mat('#ffffff',{roughness:.95,metalness:0,vertexColors:true}),crowdCount);
  const legs = new THREE.InstancedMesh(createHumanLimbGeometry(),mat('#ffffff',{roughness:.92,metalness:0}),crowdCount*8);
  const bags = new THREE.InstancedMesh(unitCube,mat('#ffffff',{roughness:.87,metalness:0}),crowdCount*5+Math.ceil(crowdCount/3));
  bodies.name='Commuters / tailored jackets';
  heads.name='Commuters / oval heads';
  legs.name='Commuters / jointed sleeves and trousers';
  bags.name='Commuters / hands boots and luggage';
  const tint = new THREE.Color();
  const crowdMeshes=[bodies,heads,legs,bags];
  for(const object of crowdMeshes){object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);object.frustumCulled=false;}
  for(let i=0;i<crowdCount;i++) {
    const coat=HUMAN_PALETTE.coats[i%HUMAN_PALETTE.coats.length];
    const trousers=HUMAN_PALETTE.trousers[i%HUMAN_PALETTE.trousers.length];
    const skin=HUMAN_PALETTE.skin[(i*3)%HUMAN_PALETTE.skin.length];
    bodies.setColorAt(i,tint.set(coat));heads.setColorAt(i,tint.set(skin));
    for(let part=0;part<8;part++)legs.setColorAt(i*8+part,tint.set(part<4?trousers:coat));
    for(let part=0;part<5;part++)bags.setColorAt(i*5+part,tint.set(part<3?skin:'#293338'));
    if(i%3===0)bags.setColorAt(crowdCount*5+i/3,tint.set(HUMAN_PALETTE.trim[i%HUMAN_PALETTE.trim.length]));
  }
  for(const object of crowdMeshes){object.instanceColor.needsUpdate=true;group.add(object);}
  const actorMatrix=new THREE.Matrix4(),partMatrix=new THREE.Matrix4();
  const legPoses=[{},{}];
  function place(object,index,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0) {
    transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();
    partMatrix.multiplyMatrices(actorMatrix,transform.matrix);object.setMatrixAt(index,partMatrix);
  }
  const crowdTriangles=crowdMeshes.reduce((sum,object)=>sum+(object.geometry.index?.count??object.geometry.attributes.position.count)/3*object.count,0);
  group.userData.commuters=Object.freeze({actors:crowdCount,drawCalls:4,triangles:crowdTriangles,updateHz:30,adultHeight:HUMAN_PROFILE.height});
  const crowdBounds = new THREE.Box3(new THREE.Vector3(-20,-.5,-97),new THREE.Vector3(20,2.6,63));
  const crowdFrustum = new THREE.Frustum();
  const crowdProjection = new THREE.Matrix4();
  let lastCrowdUpdate = -Infinity;
  let motionTime = 0;
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
    const justShown = crowdVisible && !wasCrowdVisible;
    wasCrowdVisible = crowdVisible;
    for (const mesh of crowdMeshes) mesh.visible = crowdVisible;
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
    lastCrowdUpdate = time;
    for(let i=0;i<crowdCount;i++) {
      const direction=i%2?1:-1;
      const x=(i%2?-1:1)*commuterLanes[i%commuterLanes.length];
      const along=i*19.2+time*direction*.65+1300;
      const z=((along%156)+156)%156-95;
      const phase=time*4.65+i*.83,gait=Math.sin(phase),cadence=Math.cos(phase);
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
      const bob=Math.max(0,-minimumFoot*stature)+Math.abs(Math.sin(phase*2))*.003;
      transform.position.set(x,bob,z);transform.rotation.set(0,direction>0?0:Math.PI,0);transform.scale.set(breadth,stature,breadth);transform.updateMatrix();actorMatrix.copy(transform.matrix);
      place(bodies,i,0,HUMAN_PROFILE.torsoY,0,...HUMAN_PROFILE.torsoScale);
      place(heads,i,0,HUMAN_PROFILE.headY,0,...HUMAN_PROFILE.headScale);
      place(bags,i*5,0,1.49,.005,.105,.10,.10);
      for(let side=0;side<2;side++) {
        const p=legPoses[side],sign=side?1:-1;
        place(legs,i*8+side*2,p.x,(HUMAN_PROFILE.hipY+p.ky)/2,p.kz/2,.135,.425,.15,p.thigh);
        place(legs,i*8+side*2+1,p.x,(p.ky+p.ay)/2,(p.kz+p.az)/2,.105,.405,.12,p.calf);
        place(bags,i*5+3+side,p.x,p.fy,p.fz,.14,.11,.26,p.foot);
        const upper=-p.thigh*.72;
        const lower=upper-.12-.10*Math.max(0,side?-cadence:cadence);
        const sx=sign*.272,ey=HUMAN_PROFILE.shoulderY-Math.cos(upper)*.29,ez=-Math.sin(upper)*.29;
        const wy=ey-Math.cos(lower)*.27,wz=ez-Math.sin(lower)*.27;
        place(legs,i*8+4+side*2,sx,(HUMAN_PROFILE.shoulderY+ey)/2,ez/2,.125,.315,.14,upper,0,-sign*.025);
        place(legs,i*8+5+side*2,sx,(ey+wy)/2,(ez+wz)/2,.095,.295,.11,lower);
        place(bags,i*5+1+side,sx,wy-.047*Math.cos(lower),wz-.047*Math.sin(lower),.078,.115,.075,lower);
        if(side===1&&i%3===0)place(bags,crowdCount*5+i/3,sx+.105,wy-.22,wz-.035,.25,.34,.15,0,0,.035);
      }
    }
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = legs.instanceMatrix.needsUpdate = bags.instanceMatrix.needsUpdate = true;
    initialized = true;
  }
  update(0, 0);
  return {group,colliders,layouts,update,dispose(){
    if(disposed)return;disposed=true;
    const geometries=new Set(),materials=new Set(Object.values(m)),textures=new Set([atlas]);
    group.traverse(node=>{if(!node.isMesh&&!node.isPoints)return;node.dispose?.();geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])materials.add(material);});
    for(const material of materials)for(const item of Object.values(material))if(item?.isTexture)textures.add(item);
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());batches.clear();drones.length=0;group.clear();
  }};
}
