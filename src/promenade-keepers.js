import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createHumanHeadGeometry,createHumanTorsoGeometry,createHumanLimbGeometry,HUMAN_PALETTE,HUMAN_PROFILE} from './humanoid.js';

/** Quiet working poses: sixteen people share one immutable, vertex-colored draw. */
export function buildPromenadeKeepers({group,anchors=[],height=7.625}) {
  const selected=[];
  for(const side of[-1,1]){
    const pool=anchors.filter(anchor=>anchor.side===side),seen=new Set(),picks=[];
    // Represent each trade, then fill remaining places across the retail walk.
    for(const anchor of pool)if(!seen.has(anchor.type)){seen.add(anchor.type);picks.push(anchor);}
    for(let i=pool.length-1;i>=0&&picks.length<8;i--)if(!picks.includes(pool[i]))picks.push(pool[i]);
    selected.push(...picks.slice(0,8).sort((a,b)=>a.z-b.z));
  }
  if(!selected.length)return{stats:{keepers:0,keeperDrawCalls:0,keeperTriangles:0,keeperTextures:0,keeperLights:0,keeperPerFrameUpdates:0},placements:[]};

  const sources={head:createHumanHeadGeometry(),torso:createHumanTorsoGeometry(),limb:createHumanLimbGeometry(),box:new THREE.BoxGeometry(1,1,1)};
  for(const[key,source]of Object.entries(sources)){
    if(source.index){sources[key]=source.toNonIndexed();source.dispose();}
    sources[key].deleteAttribute('uv');
  }
  const pieces=[],placements=[],poseCounts={};
  const actor=new THREE.Object3D(),part=new THREE.Object3D(),combined=new THREE.Matrix4(),up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),tint=new THREE.Color();
  function append(type,color,position,scale,rotation=[0,0,0],quaternion=null){
    const geometry=sources[type].clone(),count=geometry.attributes.position.count;
    const sourceColors=geometry.attributes.color,colors=new Float32Array(count*3);tint.set(color);
    for(let i=0;i<count;i++){
      colors[i*3]=tint.r*(sourceColors?.getX(i)??1);
      colors[i*3+1]=tint.g*(sourceColors?.getY(i)??1);
      colors[i*3+2]=tint.b*(sourceColors?.getZ(i)??1);
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    part.position.set(...position);part.rotation.set(...rotation);if(quaternion)part.quaternion.copy(quaternion);part.scale.set(...scale);part.updateMatrix();
    geometry.applyMatrix4(combined.copy(actor.matrix).multiply(part.matrix));pieces.push(geometry);
  }
  function bone(color,from,to,width,depth){
    a.set(...from);b.set(...to);direction.copy(b).sub(a);part.quaternion.setFromUnitVectors(up,direction.clone().normalize());
    append('limb',color,a.add(b).multiplyScalar(.5).toArray(),[width,direction.length(),depth],[0,0,0],part.quaternion.clone());
  }
  function hand(color,elbow,wrist){
    a.set(...elbow);b.set(...wrist);direction.copy(b).sub(a).normalize();
    const rotation=new THREE.Quaternion().setFromUnitVectors(up,direction);
    append('box',color,b.addScaledVector(direction,.025).toArray(),[.083,.115,.052],[0,0,0],rotation);
  }

  selected.forEach((anchor,index)=>{
    const scale=.97+(index%5)*.015,x=anchor.side*29.25,y=(anchor.y??height)+.13;
    const coat=HUMAN_PALETTE.coats[(index*3+1)%HUMAN_PALETTE.coats.length],skin=HUMAN_PALETTE.skin[(index*3)%HUMAN_PALETTE.skin.length],trousers=HUMAN_PALETTE.trousers[index%4];
    const pose=anchor.type==='food'?'serving':anchor.type==='repair'?'adjusting':anchor.type==='tailoring'?'folding':'reading';
    poseCounts[pose]=(poseCounts[pose]||0)+1;
    actor.position.set(x,y,anchor.z);actor.rotation.set(0,anchor.face??-anchor.side*Math.PI/2,0);actor.scale.setScalar(scale);actor.updateMatrix();
    append('torso',coat,[0,HUMAN_PROFILE.torsoY,.025],[...HUMAN_PROFILE.torsoScale],[.055,0,0]);
    append('head',skin,[0,HUMAN_PROFILE.headY,.045],[...HUMAN_PROFILE.headScale],[pose==='reading'?.16:.07,(index%3-1)*.10,0]);
    append('limb',skin,[0,1.49,.027],[.096,.11,.096]);
    append('box',trousers,[0,.875,0],[.36,.14,.23]);
    append('box',HUMAN_PALETTE.trim[index%4],[0,1.43,.045],[.29,.05,.16]);
    if(pose==='serving'||pose==='folding')append('box','#b1a58c',[0,.97,.167],[.31,.43,.025]);
    for(const sign of[-1,1]){
      const hip=[sign*.105,.88,0],knee=[sign*.112,.51,sign*.015],ankle=[sign*.12,.15,.018];
      bone(trousers,hip,knee,.17,.185);bone(trousers,knee,ankle,.133,.145);
      append('box','#29353a',[sign*.12,.075,.075],[.13,.15,.28]);
    }
    const wrists=pose==='reading'?[[-.16,1.25,.37],[.16,1.25,.37]]:pose==='adjusting'?[[-.16,1.20,.43],[.13,1.29,.42]]:pose==='folding'?[[-.20,1.20,.43],[.20,1.20,.43]]:[[-.17,1.22,.44],[.17,1.24,.48]];
    for(let side=0;side<2;side++){
      const sign=side?1:-1,shoulder=[sign*.235,1.37,.025],elbow=[sign*.27,1.105,.15],wrist=wrists[side];
      bone(coat,shoulder,elbow,.145,.158);bone(coat,elbow,wrist,.112,.123);
      append('box',coat,elbow,[.112,.112,.112]);hand(skin,elbow,wrist);
    }
    if(pose==='reading'){
      append('box','#3d4f51',[0,1.25,.405],[.30,.025,.23],[-.22,0,0]);
      append('box','#b5bda7',[0,1.269,.405],[.25,.012,.18],[-.22,0,0]);
    }else if(pose==='adjusting'){
      append('box','#b5a888',[.13,1.29,.48],[.035,.035,.20],[.18,0,0]);
      append('box','#425954',[-.16,1.17,.43],[.19,.055,.16]);
    }else if(pose==='folding')append('box','#8a8071',[0,1.17,.455],[.43,.035,.22],[-.09,0,0]);
    else append('box','#b4b09a',[0,1.195,.48],[.37,.028,.22]);
    placements.push({id:anchor.id,side:anchor.side,x,y,z:anchor.z,height:HUMAN_PROFILE.height*scale,pose});
  });

  const geometry=mergeGeometries(pieces);pieces.forEach(piece=>piece.dispose());Object.values(sources).forEach(source=>source.dispose());
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,metalness:.02});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Deck 02 / sixteen working stallkeepers';mesh.matrixAutoUpdate=false;group.add(mesh);
  // The station's normal traversal owns the merged geometry and material.
  return{placements,stats:{keepers:selected.length,keeperWest:selected.filter(anchor=>anchor.side<0).length,keeperEast:selected.filter(anchor=>anchor.side>0).length,keeperPoseCounts:poseCounts,keeperDrawCalls:1,keeperTriangles:geometry.attributes.position.count/3,keeperTextures:0,keeperLights:0,keeperPerFrameUpdates:0}};
}
