import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * The Exchange is an accreted neighbourhood rather than a shopping corridor.
 * Alternating islands turn the public street twice before it reaches the
 * common table; its two loops also give the population a useful place to go.
 */
export function buildMarketDistrict({box, solid, sign, mesh, decal, m}) {
  const footprint = [
    [-32,18],[-43,18],[-43,12],[-65,12],[-65,10],[-91,10],
    [-91,14],[-99,14],[-99,36],[-94,36],[-94,49],[-69,49],
    [-69,44],[-49,44],[-49,48],[-39,48],[-39,42],[-32,42],
  ];
  const resources = [];
  const deck = new THREE.MeshStandardMaterial({color:'#625242',roughness:.96,metalness:.1});
  const fabric = new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
  resources.push(deck,fabric);
  let boxes = 0, solids = 0, labels = 0, customTriangles = 0, customDrawCalls = 0;
  const B = (...args) => {boxes++; return box(...args);};
  const S = (...args) => {boxes++; solids++; return solid(...args);};
  const L = (...args) => {labels++; return sign(...args);};
  const G = (geometry,material,...args) => {
    customTriangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count)/3;
    customDrawCalls++;
    return mesh(geometry,material,...args);
  };
  const shape = new THREE.Shape();
  footprint.forEach(([x,z],i) => i ? shape.lineTo(x,-z) : shape.moveTo(x,-z));
  shape.closePath();
  const floor = new THREE.ShapeGeometry(shape);
  floor.rotateX(-Math.PI/2);
  G(floor,deck,0,0,0);
  const hull = floor.clone();
  const index = hull.index;
  for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}
  hull.computeVertexNormals();
  G(hull,m.dark,0,10.8,0);

  // A stepped pressure envelope follows the actual street's irregular outline.
  // The eastern edge is an open connection to the concourse.
  for(let i=0;i<footprint.length;i++){
    const a=footprint[i], b=footprint[(i+1)%footprint.length];
    if(a[0]===-32 && b[0]===-32) continue;
    const x=(a[0]+b[0])/2, z=(a[1]+b[1])/2;
    const w=Math.abs(a[0]-b[0])||.32, d=Math.abs(a[1]-b[1])||.32;
    const height=i%3===0 ? 9.3 : 10.8;
    B(m.wall,x,height/2,z,w,height,d);
    B(m.rust,x,1.12,z,w+.05,2.24,d+.05);
    B(m.steel,x,height-.25,z,w+.15,.28,d+.15);
  }
  // The old hall-sized opening becomes a compressed, legible street entrance.
  // These close its unused edges while leaving the full public route open.
  for(const z of [14,46]) B(m.wall,-32.5,3.1,z,.85,6.2,8.1);
  B(m.steel,-32.5,6.2,30,.85,.55,24);

  const geometryBatches = new Map();
  const transform = new THREE.Object3D();
  function piece(geometry,material,x,y,z,rx=0,ry=0,rz=0){
    let baked=geometry.index ? geometry.toNonIndexed() : geometry;
    if(baked!==geometry) geometry.dispose();
    for(const key of Object.keys(baked.attributes)) if(key!=='position' && key!=='normal') baked.deleteAttribute(key);
    transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(1,1,1);transform.updateMatrix();
    baked.applyMatrix4(transform.matrix);
    if(!geometryBatches.has(material)) geometryBatches.set(material,[]);
    geometryBatches.get(material).push(baked);
  }
  const canopies = [];
  function canopy(x,z,w,d,y,tint,tilt=.3){
    const geometry=new THREE.BufferGeometry();
    const points=[
      x-w/2,y-tilt,z-d/2, x+w/2,y+tilt,z-d/2, x+w/2,y+.1,z+d/2,
      x-w/2,y-tilt,z-d/2, x+w/2,y+.1,z+d/2, x-w/2,y-.35,z+d/2,
    ];
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    const c=new THREE.Color(tint),colors=[];
    for(let i=0;i<6;i++) colors.push(c.r,c.g,c.b);
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();canopies.push(geometry);
    for(const side of [-1,1]){
      B(m.dark,x+side*w/2,y/2,z-d/2,.09,y,.09);
      B(m.dark,x,y+.05,z+side*d/2,w,.075,.075);
    }
    // A scalloped edge makes individual awnings read as repaired fabric.
    for(let i=0;i<Math.ceil(w/1.1);i++) B(i%2?m.cloth:m.cream,x-w/2+.5+i*1.1,y-.45,z+d/2,1.04,.45,.055);
  }

  function stall({x,z,w,d,face,tint,name,kind}){
    const east=face==='east', faceX=east?x+w/2+.1:x, faceZ=east?z:z+d/2+.1;
    S(tint,x,.58,z,w,1.16,d);
    if(east){
      B(m.dark,x-w/2,2.45,z,.22,4.9,d);
      for(const side of [-1,1]) B(tint,x,1.8,z+side*d/2,w,3.6,.22);
      B(m.cream,faceX,1.35,z,.72,.18,d-.35);
      L(name,faceX+.09,3.55,z,d-.5,.86,Math.PI/2,'#eed0a0','#392f2b');
    }else{
      B(m.dark,x,2.45,z-d/2,w,4.9,.22);
      for(const side of [-1,1]) B(tint,x+side*w/2,1.8,z,.22,3.6,d);
      B(m.cream,x,1.35,faceZ,w-.35,.18,.72);
      L(name,x,3.65,faceZ+.08,w-.5,.86,0,'#eed0a0','#392f2b');
    }
    for(let row=0;row<3;row++){
      const y=1.72+row*.66;
      if(east) B(m.steel,x-w/2+.3,y,z,.5,.075,d-.65);
      else B(m.steel,x,y,z-d/2+.3,w-.65,.075,.5);
      for(let i=0;i<7;i++){
        const along=(i-3)*(east?d:w)/8;
        B(i%3?m.sage:m.cream,east?x-w/2+.45:x+along,y+.24,east?z+along:z-d/2+.45,east?.46:.6,.4,east?.6:.46);
      }
    }
    const vendorX=east?faceX-1.5:x-1.1, vendorZ=east?z+1:faceZ-1.5;
    B(m.sage,vendorX,1.96,vendorZ,.54,.85,.42);
    B(m.cream,vendorX,2.57,vendorZ,.33,.36,.33);
    B(m.dark,vendorX,2.8,vendorZ,.43,.12,.4);
    for(const side of [-1,1]) B(m.sage,vendorX+side*.35,1.97,vendorZ,.16,.67,.17);
    for(let i=0;i<6;i++){
      const along=(i-2.5)*(east?d:w)/7;
      const px=east?faceX+.04:x+along, pz=east?z+along:faceZ+.03;
      B(m.dark,px,1.5,pz,east?.57:1,.1,east?1:.57);
      if(kind==='produce'){
        for(let j=0;j<4;j++){
          const px2=px+(east?(j%2)*.14-.07:(j%2)*.28-.14), pz2=pz+(east?Math.floor(j/2)*.28-.14:Math.floor(j/2)*.14-.07);
          piece(new THREE.OctahedronGeometry(.19+(i%2)*.035),i%2?m.sage:m.red,px2,1.75,pz2,0,j*.6,.2);
          piece(new THREE.ConeGeometry(.045,.22,4),m.sage,px2,1.99,pz2,.2,0,.25);
        }
      }else if(kind==='food'){
        piece(new THREE.CylinderGeometry(.23,.15,.18,8),m.cream,px,1.67,pz);
        piece(new THREE.CylinderGeometry(.195,.195,.035,8),m.rust,px,1.77,pz);
        for(const side of [-1,1]) B(m.dark,px+side*.08,1.85,pz,.025,.3,.025);
      }else{
        B(i%2?m.steel:m.rust,px,1.78,pz,east?.35:.67,.42,east?.67:.35,.1*i);
        B(m.warm,east?px+.185:px,1.85,east?pz:pz+.185,east?.025:.36,.04,east?.36:.025);
      }
    }
    decal(kind==='food'?1:12,east?faceX+.13:x+w*.32,2.42,east?z-d*.32:faceZ+.13,east?1:1.3,1.3,east?Math.PI/2:0);
    canopy(x+.1,z+.1,w+1.8,d+1.8,5.15,tint.color.getHex(),.38);
    // Packed wares hang inside each stall's already solid footprint.
    for(let i=0;i<5;i++){
      const along=(i-2)*(east?d:w)/6;
      const px=east?faceX-.3:x+along, pz=east?z+along:faceZ-.3;
      B(m.dark,px,4.35,pz,.025,.9,.025);
      piece(new THREE.CylinderGeometry(.12,.2,.5,6),i%2?m.cloth:m.sage,px,3.75,pz,0,0,.12*(i-2));
    }
  }

  // These alternate sides of the route, so no sight line crosses the whole room.
  stall({x:-49,z:27,w:10,d:8,face:'east',tint:m.rust,name:'SALT + STATIC',kind:'produce'});
  stall({x:-64,z:35,w:9,d:9,face:'north',tint:m.sage,name:'HOT NOODLES / 24',kind:'food'});
  stall({x:-81,z:18,w:12,d:8,face:'north',tint:m.red,name:'SECOND ORBIT',kind:'salvage'});
  stall({x:-91,z:43,w:6,d:7,face:'east',tint:m.cloth,name:'AFTER HOURS',kind:'salvage'});

  // The threshold and the second elbow have overlapping, lower fabric ceilings.
  canopy(-37.7,30,10.5,23,6.8,'#b38d62',-.3);
  canopy(-55.8,37.5,5.2,11,6.25,'#9c7454',.45);
  canopy(-73.3,27,9,7,5.9,'#b3a687',-.35);
  L('THE EXCHANGE',-33.7,5.2,30,12,1.3,Math.PI/2,'#e9c48b','#352c28');
  L('REPAIRS  /  COMMON TABLE',-70.7,4.9,28,5.6,.75,Math.PI/2,'#d3d6ae','#33392f');

  // Shared tables provide a sheltered pause at the end of the busy street.
  S(m.dark,-90.7,.52,30.6,3.4,1.04,2.7);
  B(m.cream,-90.7,1.08,30.6,3.8,.14,3.1);
  for(const x of [-93,-88.4]){
    S(m.dark,x,.27,30.6,.75,.54,2.7);
    B(m.sage,x,.6,30.6,.86,.12,2.85);
  }
  for(const z of [28.2,33.1]){
    S(m.dark,-90.7,.27,z,3.4,.54,.8);
    B(m.sage,-90.7,.6,z,3.55,.12,.9);
  }
  for(let i=0;i<5;i++){
    const x=-92+i*.65;
    piece(new THREE.CylinderGeometry(.12,.1,.23,7),m.cream,x,1.29,30.4+(i%2)*.43);
    B(m.rust,x,1.19,30.2+(i%2)*.43,.45,.03,.33);
  }
  L('COMMON TABLE / NO PURCHASE REQUIRED',-98.5,4.2,29.8,12,.76,Math.PI/2,'#d1c49c','#303c35');
  for(const x of [-97.2,-83.8]) for(const z of [24,36]) S(m.steel,x,4.4,z,.17,8.8,.17);
  for(const z of [25.2,29,33.5]){
    B(m.dark,-90.5,6.8,z,14,.045,.045,.04);
    for(let i=0;i<7;i++){
      const x=-96.3+i*1.9,y=6.2-Math.sin(i/6*Math.PI)*.6;
      B(m.dark,x,(6.8+y)/2,z,.025,6.8-y,.025);
      piece(new THREE.CylinderGeometry(.14,.21,.42,6),i%2?m.cloth:m.cream,x,y,z);
      B(m.warm,x,y-.24,z,.14,.035,.14);
    }
  }
  // A high clerestory over the court is the market's only open-feeling ceiling.
  for(const x of [-97,-94,-91,-88,-85]){
    B(m.steel,x,10.5,30,.2,.4,14);
    B(m.warm,x+.3,10.3,30,.5,.045,10);
  }
  // Existing Borrowed Parts occupies the clear pocket at(-79,36.2).
  for(const z of [33,39.5]) B(m.steel,-79,4.6,z,9,.13,.13);
  B(m.dark,-83.3,2.3,39.5,.13,4.6,.13);
  B(m.dark,-74.7,2.3,39.5,.13,4.6,.13);
  canopy(-79,36.2,8.8,6.4,5.6,'#878a69',.15);

  const routes = [
    [[-36,30],[-41,35],[-56.5,35],[-56.5,26],[-72,26],[-72,42.5],[-55,42.5],[-55,36],[-41,36],[-36,30]],
    [[-72,42.5],[-85,42.5],[-85,26],[-94,26],[-94.5,33],[-94.5,35],[-86,35],[-85,39],[-85,42.5],[-72,42.5]],
  ];
  // Worn utility strips follow the bends, in contrast to the concourse's lanes.
  for(const route of routes) for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i],dx=b[0]-a[0],dz=b[1]-a[1];
    B(m.cream,(a[0]+b[0])/2,.018,(a[1]+b[1])/2,.045,.025,Math.hypot(dx,dz),Math.atan2(dx,dz));
  }
  // Only the court gets broad pavers; the winding street remains patched metal.
  for(let x=-97;x<=-85;x+=2) for(let z=24;z<=35;z+=2){
    B(m.dark,x,.006,z,1.96,.01,.035);
    B(m.dark,x,.006,z,.035,.01,1.96);
  }
  for(const [material,geometries] of geometryBatches){
    const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    G(merged,material,0,0,0);
  }
  const sails=mergeGeometries(canopies);canopies.forEach(g=>g.dispose());
  G(sails,fabric,0,0,0);

  return {
    id:'market',surfaces:[{polygon:footprint,height:0}],
    spawn:{position:[-38,1.75,30],yaw:Math.PI/2},
    terminal:{x:-73,z:46},routes,resources,
    landmarks:[
      {title:'The Common Table',x:-90.7,z:30.6,radius:5,text:'No minimum purchase. No assigned seats. A thousand arguments have ended here over someone else’s soup.'},
      {title:'Salt + Static',x:-41.5,z:27,radius:3,text:'Preserved fruit, transit salt, and a green ingredient whose customs classification changes every week.'},
    ],
    stats:{boxInstances:boxes,solidFootprints:solids,labels,customDrawCalls,triangles:boxes*12+customTriangles+labels*2,closedRoutes:routes.length},
  };
}
