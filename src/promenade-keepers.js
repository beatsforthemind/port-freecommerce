import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createHumanHeadGeometry,createHumanHairGeometry,createHumanTorsoGeometry,createHumanLimbGeometry,HUMAN_PALETTE,HUMAN_PROFILE} from './humanoid.js';

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

  const sources={head:createHumanHeadGeometry(),cap:createHumanHairGeometry(),torso:createHumanTorsoGeometry(),limb:createHumanLimbGeometry(),box:new THREE.BoxGeometry(1,1,1)};
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
    // The limb shape narrows toward its lower end: turned about, that end is the fingertips.
    const rotation=new THREE.Quaternion().setFromUnitVectors(up,direction.clone().negate());
    append('limb',color,b.addScaledVector(direction,.04).toArray(),[.086,.125,.05],[0,0,0],rotation);
  }

  selected.forEach((anchor,index)=>{
    const scale=.97+(index%5)*.015,x=anchor.side*29.25,y=(anchor.y??height)+.13;
    const coat=HUMAN_PALETTE.coats[(index*3+1)%HUMAN_PALETTE.coats.length],skin=HUMAN_PALETTE.skin[(index*3)%HUMAN_PALETTE.skin.length],trousers=HUMAN_PALETTE.trousers[index%4];
    const pose=anchor.type==='food'?'serving':anchor.type==='repair'?'adjusting':anchor.type==='tailoring'?'folding':'reading';
    poseCounts[pose]=(poseCounts[pose]||0)+1;
    actor.position.set(x,y,anchor.z);actor.rotation.set(0,anchor.face??-anchor.side*Math.PI/2,0);actor.scale.setScalar(scale);actor.updateMatrix();
    append('torso',coat,[0,HUMAN_PROFILE.torsoY,.025],[...HUMAN_PROFILE.torsoScale],[.055,0,0]);
    const nod=[pose==='reading'?.16:.07,(index%3-1)*.10,0],fuller=index%3===1?1.06:1;
    append('head',skin,[0,HUMAN_PROFILE.headY,.045],[...HUMAN_PROFILE.headScale],nod);
    append('cap',HUMAN_PALETTE.hair[(index*3+1)%HUMAN_PALETTE.hair.length],[0,HUMAN_PROFILE.headY,.045],HUMAN_PROFILE.headScale.map(value=>value*fuller),nod);
    // Neck, a stand collar and rounded hips; servers and tailors wear an apron hung clear of the chest.
    append('limb',skin,[0,1.492,.03],[.112,.125,.115]);
    append('limb',HUMAN_PALETTE.trim[index%4],[0,1.456,.03],[.152,.06,.148]);
    append('limb',trousers,[0,.886,0],[.33,.12,.22]);
    if(pose==='serving'||pose==='folding')append('box','#b1a58c',[0,.97,.162],[.26,.43,.02]);
    for(const sign of[-1,1]){
      const hip=[sign*.105,.88,0],knee=[sign*.112,.51,sign*.015],ankle=[sign*.12,.15,.018];
      bone(trousers,hip,knee,.17,.185);bone(trousers,knee,ankle,.133,.145);
      // A boot: a sole on the deck and a rounded upper, taller at the heel than at the toe.
      append('box','#1d2325',[sign*.12,.014,.075],[.13,.028,.28]);
      append('limb','#29353a',[sign*.12,.09,.071],[.122,.26,.14],[-Math.PI/2,0,0]);
    }
    const wrists=pose==='reading'?[[-.16,1.25,.37],[.16,1.25,.37]]:pose==='adjusting'?[[-.16,1.20,.43],[.13,1.29,.42]]:pose==='folding'?[[-.20,1.20,.43],[.20,1.20,.43]]:[[-.17,1.22,.44],[.17,1.24,.48]];
    for(let side=0;side<2;side++){
      const sign=side?1:-1,shoulder=[sign*.235,1.37,.025],elbow=[sign*.27,1.105,.15],wrist=wrists[side];
      bone(coat,shoulder,elbow,.145,.158);bone(coat,elbow,wrist,.112,.123);
      append('limb',coat,elbow,[.116,.116,.124]);hand(skin,elbow,wrist);
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
