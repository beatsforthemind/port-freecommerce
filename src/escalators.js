import * as THREE from 'three';
import {ESCALATORS,ESCALATOR_FLAT,ESCALATOR_SPEED} from './escalator-layout.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

/** Six open escalators share two immutable instance buffers and GPU step motion. */
export function createEscalators({routes=ESCALATORS,speed=ESCALATOR_SPEED,flat=ESCALATOR_FLAT}={}) {
  const group=new THREE.Group();group.name='Concourse / moving escalator treads';
  const surfaces=[],colliders=[],lanes=[];
  let disposed=false,carrying=false,lastTransport=null,uniformUpdates=0;
  const progress=new Float32Array(routes.length),uniform={value:progress};

  for(const [index,route]of routes.entries()){
    const run=Math.abs(route.topZ-route.bottomZ),sign=Math.sign(route.topZ-route.bottomZ);
    const length=run+flat*2,count=Math.ceil(length/.44),pitch=length/count;
    const transport={id:route.id,vx:0,vz:sign*route.direction*speed};
    lanes.push({route,index,run,sign,length,count,pitch,transport});
    surfaces.push({sector:'concourse',level:'promenade',escalator:route.id,priority:10,
      minX:route.x-route.width/2,maxX:route.x+route.width/2,
      minZ:Math.min(route.topZ,route.bottomZ),maxZ:Math.max(route.topZ,route.bottomZ),
      axis:'z',start:route.bottomZ,end:route.topZ,from:route.bottomHeight,to:route.topHeight});
  }
  const count=lanes.reduce((sum,lane)=>sum+lane.count,0);
  const routeData=new Float32Array(count*4),dimensions=new Float32Array(count*3),phases=new Float32Array(count),indices=new Float32Array(count);
  let cursor=0;
  for(const lane of lanes)for(let step=0;step<lane.count;step++){
    routeData.set([lane.route.x,lane.route.bottomZ,lane.route.topZ,lane.route.topHeight-lane.route.bottomHeight],cursor*4);
    dimensions.set([lane.route.width,lane.pitch,lane.route.topHeight/lane.run*lane.pitch+.025],cursor*3);
    phases[cursor]=step*lane.pitch;indices[cursor]=lane.index;cursor++;
  }
  const attributes={aEscRoute:new THREE.InstancedBufferAttribute(routeData,4),aEscDimensions:new THREE.InstancedBufferAttribute(dimensions,3),aEscPhase:new THREE.InstancedBufferAttribute(phases,1),aEscLane:new THREE.InstancedBufferAttribute(indices,1)};
  const bodyGeometry=new THREE.BoxGeometry(1,1,1);bodyGeometry.translate(0,-.5,0);
  const edgeGeometry=new THREE.PlaneGeometry(.96,.07);edgeGeometry.rotateX(-Math.PI/2);edgeGeometry.translate(0,.02,.47);
  for(const geometry of[bodyGeometry,edgeGeometry])for(const [name,attribute]of Object.entries(attributes))geometry.setAttribute(name,attribute);

  const bodyMaterial=new THREE.MeshStandardMaterial({color:'#59696a',roughness:.68,metalness:.46});
  const edgeMaterial=new THREE.MeshBasicMaterial({color:'#e1bd83',toneMapped:false,side:THREE.DoubleSide});
  function animateMaterial(material,grooves){
    material.onBeforeCompile=shader=>{
      shader.uniforms.uEscTravel=uniform;
      shader.vertexShader=`attribute vec4 aEscRoute;
attribute vec3 aEscDimensions;
attribute float aEscPhase;
attribute float aEscLane;
uniform float uEscTravel[${Math.max(1,routes.length)}];
varying vec3 vEscLocal;
varying float vEscTop;
${shader.vertexShader}`;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
float run=abs(aEscRoute.z-aEscRoute.y);
float path=run+${(flat*2).toFixed(6)};
float along=mod(aEscPhase+uEscTravel[int(aEscLane)]+path,path)-${flat.toFixed(6)};
float routeSign=sign(aEscRoute.z-aEscRoute.y);
vec3 transformed=vec3(aEscRoute.x+position.x*aEscDimensions.x,
  clamp(along/run,0.0,1.0)*aEscRoute.w+position.y*aEscDimensions.z+0.012,
  aEscRoute.y+routeSign*along+position.z*aEscDimensions.y*1.015);
vEscLocal=position;
vEscTop=step(0.5,normal.y);`);
      if(grooves){
        shader.fragmentShader=`varying vec3 vEscLocal;\nvarying float vEscTop;\n${shader.fragmentShader}`;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float treadGroove=smoothstep(0.16,0.34,fract(vEscLocal.x*44.0));
diffuseColor.rgb*=mix(1.0,0.76+0.24*treadGroove,vEscTop);`);
      }
    };
    material.customProgramCacheKey=()=>`pfc-escalator-${grooves?'treads':'edges'}-${routes.length}-${flat}`;
  }
  animateMaterial(bodyMaterial,true);animateMaterial(edgeMaterial,false);
  const bodies=new THREE.InstancedMesh(bodyGeometry,bodyMaterial,count),edges=new THREE.InstancedMesh(edgeGeometry,edgeMaterial,count);
  bodies.name='Escalators / grooved moving steps';edges.name='Escalators / moving safety nosings';
  const identity=new THREE.Matrix4(),bounds=new THREE.Box3();
  for(const lane of lanes){
    const route=lane.route;
    bounds.expandByPoint(new THREE.Vector3(route.x-route.width/2,-.35,Math.min(route.topZ,route.bottomZ)-flat-.3));
    bounds.expandByPoint(new THREE.Vector3(route.x+route.width/2,route.topHeight+.05,Math.max(route.topZ,route.bottomZ)+flat+.3));
  }
  for(const mesh of[bodies,edges]){
    for(let i=0;i<count;i++)mesh.setMatrixAt(i,identity);
    mesh.instanceMatrix.needsUpdate=true;
    mesh.boundingBox=bounds.clone();mesh.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
    mesh.matrixAutoUpdate=false;group.add(mesh);
  }

  function laneAt(x,z,feet){
    if(![x,z,feet].every(Number.isFinite))return null;
    for(const lane of lanes){
      const route=lane.route,along=(z-route.bottomZ)*lane.sign;
      if(Math.abs(x-route.x)>route.width/2-.27+1e-6||along<-.98||along>lane.run+.98)continue;
      const height=route.bottomHeight+clamp(along/lane.run,0,1)*(route.topHeight-route.bottomHeight);
      if(Math.abs(height-feet)>.32)continue;
      return lane;
    }
    return null;
  }
  const api={
    group,surfaces,colliders,
    update(dt,{camera,controls,mode='exploring',reducedMotion=false,hidden=false}={}){
      if(disposed)return;
      carrying=mode==='exploring'&&!reducedMotion&&!hidden;
      const lane=camera?laneAt(camera.position.x,camera.position.z,controls?.floorHeight??camera.position.y-1.75):null;
      lastTransport=carrying?lane?.route.id||null:null;
      if(hidden||reducedMotion||!['arrival','exploring'].includes(mode))return;
      const delta=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));
      if(!delta)return;
      for(const lane of lanes)progress[lane.index]=(progress[lane.index]+delta*speed*lane.route.direction+lane.length)%lane.length;
      uniformUpdates++;
    },
    transportAt(x,z,feet){
      if(disposed||!carrying)return null;
      return laneAt(x,z,feet)?.transport||null;
    },
    get snapshot(){return{enabled:carrying,lastTransport,progress:Array.from(progress),routes:routes.map(({id,direction,x,topZ,bottomZ})=>({id,direction,x,topZ,bottomZ}))};},
    get stats(){return{units:routes.length,steps:count,drawCalls:disposed?0:2,triangles:count*14,textures:0,lights:0,
      shaderAnimated:true,perFrameMatrixUploads:0,initialMatrixUploads:2,uniformUpdates,disposed,...api.snapshot};},
    dispose(){
      if(disposed)return;disposed=true;carrying=false;lastTransport=null;
      bodies.dispose();edges.dispose();bodyGeometry.dispose();edgeGeometry.dispose();bodyMaterial.dispose();edgeMaterial.dispose();group.clear();
    },
  };
  return api;
}
