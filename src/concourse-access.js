import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {buildUpperConcourse} from './concourse-upper.js';
import {ESCALATORS,ESCALATOR_FLAT} from './escalator-layout.js';

export const PROMENADE_HEIGHT = 7.625;
export const RAMP_SOUTH = 94;
export const RAMP_NORTH = 56;

/** A usable second deck turns the concourse into a transport interchange. */
export function buildConcourseAccess({group, box, beam, text, materials,colliders}) {
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
    for(const [a,b] of [[21.2,22.6],[29.75,31.8]]) {
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
  // Authored resident itineraries retain their original floor interpretation;
  // the public lift/cap additions are for the first-person navigation view.
  const journeySurfaces=surfaces.slice();
  const upper=buildUpperConcourse({box,beam,materials,colliders});
  surfaces.push(...upper.surfaces);
  const escalators=buildEscalatorAccess({box,beam,materials,colliders});
  surfaces.push(...escalators.surfaces);
  return {surfaces,journeySurfaces,landmarks:[
    {x:24,z:45,y:h,radius:3.5,title:'A city between departures.',code:'PFC / PUBLIC PROMENADE',hint:'Look out over the concourse',text:['The public promenade joins both sides of the interchange. Follow the long amber ramps near Arrivals to return to the passenger deck.','From here, every queue becomes a small moving constellation. The station processes a million journeys. It keeps very few of their names.']},
    ...upper.landmarks,
    ...escalators.landmarks,
  ],routes:[[[ -24,48],[-24,-100],[24,-100],[24,48]]],stats:{levels:4,ramps:2,bridges:4,publicLifts:2,expressOverlooks:2,escalators:ESCALATORS.length}};
}

/** Static flights remain in the architecture batches; only the treads animate. */
function buildEscalatorAccess({box,beam,materials:m,colliders}) {
  const surfaces=[],landmarks=[],height=PROMENADE_HEIGHT;
  function solid(x,z,w,d,bottom,top){colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:bottom,maxY:top});}
  function guard(x,z,w,d){
    box(m.dark,x,height+.59,z,w,.12,d);
    box(m.edge,x,height+1.14,z,w,.10,d);
    solid(x,z,w,d,height,height+1.3);
    if(w>d){for(let xx=x-w/2+.12;xx<=x+w/2;xx+=1.5)box(m.edge,xx,height+.57,z,.065,1.14,.065);}
    else{for(let zz=z-d/2+.12;zz<=z+d/2;zz+=1.5)box(m.edge,x,height+.57,zz,.065,1.14,.065);}
  }
  function arrow(x,y,z,direction){
    const dz=direction>0?-1:1;
    box(m.amber,x,y,z,.09,.018,.85);
    for(const side of[-1,1])box(m.amber,x+side*.20,y,z+dz*.22,.08,.018,.57,side*dz*Math.PI/4);
  }
  for(const flight of ESCALATORS){
    const {x,side,topZ,bottomZ,width,landing,supportX}=flight;
    // New balconies touch the existing slab at x +/-21 without coplanar faces.
    const floorX=side*(17.3+21)/2;
    box(m.rib,floorX,height-.12,topZ-1.4,3.7,.24,2.8);
    box(m.dark,floorX,height-.30,topZ-1.4,3.5,.12,2.6);
    surfaces.push({sector:'concourse',level:'promenade',escalatorLanding:flight.id,...landing});
    box(m.rib,supportX,(height-.24)/2,topZ-1.4,.22,height-.24,.24);
    solid(supportX,topZ-1.4,.25,.27,0,height-.24);
    beam(m.edge,[supportX,4.6,topZ-1.4],[side*21,height-.22,topZ-1.4],.14,.19);

    // There is no solid wedge: high portions have real public headroom below.
    beam(m.rib,[x,height-.25,topZ],[x,-.25,bottomZ],width+.24,.25);
    for(const edge of[-1,1]){
      const railX=x+edge*(width/2+.17);
      beam(m.rib,[railX,height+.43,topZ],[railX,.43,bottomZ],.18,.88);
      beam(m.dark,[railX,height+1.12,topZ],[railX,1.12,bottomZ],.15,.13);
      beam(m.amber,[railX,height+.10,topZ],[railX,.10,bottomZ],.035,.035);
      // Short flattened noses release riders onto the flat comb area naturally.
      for(const [z,y]of[[topZ-.4,height],[bottomZ+.4,0]]){
        box(m.rib,railX,y+.43,z,.18,.88,.8);
        box(m.dark,railX,y+1.12,z,.15,.13,.8);
        solid(railX,z,.18,.8,y-.12,y+1.3);
      }
    }
    function sloped(cx,w,minYOffset,maxYOffset){
      colliders.push({minX:cx-w/2,maxX:cx+w/2,minZ:topZ,maxZ:bottomZ,
        sloped:true,axis:'z',start:bottomZ,end:topZ,from:0,to:height,
        minYOffset,maxYOffset,minY:minYOffset,maxY:height+maxYOffset});
    }
    // Three exact inclined collision strips replace hundreds of stepped boxes.
    // The underside includes the capsule's fore/aft projection while its top
    // remains below every standing rider, so each flight stays walkable.
    sloped(x,width+.24,-.52,-.12);
    for(const edge of[-1,1])sloped(x+edge*(width/2+.17),.18,-.12,1.3);
    for(const [z,y]of[[bottomZ+ESCALATOR_FLAT/2,0],[topZ-ESCALATOR_FLAT/2,height]]){
      box(m.dark,x,y-.12,z,width,.16,ESCALATOR_FLAT);
    }
    // The comb teeth are static inlays in the same amber batch as navigation.
    for(const [z,y]of[[bottomZ+ESCALATOR_FLAT,0],[topZ-ESCALATOR_FLAT,height]]){
      box(m.edge,x,y+.01,z,width+.1,.025,.16);
      for(let i=0;i<14;i++)box(m.amber,x-width/2+.08+i*(width-.16)/13,y+.028,z,.045,.014,.15);
    }
    const min=landing.minZ;
    guard(side*17.3,(min+topZ)/2,.10,2.8);
    guard(side*(17.3+21.2)/2,min,3.9,.10);
    // Split the approach-side guard around the stair mouth; the outboard tail
    // joins the existing promenade balustrade without blocking its through lane.
    const inner=Math.abs(x)-width/2-.30,outer=Math.abs(x)+width/2+.30;
    if(inner>17.3)guard(side*(17.3+inner)/2,topZ,inner-17.3,.10);
    if(outer<21.2)guard(side*(outer+21.2)/2,topZ,21.2-outer,.10);
    arrow(x,.035,bottomZ+2.2,flight.direction);
    arrow(x,height+.035,topZ-2.1,flight.direction);
    landmarks.push({x:x-side*2.2,z:bottomZ+2,y:0,radius:2.3,code:'PFC / PUBLIC ESCALATORS',title:`${flight.name}.`,hint:'Read the escalator notice',text:[`This ${flight.direction>0?'ascending':'descending'} flight links the passenger deck with the public promenade. Amber arrows mark the direction of travel; the paired flight on the opposite side runs the other way.`,`Step onto the moving treads and keep looking around. The long Arrivals flights leave room below for the port's small freight service. Lantern lifts and the original amber ramps remain available.`]});
  }
  return{surfaces,landmarks};
}
