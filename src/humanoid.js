import * as THREE from 'three';

/** Shared, deliberately restrained character language; factories own no caches. */
export const HUMAN_PALETTE = Object.freeze({
  coats: ['#526563','#8b705b','#7d8181','#a09278','#4d5968','#796268','#a87351','#536054'],
  trousers: ['#333e43','#43484a','#4c4e49','#384744'],
  skin: ['#d6b29b','#bb8b6b','#a57656','#82583f','#674534','#49332c','#c69a80'],
  hair: ['#302c29','#514137','#77746b'],
  trim: ['#b4ad96','#766f60','#363d3e','#8d9b8c'],
});

export const HUMAN_PROFILE = Object.freeze({
  height: 1.78, headY: 1.65, headScale: Object.freeze([.105,.13,.115]),
  torsoY: 1.17, torsoScale: Object.freeze([.49,.55,.29]),
  shoulderY: 1.38, hipY: .88,
});

function loft(rings, sides, caps = true) {
  const positions=[],indices=[];
  for(const [y,width,depth,zOffset] of rings)for(let i=0;i<sides;i++) {
    const angle=(i+.5)*Math.PI*2/sides;
    positions.push(Math.sin(angle)*width,y,Math.cos(angle)*depth+zOffset);
  }
  for(let ring=0;ring<rings.length-1;ring++)for(let i=0;i<sides;i++) {
    const a=ring*sides+i,b=ring*sides+(i+1)%sides,c=a+sides,d=b+sides;
    indices.push(a,d,c,a,b,d);
  }
  if(caps)for(const [ring,top] of [[0,false],[rings.length-1,true]])for(let i=1;i<sides-1;i++) {
    const first=ring*sides;
    if(top)indices.push(first,first+i,first+i+1);else indices.push(first,first+i+1,first+i);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

/** Radius-style bounds approximately ±1; scale by HUMAN_PROFILE.headScale. */
export function createHumanHeadGeometry({hair = true} = {}) {
  // A short, broad chin and a bevelled crown avoid a pointed mask silhouette.
  const source=loft([[-1,.46,.5,.18],[-.52,.86,.9,.03],[.46,1,1,-.015],[1,.55,.58,-.08]],8);
  const positions=Array.from(source.attributes.position.array),indices=Array.from(source.index.array);
  // A shallow nasal plane gives profile direction without eye or mouth decals.
  const nose=positions.length/3;positions.push(0,-.1,1.045);
  const a=15,b=8,c=23,d=16;
  indices.splice((8+7)*6,6,a,b,nose,b,d,nose,d,c,nose,c,a,nose);
  source.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));source.setIndex(indices);source.computeVertexNormals();
  const geometry=source.toNonIndexed();source.dispose();
  const p=geometry.attributes.position,colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i+=3) {
    const y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;
    const z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
    const cropped=hair&&(y>.53||(z<.08&&y>-.3));
    for(let j=0;j<3;j++)colors.set(cropped?[.12,.105,.095]:[1,1,1],(i+j)*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

/** Unit-height tailored jacket: broader shoulders, waist and a gentle hem. */
export function createHumanTorsoGeometry() {
  const geometry=loft([[-.5,.37,.46,0],[.36,.5,.5,0],[.5,.31,.38,-.015]],4);
  // A four-sided diagonal ring is normalized to an actual unit width/depth.
  geometry.scale(Math.SQRT2,1,Math.SQRT2);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

/** Eight triangles; open ends disappear inside the adjoining joint or garment. */
export function createHumanLimbGeometry() {
  const geometry=loft([[-.5,.38,.4,0],[.5,.5,.5,0]],4,false);
  geometry.scale(Math.SQRT2,1,Math.SQRT2);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
