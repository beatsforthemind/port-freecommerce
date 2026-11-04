import {CONCOURSE_LEVELS,PUBLIC_LIFT_SHAFTS} from './concourse-levels.js';

/** New public routes use the existing architectural batches and floor heights. */
export function buildUpperConcourse({box,beam,materials,colliders}) {
  const promenade=CONCOURSE_LEVELS[1].height,gallery=CONCOURSE_LEVELS[2].height,express=CONCOURSE_LEVELS[3].height;
  const surfaces=[],landmarks=[];
  function footprint(x,z,w,d,bottom,top){colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:bottom,maxY:top});}
  function rail(x,z,w,d,height){
    box(materials.edge,x,height+1.12,z,w,.08,d);
    box(materials.dark,x,height+.57,z,w,.065,d);
    footprint(x,z,w,d,height,height+1.3);
    if(w>d){for(let a=-w/2+.3;a<=w/2;a+=4)box(materials.edge,x+a,height+.56,z,.075,1.12,.075);}
    else{for(let a=-d/2+.3;a<=d/2;a+=4)box(materials.edge,x,height+.56,z+a,.075,1.12,.075);}
  }
  function floorNumber(number,side,height,z){
    const x=side*25.5;
    box(materials.dark,x,height+.025,z,1.6,.04,2.4);
    // Numerals are seven-segment inlays, sharing the amber box batch.
    const segments=number===3?[0,1,2,3,4]:[1,2,4,5];
    const shapes=[[-.28,-.82,.66,.10],[.08,-.40,.10,.75],[.08,.40,.10,.75],[-.28,.82,.66,.10],[-.28,0,.66,.10],[-.62,-.4,.10,.75]];
    for(const index of segments){const [dx,dz,w,d]=shapes[index];box(materials.amber,x+side*dx,height+.052,z+dz,w,.025,d);}
  }
  for(const side of[-1,1]){
    // A slender sunwalk threads outside the old ramp. It joins the formerly
    // isolated southern slab without laying a flat floor over the ramp itself.
    box(materials.rib,side*29.15,promenade-.12,75,1,.24,42);
    box(materials.amber,side*28.73,promenade+.035,75,.035,.025,40);
    surfaces.push({sector:'concourse',level:'promenade',minX:side<0?-29.65:28.65,maxX:side<0?-28.65:29.65,minZ:54,maxZ:96,height:promenade});
    surfaces.push({sector:'concourse',level:'promenade',minX:side<0?-29.25:21.7,maxX:side<0?-21.7:29.25,minZ:94,maxZ:98.8,height:promenade});
    rail(side*28.65,75,.08,38,promenade);rail(side*29.65,75,.08,42,promenade);
    rail(side*24.875,94,7.35,.10,promenade);rail(side*30.775,94,2.05,.10,promenade);
    rail(side*25.45,99.25,8.5,.12,promenade);
    footprint(side*21.2,96.4,.14,4.8,promenade,promenade+1.3);
    box(materials.dark,side*26.4,promenade+.25,97.2,2.4,.5,.8);
    box(materials.rust,side*26.4,promenade+.53,97.2,2.4,.08,.8);
    box(materials.edge,side*26.4,promenade+.92,97.58,2.4,.75,.08);
    footprint(side*26.4,97.2,2.6,1.2,promenade,promenade+1.3);
    landmarks.push({x:side*26,z:95.3,y:promenade,radius:2.6,code:'DECK 02 / ARRIVALS SUNWALK',title:'Arrivals seen from the slow lane.',hint:'Read the sunwalk notice',text:['The narrow outer walk goes around the promenade ramp instead of over it. The original southern balcony is public again.','Below, people arrive in a hurry. Up here, the view has no departure time. The lantern lifts are farther north on either gallery.']});

    surfaces.push({sector:'concourse',level:'galleries',minX:side<0?-29.25:21.7,maxX:side<0?-21.7:29.25,minZ:-127.5,maxZ:98.8,height:gallery});
    for(const [a,b]of[[-127.5,-87],[-81,17],[23,98.8]])rail(side*21.2,(a+b)/2,.14,b-a,gallery);
    rail(side*25.45,-128,8.5,.12,gallery);rail(side*25.45,99.25,8.5,.12,gallery);
    floorNumber(3,side,gallery,-58);

    // The express-level public gallery stays outboard of the working cages.
    // It never crosses either live overhead rail line.
    const shaft=PUBLIC_LIFT_SHAFTS.find(item=>item.side===side);
    for(const[a,b]of[[-122,shaft.minZ],[shaft.maxZ,92]])box(materials.rib,side*27.5,express-.15,(a+b)/2,5,.3,b-a);
    box(materials.rib,side*25.85,express-.15,-52,1.7,.3,4);
    for(const[a,b]of[[-122,-54],[-50,92]])box(materials.dark,side*27.5,express-.39,(a+b)/2,4.7,.18,b-a);
    surfaces.push({sector:'concourse',level:'express',minX:side<0?-29.25:25.5,maxX:side<0?-25.5:29.25,minZ:-120,maxZ:90,height:express});
    rail(side*25.2,-15,.12,210.8,express);
    for(const[a,b]of[[-120.4,shaft.minZ],[shaft.maxZ,90.4]])rail(side*29.7,(a+b)/2,.12,b-a,express);
    rail(side*27.45,-120.4,4.6,.12,express);rail(side*27.45,90.4,4.6,.12,express);
    floorNumber(4,side,express,-58);
    for(const z of[-108,78]){
      box(materials.amber,side*25.26,express+.08,z,.04,.06,4);
      box(materials.dark,side*27.4,express+.025,z,2.8,.035,3.4);
      // Viewing marks point toward a berth while retaining a clear through lane.
      for(let i=0;i<3;i++)box(materials.warm,side*(26.5+i*.35),express+.05,z,.2,.025,1.9-i*.4);
    }

    for(const z of[-84,62]){
      box(materials.dark,side*28.6,gallery+.25,z,1.2,.5,3.8);
      box(materials.rust,side*28.6,gallery+.53,z,1.2,.08,3.8);
      box(materials.dark,side*29.08,gallery+.92,z,.12,.75,3.8);
      footprint(side*28.6,z,1.35,3.95,gallery,gallery+1.3);
    }
    landmarks.push({x:side*26.4,z:-84,y:gallery,radius:3,code:'DECK 03 / LANTERN GALLERIES',title:'The light someone leaves on.',hint:'Read the gallery notice',text:['The upper galleries look onto the sleeping quarters and long-stay rooms. A lit window is not an invitation.','Two bridges cross the interchange below the freight and express lines. Lantern lifts connect every public deck; the old promenade ramps remain open below.']});
    landmarks.push({x:side*27,z:-108,y:express,radius:3,code:'DECK 04 / EXPRESS OVERLOOK',title:'A city measured in connections.',hint:'Watch the express interchange',text:['The public overlook runs outside the working lift cages. Staff and sealed freight use the inner platforms; everyone else gets the view.','A train slows, a guide aligns, and an entire journey becomes a few seconds of light under the roof. The lantern lifts return to every public deck.']});
  }

  for(const z of[-84,20]){
    box(materials.rib,0,gallery-.22,z,45,.44,6);
    box(materials.dark,0,gallery-.56,z,45,.24,5.7);
    surfaces.push({sector:'concourse',level:'galleries',minX:-23.1,maxX:23.1,minZ:z-2.72,maxZ:z+2.72,height:gallery});
    for(const side of[-1,1]){
      rail(0,z+side*2.85,43,.12,gallery);
      box(materials.amber,0,gallery+.07,z+side*2.86,43,.04,.04);
      beam(materials.rib,[side*22,gallery-.44,z],[side*14,gallery-2.1,z],.22,.28);
    }
  }

  // Protect the autonomous staff cages on the east side at both existing berths.
  for(const z of[-108,78]){
    footprint(23.2,z,3.1,3.8,17.575,25.5);
    box(materials.edge,24.7,21.55,z-1.95,.08,7.9,.08);
    box(materials.edge,24.7,21.55,z+1.95,.08,7.9,.08);
    for(const y of[18.8,24.5])box(materials.edge,24.7,y,z,.08,.09,4);
    box(materials.amber,24.74,18.9,z,.035,.055,3.6);
  }
  return{surfaces,landmarks,stats:{publicLevels:4,newBridges:2,expressOverlooks:2,newTextures:0,newLights:0}};
}
