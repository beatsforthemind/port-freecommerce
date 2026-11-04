import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CONCOURSE_LEVELS,PUBLIC_LIFT_SHAFTS,PUBLIC_LIFT_LAYOUT} from './concourse-levels.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ease=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const LEVELS=new Map(CONCOURSE_LEVELS.map(level=>[level.id,level]));
const DOOR_SECONDS=.65;

/** Two small panoramic cars. All geometry is local, and idle matrices stay put. */
export function createPublicLifts({onStateChange}={}) {
  const group=new THREE.Group();group.name='Public lantern lifts';
  const surfaces=[],colliders=[],geometries=new Set(),meshes=[];
  const materials={
    steel:new THREE.MeshStandardMaterial({color:'#657573',roughness:.58,metalness:.52}),
    dark:new THREE.MeshStandardMaterial({color:'#213438',roughness:.72,metalness:.3}),
    amber:new THREE.MeshBasicMaterial({color:'#dfb47d'}),
    glass:new THREE.MeshBasicMaterial({color:'#b4cfc0',transparent:true,opacity:.095,depthWrite:false,side:THREE.DoubleSide}),
  };
  materials.glass.forceSinglePass=true;
  const unit=new THREE.BoxGeometry(1,1,1);geometries.add(unit);
  const object=new THREE.Object3D(),staticBoxes={steel:[],amber:[]};
  let disposed=false,rider=null,lastCamera=null,lastControls=null,matrixUploads=0,rides=0,calls=0;
  const cars=[];

  function matrix(x,y,z,w,h,d){object.position.set(x,y,z);object.rotation.set(0,0,0);object.scale.set(w,h,d);object.updateMatrix();return object.matrix;}
  function staticBox(material,x,y,z,w,h,d){staticBoxes[material].push(matrix(x,y,z,w,h,d).clone());}
  function collider(minX,maxX,minZ,maxZ,minY,maxY){const c={minX,maxX,minZ,maxZ,minY,maxY};colliders.push(c);return c;}
  function boxPiece(list,x,y,z,w,h,d){const geometry=unit.clone();geometry.applyMatrix4(matrix(x,y,z,w,h,d));list.push(geometry);}
  function merged(list,material,name){const geometry=mergeGeometries(list);list.forEach(g=>g.dispose());geometries.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.name=name;meshes.push(mesh);return mesh;}
  const top=CONCOURSE_LEVELS[CONCOURSE_LEVELS.length-1].height+3.5;
  for(const shaft of PUBLIC_LIFT_SHAFTS){
    const side=shaft.side,carGroup=new THREE.Group();carGroup.name=shaft.name+' / car';group.add(carGroup);
    const body=[],glass=[];
    // The inward lip meets the fixed threshold. Roof and walls stay outside
    // the threshold envelope, so they never sweep through a landing slab.
    boxPiece(body,-side*.025,-.09,0,2.95,.18,3.3);
    boxPiece(body,-side*1.525,-.055,0,.15,.11,2.55);
    boxPiece(body,0,3.03,0,2.9,.12,3.3);
    for(const sx of[-1,1])for(const sz of[-1,1])boxPiece(body,sx*1.4,1.5,sz*1.6,.075,3,.075);
    boxPiece(body,side*1.4,1.08,0,.07,.07,3.15);
    for(const sz of[-1,1])boxPiece(body,0,1.08,sz*1.6,2.8,.07,.07);
    for(const sz of[-1,1])boxPiece(glass,0,1.7,sz*1.615,2.7,2.25,.018);
    boxPiece(glass,side*1.415,1.7,0,.018,2.25,3.12);
    carGroup.add(merged(body,materials.steel,shaft.name+' / frame'),merged(glass,materials.glass,shaft.name+' / glazing'));
    const floor={sector:'concourse',minX:shaft.x-1.45,maxX:shaft.x+1.45,minZ:shaft.z-1.65,maxZ:shaft.z+1.65,height:0,lift:shaft.id};
    // Include the narrow front lip in the floor union.
    if(side>0)floor.minX=shaft.x-1.6;else floor.maxX=shaft.x+1.6;
    surfaces.push(floor);
    const blockers=[],interactions=[],walls=[];
    for(const level of CONCOURSE_LEVELS){
      const lo=side>0?26.35:-26.9,hi=side>0?26.9:-26.35;
      surfaces.push({sector:'concourse',minX:lo,maxX:hi,minZ:shaft.z-1.2,maxZ:shaft.z+1.2,height:level.height,liftThreshold:shaft.id});
      staticBox('steel',(lo+hi)/2,level.height-.075,shaft.z,hi-lo,.15,2.4);
      // Every absent car closes the complete bay, rather than relying on old
      // decorative floor rectangles that still overlap the physical opening.
      blockers.push(collider(shaft.minX,shaft.maxX,shaft.minZ,shaft.maxZ,level.height+.015,level.height+2.5));
      const gateX=shaft.entranceX;
      for(const dz of[-1.32,1.32])staticBox('steel',gateX,level.height+1.3,shaft.z+dz,.14,2.6,.13);
      for(const dz of[-1.95,1.95])staticBox('steel',gateX+.13*side,level.height+1.3,shaft.z+dz,.12,2.6,1.2);
      staticBox('steel',gateX,level.height+2.61,shaft.z,.15,.16,2.78);
      staticBox('steel',gateX-side*.18,level.height+1.18,shaft.z+1.63,.16,.42,.24);
      staticBox('amber',gateX-side*.275,level.height+1.21,shaft.z+1.63,.035,.13,.13);
      interactions.push({id:`lift-${shaft.id}-${level.id}`,shaftId:shaft.id,levelId:level.id,action:'call',inside:false,hint:`Call the ${shaft.name.toLowerCase()}`});
    }
    // Rear and side walls protect every height, including the highest stop.
    const rear=shaft.x+side*1.72;
    collider(rear-.08,rear+.08,shaft.minZ,shaft.maxZ,-.25,top);
    for(const zz of[shaft.minZ+.06,shaft.maxZ-.06])collider(shaft.minX,shaft.maxX,zz-.07,zz+.07,-.25,top);
    // Retracted door leaves occupy these protected side pockets outside the
    // narrower slab opening; a passerby cannot walk through an open leaf.
    const pocketA=shaft.entranceX-side*.3,pocketB=shaft.entranceX+side*.36;
    for(const [a,b]of[[shaft.z-2.5,shaft.z-1.2],[shaft.z+1.2,shaft.z+2.5]])collider(Math.min(pocketA,pocketB),Math.max(pocketA,pocketB),a,b,-.25,top);
    const back=shaft.x+side*1.415;
    walls.push(collider(back-.04,back+.04,shaft.z-1.65,shaft.z+1.65,.015,3.08));
    for(const zz of[shaft.z-1.615,shaft.z+1.615])walls.push(collider(shaft.x-1.45,shaft.x+1.45,zz-.04,zz+.04,.015,3.08));
    for(const dx of[-1.72,1.72])for(const dz of[-1.87,1.87])staticBox('steel',shaft.x+dx,top/2,shaft.z+dz,.11,top,.11);
    for(const level of CONCOURSE_LEVELS)staticBox('amber',shaft.x+side*1.6,level.height+1.7,shaft.z,.05,.12,3.55);
    cars.push({shaft,group:carGroup,floor,blockers,interactions,walls,height:0,level:CONCOURSE_LEVELS[0],target:null,state:'idle',doors:1,clock:0,start:0,duration:0,rideControls:null});
    carGroup.position.set(shaft.x,0,shaft.z);
  }
  for(const [key,matrices]of Object.entries(staticBoxes)){
    const mesh=new THREE.InstancedMesh(unit,materials[key],matrices.length);mesh.name='Lantern lifts / '+key;matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();group.add(mesh);meshes.push(mesh);
  }
  const gateMesh=new THREE.InstancedMesh(unit,materials.dark,cars.length*CONCOURSE_LEVELS.length*2);
  gateMesh.name='Lantern lifts / landing gates';gateMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);gateMesh.frustumCulled=false;group.add(gateMesh);meshes.push(gateMesh);
  const carDoors=new THREE.InstancedMesh(unit,materials.dark,cars.length*2);
  carDoors.name='Lantern lifts / cabin doors';carDoors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);carDoors.frustumCulled=false;group.add(carDoors);meshes.push(carDoors);
  function emit(){try{onStateChange?.(api.snapshot);}catch{/* Interface errors must not interrupt the lift. */}}
  function syncGeometry(){
    let gate=0,door=0;
    for(const car of cars){
      car.group.position.y=car.height;car.floor.height=car.height;
      for(const wall of car.walls){wall.minY=car.height+.015;wall.maxY=car.height+3.08;}
      const open=car.state==='idle'&&car.doors>=.999;
      for(let i=0;i<CONCOURSE_LEVELS.length;i++){
        const level=CONCOURSE_LEVELS[i],docked=Math.abs(car.height-level.height)<.001&&car.level.id===level.id;
        const amount=docked?car.doors:0;
        for(const sign of[-1,1])gateMesh.setMatrixAt(gate++,matrix(car.shaft.entranceX,level.height+1.22,car.shaft.z+sign*(.6+amount*1.25),.075,2.4,1.18));
        const block=car.blockers[i];block.minY=open&&docked?1e6:level.height+.015;block.maxY=open&&docked?1e6+1:level.height+2.5;
      }
      for(const sign of[-1,1])carDoors.setMatrixAt(door++,matrix(car.shaft.x-car.shaft.side*1.52,car.height+1.22,car.shaft.z+sign*(.6+car.doors*1.25),.055,2.4,1.18));
    }
    gateMesh.instanceMatrix.needsUpdate=carDoors.instanceMatrix.needsUpdate=true;matrixUploads++;
  }
  function inside(car,position){return Boolean(position&&Math.abs(position.x-car.shaft.x)<=1.12&&Math.abs(position.z-car.shaft.z)<=1.31&&Math.abs(position.y-1.75-car.height)<.55);}
  function finish(car){
    car.height=car.target.height;car.level=car.target;car.target=null;car.state='idle';car.doors=1;car.clock=0;
    if(rider===car){car.rideControls?.setRideHeight(car.height);car.rideControls?.endRide({height:car.height});car.rideControls=null;rider=null;}
    syncGeometry();emit();
  }
  function begin(car,level,quick){
    car.target=level;car.start=car.height;car.clock=0;car.duration=Math.max(1.8,Math.abs(level.height-car.height)*.6);car.state='closing';
    if(quick)finish(car);else{syncGeometry();emit();}
  }
  const answer=(ok,status,message)=>({ok,status,message});
  const api={
    group,surfaces,colliders,
    get riding(){return Boolean(rider);},
    get snapshot(){return {riding:rider?.shaft.id||null,cars:cars.map(car=>({id:car.shaft.id,height:car.height,levelId:car.level.id,targetId:car.target?.id||null,state:car.state,doors:car.doors,occupied:inside(car,lastCamera?.position)}))};},
    get stats(){return {carCount:cars.length,stops:CONCOURSE_LEVELS.length,drawCalls:meshes.length,triangles:meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1),0),textures:0,lights:0,matrixUploads,rides,calls,disposed,...api.snapshot};},
    getInteraction(position){
      if(disposed||rider||!position)return null;
      const feet=position.y-1.75;
      const level=CONCOURSE_LEVELS.find(l=>Math.abs(l.height-feet)<.6);if(!level)return null;
      let best=null,distance=Infinity;
      for(const car of cars){
        const dx=position.x-(car.shaft.entranceX-car.shaft.side*.6),dz=position.z-car.shaft.z,d=dx*dx+dz*dz;
        const aboard=car.state==='idle'&&car.level.id===level.id&&inside(car,position);
        if((!aboard&&d>8.4)||d>=distance)continue;
        const entry=car.interactions[CONCOURSE_LEVELS.indexOf(level)];
        entry.inside=aboard;entry.action=aboard?'choose':'call';
        entry.hint=aboard?'Choose a concourse deck':car.state!=='idle'?`${car.shaft.name} · traveling`:car.level.id===level.id?'Enter the lantern lift':`Call the ${car.shaft.name.toLowerCase()}`;
        best=entry;distance=d;
      }
      return best;
    },
    call(shaftId,levelId,{reducedMotion=false}={}){
      const car=cars.find(c=>c.shaft.id===shaftId),level=LEVELS.get(levelId);
      if(disposed||!car||!level)return answer(false,'unavailable','That lift is unavailable.');
      if(car.state!=='idle')return answer(false,'busy','The lift is traveling. Please wait.');
      if(car.level.id===level.id)return answer(true,'ready','The lift is here. Step inside to choose a deck.');
      if(inside(car,lastCamera?.position))return answer(false,'occupied','Choose a deck from inside the lift.');
      calls++;begin(car,level,reducedMotion);return reducedMotion?answer(true,'ready','The lift is here. Step inside to choose a deck.'):answer(true,'called',`${car.shaft.name} is on its way.`);
    },
    startRide(shaftId,levelId,controls=lastControls,{reducedMotion=false}={}){
      const car=cars.find(c=>c.shaft.id===shaftId),level=LEVELS.get(levelId);
      if(disposed||!car||!level||!controls)return answer(false,'unavailable','That lift is unavailable.');
      if(rider||car.state!=='idle')return answer(false,'busy','The lift is traveling. Please wait.');
      if(!inside(car,lastCamera?.position))return answer(false,'not-aboard','Step fully inside the lift to travel.');
      if(level.id===car.level.id)return answer(true,'already-there','You are already on this deck.');
      if(!controls.beginRide({x:lastCamera.position.x,z:lastCamera.position.z,height:car.height}))return answer(false,'unavailable','The lift could not start.');
      rider=car;car.rideControls=controls;rides++;begin(car,level,reducedMotion);return reducedMotion?answer(true,'arrived',`Arrived at ${level.label.toLowerCase()}.`):answer(true,'riding',`Traveling to ${level.label.toLowerCase()}.`);
    },
    update(dt,environment={}){
      if(disposed)return;
      if(environment.camera)lastCamera=environment.camera;if(environment.controls)lastControls=environment.controls;
      if((environment.mode&&environment.mode!=='exploring')||environment.hidden||(typeof document!=='undefined'&&document.hidden))return;
      let changed=false;
      for(const car of cars){
        if(car.state==='idle')continue;
        if(environment.reducedMotion){finish(car);changed=true;continue;}
        car.clock+=clamp(Number.isFinite(dt)?dt:0,0,.05);changed=true;
        if(car.state==='closing'){
          car.doors=1-ease(car.clock/DOOR_SECONDS);
          if(car.clock>=DOOR_SECONDS){car.doors=0;car.state='traveling';car.clock=0;emit();}
        }else if(car.state==='traveling'){
          car.height=car.start+(car.target.height-car.start)*ease(car.clock/car.duration);
          car.rideControls?.setRideHeight(car.height);
          if(car.clock>=car.duration){car.height=car.target.height;car.level=car.target;car.state='opening';car.clock=0;emit();}
        }else if(car.state==='opening'){
          car.doors=ease(car.clock/DOOR_SECONDS);
          if(car.clock>=DOOR_SECONDS){finish(car);changed=false;}
        }
      }
      if(changed)syncGeometry();
    },
    cancelRide(controls=lastControls){
      if(!rider){controls?.cancelRide?.();return false;}
      const car=rider;
      let level=CONCOURSE_LEVELS[0];for(const candidate of CONCOURSE_LEVELS)if(Math.abs(candidate.height-car.height)<Math.abs(level.height-car.height))level=candidate;
      car.target=level;finish(car);return true;
    },
    dispose(){
      if(disposed)return;api.cancelRide();disposed=true;
      for(const mesh of meshes)mesh.dispose?.();for(const geometry of geometries)geometry.dispose();for(const material of Object.values(materials))material.dispose();
      group.clear();meshes.length=cars.length=surfaces.length=colliders.length=0;geometries.clear();lastCamera=lastControls=null;
    },
  };
  syncGeometry();return api;
}
