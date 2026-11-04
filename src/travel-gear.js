import * as THREE from 'three';

// One fitted pack language for both crowds. Descriptors are torso-local; none
// of these pieces follows a hand or forearm as the walking pose changes.
const pieces=[];
const add=(type,role,position,scale,rotation=[0,0,0])=>pieces.push(Object.freeze({
  type,role,x:position[0],y:position[1],z:position[2],
  sx:scale[0],sy:scale[1],sz:scale[2],rx:rotation[0],ry:rotation[1],rz:rotation[2],
}));

add('torso','body',[0,1.16,-.235],[.27,.32,.12]);
const up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3(),rotation=new THREE.Euler(),quaternion=new THREE.Quaternion();
function strap(role,from,to){
  direction.set(to[0]-from[0],to[1]-from[1],to[2]-from[2]);
  const length=direction.length();quaternion.setFromUnitVectors(up,direction.multiplyScalar(1/length));rotation.setFromQuaternion(quaternion);
  add('limb',role,from.map((value,index)=>(value+to[index])/2),[.032,length+.008,.014],[rotation.x,rotation.y,rotation.z]);
}
for(const side of[-1,1]){
  const label=side<0?'left':'right';
  strap(`front-strap-${label}`, [side*.105,1.00,.153],[side*.12,1.445,.153]);
  strap(`shoulder-strap-${label}`, [side*.12,1.445,.153],[side*.12,1.445,-.16]);
  strap(`rear-strap-${label}`, [side*.12,1.445,-.16],[side*.095,1.30,-.195]);
}
add('box','flap',[0,1.265,-.301],[.215,.048,.012]);
add('box','fastener',[0,1.205,-.310],[.033,.045,.012]);

export const TRAVEL_PACK_PARTS=Object.freeze(pieces);
export const TRAVEL_PACK_STRAPS=Object.freeze(pieces.filter(piece=>piece.type==='limb'));
export const TRAVEL_PACK_TRIM=Object.freeze(pieces.filter(piece=>piece.type==='box'));
export const TRAVEL_PACK_BODY=pieces[0];
export function travelPackColor(index){return index%3===0?(index%2?'#89694f':'#68786b'):'#58685f';}
export function travelPackPieceColor(piece,index){return piece.role==='body'?travelPackColor(index):piece.role==='flap'?'#888773':piece.role==='fastener'?'#b0ad96':'#3c4440';}
