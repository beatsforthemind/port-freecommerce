import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PROMENADE_HEIGHT = 7.625;
export const RAMP_SOUTH = 94;
export const RAMP_NORTH = 56;

/** A usable second deck turns the concourse into a transport interchange. */
export function buildConcourseAccess({group, box, beam, text, materials}) {
  const h = PROMENADE_HEIGHT;
  const surfaces = [
    {sector:'concourse',minX:-22.6,maxX:22.6,minZ:-130.2,maxZ:98.8,height:0},
    {sector:'market',minX:-33,maxX:-30.5,minZ:18.5,maxZ:41.5,height:0},
  ];
  const ramps = [];
  for (const side of [-1,1]) {
    const x = side * 25.6, minX = x - 3, maxX = x + 3;
    // The ramp replaces ground here: overlapping floor0 would hold walkers down.
    surfaces.push({sector:'concourse',minX,maxX,minZ:-130.2,maxZ:RAMP_NORTH,height:0});
    surfaces.push({sector:'concourse',minX,maxX,minZ:RAMP_SOUTH,maxZ:98.8,height:0});
    surfaces.push({sector:'concourse',minX:side<0?-31.2:28.6,maxX:side<0?-28.6:31.2,minZ:-130.2,maxZ:98.8,height:0});
    surfaces.push({sector:'concourse',minX:side<0?-29.25:21.7,maxX:side<0?-21.7:29.25,minZ:-127.5,maxZ:RAMP_NORTH,height:h});
    surfaces.push({sector:'concourse',minX,maxX,minZ:RAMP_NORTH,maxZ:RAMP_SOUTH,axis:'z',start:RAMP_SOUTH,end:RAMP_NORTH,from:0,to:h});
    // A solid wedge has an exact planar walking surface rather than stair bumps.
    const vertices = [minX,h,RAMP_NORTH,maxX,h,RAMP_NORTH,maxX,0,RAMP_SOUTH,minX,0,RAMP_SOUTH,
      minX,-.3,RAMP_NORTH,maxX,-.3,RAMP_NORTH,maxX,-.3,RAMP_SOUTH,minX,-.3,RAMP_SOUTH];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setIndex([0,3,2,0,2,1,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);
    geometry.computeVertexNormals();
    const flat=geometry.toNonIndexed();flat.computeVertexNormals();ramps.push(flat);geometry.dispose();
    for(const [a,b] of [[21.2,22.6],[28.6,31.8]]) {
      box(materials.edge,side*(a+b)/2,h+1.13,RAMP_NORTH,b-a,.09,.09);
      for(const xx of [a,b])box(materials.edge,side*xx,h+.56,RAMP_NORTH,.075,1.12,.075);
    }
    for (const railX of [minX,maxX]) {
      beam(materials.edge,[railX,h+1.13,RAMP_NORTH],[railX,1.13,RAMP_SOUTH],.09);
      beam(materials.amber,[railX,h+.12,RAMP_NORTH],[railX,.12,RAMP_SOUTH],.045);
      for (let z=RAMP_NORTH;z<=RAMP_SOUTH;z+=3.8) {
        const y=h*(RAMP_SOUTH-z)/(RAMP_SOUTH-RAMP_NORTH);
        box(materials.edge,railX,y+.55,z,.075,1.1,.075);
      }
    }
    for (let z=60;z<91;z+=7.5) {
      const y=h*(RAMP_SOUTH-z)/(RAMP_SOUTH-RAMP_NORTH);
      for (const dx of [-2.6,2.6]) box(materials.rib,x+dx,y/2-.15,z,.22,Math.max(.1,y-.3),.32);
      box(materials.warm,x,y+.025,z,1.4,.035,.12);
    }
    text('↑  PUBLIC PROMENADE  /  DECK 02',x,3.25,94.4,5.6,.65,{color:'#f0ca93',size:60});
    text('02  /  CONCOURSE OVERLOOK',x,10.8,55.5,7,.85,{color:'#dfd9bf',size:68});
  }
  const deck = new THREE.Mesh(mergeGeometries(ramps),materials.rib);
  ramps.forEach(g=>g.dispose()); deck.name='Two public promenade ramps';group.add(deck);
  for (const z of [48,-100]) {
    box(materials.rib,0,h-.22,z,45,.44,6);
    box(materials.dark,0,h-.56,z,45,.24,5.7);
    surfaces.push({sector:'concourse',minX:-23.1,maxX:23.1,minZ:z-2.72,maxZ:z+2.72,height:h});
    for (const edge of [-1,1]) {
      box(materials.edge,0,h+1.15,z+edge*2.85,43,.1,.1);
      box(materials.amber,0,h+.08,z+edge*2.86,43,.05,.05);
      for (let x=-21;x<=21;x+=3) box(materials.edge,x,h+.58,z+edge*2.85,.075,1.15,.075);
    }
    for (const x of [-18,18]) beam(materials.rib,[x,h-.45,z],[Math.sign(x)*25,h-2.7,z],.34);
  }
  text('ARRIVALS  ⇄  TRANSFERS',0,h-.75,51.2,16,1.0,{color:'#e5c397',size:70});
  text('ALL GATES  /  FOLLOW THE SPINE',0,h-.75,-96.8,17,1.0,{color:'#e5c397',size:70});
  return {surfaces,landmarks:[
    {x:24,z:45,y:h,radius:3.5,title:'A city between departures.',code:'PFC / PUBLIC PROMENADE',hint:'Look out over the concourse',text:['The public promenade joins both sides of the interchange. Follow the long amber ramps near Arrivals to return to the passenger deck.','From here, every queue becomes a small moving constellation. The station processes a million journeys. It keeps very few of their names.']},
  ],routes:[[[ -24,48],[-24,-100],[24,-100],[24,48]]],stats:{levels:2,ramps:2,bridges:2}};
}
