import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Wall traders share the station's material batches; only curved stock needs meshes. */
export function buildPromenadeShops({group,box,beam,materials,colliders,shops,height=7.625}) {
  const curved=new Map(),object=new THREE.Object3D();
  const landmarks=[],vendorAnchors=[],typeCounts={};
  let boxInstances=0,curveTriangles=0;
  const staffTypes=new Set(['food','repair','tailoring','charts','exchange','pharmacy','luggage']);
  const m=materials;

  for(const [index,shop]of shops.entries()){
    const {side,z,width,type}=shop,span=width/2-.35;
    const variant=shop.variant??index%4;
    const accent=type==='botany'||type==='sensory'?m.dim:type==='tailoring'||type==='food'?m.rust:m.edge;
    typeCounts[type]=(typeCounts[type]||0)+1;
    function b(material,x,y,v,w,h,d,ry=0,rz=0){
      box(material,side*x,height+y,z+v,w,h,d,side*ry,side*rz);boxInstances++;
    }
    function rod(material,a,c,w=.06,d=w){
      beam(material,[side*a[0],height+a[1],z+a[2]],[side*c[0],height+c[1],z+c[2]],w,d);boxInstances++;
    }
    function curve(geometry,material,x,y,v,rx=0,ry=0,rz=0){
      if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}
      object.position.set(side*x,height+y,z+v);object.rotation.set(rx,side*ry,side*rz);object.scale.set(1,1,1);object.updateMatrix();
      geometry.applyMatrix4(object.matrix);
      if(!curved.has(material))curved.set(material,[]);
      curved.get(material).push(geometry);
    }
    function cylinder(material,x,y,v,r,h,top=r,segments=5,rx=0,ry=0,rz=0){curve(new THREE.CylinderGeometry(top,r,h,segments),material,x,y,v,rx,ry,rz);}
    function crystal(x,y,v,r=.24){curve(new THREE.OctahedronGeometry(r),m.warm,x,y,v,.2,variant*.4,.15);}
    function ring(x,y,v,r=.65,ry=Math.PI/2,rz=0){curve(new THREE.TorusGeometry(r,.035,3,12),m.edge,x,y,v,0,ry,rz);}
    function counter(material=accent,h=1.05,depth=1.65){
      const center=27.20+depth/2;
      b(material,center,h/2,0,depth,h,width-.4);
      b(m.edge,center,h+.055,0,depth+.10,.11,width-.28);
      b(m.dark,27.16,.65,0,.12,.89,Math.min(width-.5,3.4));
    }
    function shelves(){
      for(const y of[1.5,2.35])b(m.rib,30.84,y,0,.72,.10,width-.6);
    }
    function bottle(x,y,v,material=m.edge,scale=1){
      cylinder(material,x,y+.24*scale,v,.13*scale,.48*scale,.10*scale);
      cylinder(m.warm,x,y+.51*scale,v,.075*scale,.07*scale);
    }

    // Each bay is a real recessed fixture, with a roof, side cheeks and counter fascia.
    // The clear public lane is entirely inward of x +/-26.82 after body allowance.
    b(m.dark,31.40,2.05,0,.16,4.1,width);
    b(m.rib,29.30,.065,0,4.25,.13,width);
    for(const v of[-width/2+.07,width/2-.07])b(accent,29.30,2.05,v,4.25,4.10,.14);
    b(m.dark,27.31,3.30,0,.28,1.22,width);
    b(accent,29.30,4.11,0,4.25,.15,width);
    b(m.warm,27.16,3.97,0,.08,.045,width-.28);

    if(type==='food'){
      counter(m.rust,.98,1.60);
      // A sloping fabric hood and broad stove distinguish the food row.
      b(m.rust,28.50,3.72,0,2.55,.12,width-.25,0,-.12);
      for(let i=0;i<4;i++)b(i%2?m.warm:m.dark,27.25,3.55,-span+i*(span*2/3),.14,.26,.18);
      if(shop.display==='bakery'){
        // The bakery's radiant oven stays behind the keeper; warm bread fills
        // a low front tray instead of repeating the tea and broth kettles.
        const v=-span*.55;
        b(m.rib,30.65,1.10,v,1.0,1.95,1.5);
        b(m.dark,30.10,1.29,v,.12,1.07,1.25);
        b(m.warm,30.025,1.29,v,.035,.79,1.04);
        for(const y of[1.08,1.47])b(m.dark,29.99,y,v,.04,.055,1.08);
        b(m.edge,29.98,.82,v,.08,.07,1.14);
        b(m.edge,28.05,1.13,0,1.15,.05,width-.9);
        for(let i=0;i<6;i++){
          const vv=-span*.72+i*.61;
          b(m.warm,28.25,1.26,vv,.48,.18,.40,0,(i%2?1:-1)*.04);
          b(m.rust,28.25,1.36,vv,.22,.025,.035);
        }
        for(const vv of[-.45,.45])curve(new THREE.TorusGeometry(.115,.04,4,8),m.warm,27.70,1.23,vv,Math.PI/2);
      }else{
        b(m.dark,28.15,1.12,-span*.54,1.05,.13,1.10);
        cylinder(m.edge,28.16,1.55,-span*.54,.39,.70,.29,6);
        cylinder(m.edge,28.16,1.93,-span*.54,.34,.08,.20,6);
        rod(m.edge,[28.16,1.72,-span*.54],[27.58,1.55,-span*.54],.12);
        for(let i=0;i<3;i++)cylinder(m.warm,27.70,1.21,span*.08+i*.34,.12,.26,.14);
        if(shop.specialty==='spice'||variant===2){
          shelves();for(let i=0;i<4;i++)bottle(30.8,1.55,-span*.65+i*span*.40,m.dim,.85);
        }else{
          b(m.dark,30.80,.43,-span*.58,.95,.85,Math.min(1.65,width*.35));
          for(let i=0;i<3;i++)b(m.rust,30.80,.95+i*.19,-span*.58,.64,.16,.85);
        }
      }
    }else if(type==='botany'){
      counter(m.dim,.82,1.55);
      b(m.dark,30.85,1.80,0,.48,2.75,width-.4);
      for(const y of[1.15,2.03])b(m.edge,29.95,y,0,2.1,.10,width-.55);
      for(let i=0;i<4;i++){
        const v=-span*.74+i*span*.48,x=i%2?30.25:28.38,y=i%2?2.1:.93;
        cylinder(m.edge,x,y+.13,v,.22,.26,.28);
        rod(m.dim,[x,y+.2,v],[x,y+1.10,v],.06);
        for(let leaf=0;leaf<3;leaf++)curve(new THREE.ConeGeometry(.20,.64,3),m.dim,x+(leaf-1)*.14,y+.50+leaf*.19,v+(leaf%2?.12:-.10),.35,leaf*1.4,.8);
        crystal(x,y+1.13,v,.13);
      }
      for(const v of[-span,span])rod(m.edge,[28.1,.9,v],[28.1,2.75,v],.035);
      b(m.warm,28.10,2.77,0,.06,.035,width-.7);
    }else if(type==='repair'){
      counter(m.rib,1.08,1.75);
      b(m.dark,30.97,2.15,0,.23,1.82,width-.55);
      for(let i=0;i<4;i++){
        const v=-span*.7+i*span*.44;
        rod(m.edge,[30.78,1.75,v],[30.78,2.36,v+.10],.065);
        b(m.rust,30.76,2.38,v+.10,.13,.21,.22);
      }
      const v=-span*.48;
      b(m.edge,28.05,1.37,v,.78,.46,.9);
      curve(new THREE.IcosahedronGeometry(.29,0),m.edge,28.05,1.78,v);
      b(m.warm,27.79,1.79,v,.06,.08,.30);
      for(const direction of[-1,1]){
        rod(m.edge,[28.05,1.46,v+direction*.42],[28.42,1.24,v+direction*.70],.12);
        cylinder(m.edge,28.42,1.22,v+direction*.73,.13,.20);
      }
      rod(m.rib,[30.45,1.1,-span*.7],[30.20,2.6,-span*.7],.13);
      rod(m.rib,[30.20,2.6,-span*.7],[28.7,2.3,-span*.7],.12);
      b(m.warm,28.68,2.24,-span*.7,.18,.12,.3);
    }else if(type==='tailoring'){
      counter(m.rust,.94,1.45);
      // Draped bolts, a pressure-suit form and stacked textiles have no transparency.
      rod(m.edge,[30.40,2.85,-span],[30.40,2.85,span],.075);
      for(let i=0;i<3;i++){
        const v=-span*.65+i*span*.64;
        b(i%2?m.dim:m.rust,30.42,1.93,v,.15,1.66,Math.min(.72,width*.14),0,(i-1)*.04);
        b(m.warm,30.29,1.30,v,.055,.06,.55);
      }
      for(let i=0;i<3;i++)b(i%2?m.dim:m.rust,27.97,1.10+i*.15,span*.55,.70,.13,.88);
      cylinder(m.edge,29.90,.35,-span*.55,.32,.12);
      rod(m.edge,[29.90,.42,-span*.55],[29.90,2.15,-span*.55],.07);
      b(m.warm,29.90,1.76,-span*.55,.47,.79,.65);
      b(m.dark,29.89,2.17,-span*.55,.27,.09,.3);
    }else if(type==='charts'){
      counter(m.rib,.99,1.65);
      b(m.dark,30.91,2.1,0,.18,2.15,width-.65);
      const radius=Math.min(1.0,width*.17);
      ring(30.72,2.15,0,radius);ring(30.65,2.15,0,radius*.63);
      crystal(30.60,2.15,0,radius*.28);
      for(let i=0;i<3;i++)b(m.warm,30.74,1.55+i*.42,-span*.65,.06,.025,.38+i*.1);
      b(m.dark,27.95,1.13,-span*.4,.90,.12,1.18,0,-.13);
      for(let i=0;i<3;i++)b(m.cool,27.93,1.25,-span*.75+i*.28,.36,.035,.07);
      cylinder(m.edge,28.05,1.29,span*.48,.18,.5,.08);
    }else if(type==='curios'){
      counter(m.dark,.84,1.48);
      shelves();
      if(shop.display==='instruments'){
        // A flared horn, resonant bowls and a strung hoop read as objects to
        // play, rather than another mineral display. All share existing batches.
        curve(new THREE.CylinderGeometry(.07,.27,.65,8,1,true),m.edge,28.08,1.48,-span*.65,0,0,-Math.PI/2);
        rod(m.edge,[28.08,.96,-span*.65],[28.08,1.45,-span*.65],.055);
        for(const [v,r]of[[0,.23],[span*.65,.17]]){
          cylinder(m.edge,28.12,1.18,v,r*.75,.12,r);
          cylinder(m.dim,28.12,1.247,v,r*.78,.018,r*.78);
          curve(new THREE.TorusGeometry(r,.025,3,12),m.edge,28.12,1.26,v,Math.PI/2);
        }
        ring(30.30,2.18,-span*.14,.58);
        for(let i=0;i<4;i++)b(m.warm,30.24,2.18,-span*.14-.30+i*.20,.025,.85-Math.abs(i-1.5)*.11,.018);
      }else{
        for(let i=0;i<3;i++){
          const v=-span*.62+i*span*.62;
          cylinder(m.edge,28.12,1.02,v,.24,.24,.20);
          crystal(28.12,1.55+i%2*.25,v,.29+i*.04);
          for(const dv of[-.31,.31])rod(m.edge,[28.12,.94,v+dv],[28.12,2.02,v+dv],.025);
        }
      }
      for(let i=0;i<3;i++)b(m.rust,30.83,2.50,-span*.60+i*span*.6,.35,.38,.32,variant*.2);
    }else if(type==='exchange'){
      counter(m.rib,1.12,1.75);
      b(m.shell,30.97,1.85,0,.3,3.2,width-.5);
      b(m.dark,30.75,2.16,0,.08,1.43,Math.min(width-.9,3.9));
      for(const v of[-span*.65,span*.65])b(m.edge,30.65,2.17,v,.14,1.55,.13);
      b(m.warm,28.0,1.28,-span*.48,.60,.045,.65,0,-.18);
      b(m.dark,27.88,1.42,span*.52,.55,.48,.62);
      b(m.cool,27.58,1.48,span*.52,.035,.14,.35);
      for(let i=0;i<3;i++)b(m.edge,30.63,1.61+i*.32,-span*.63,.10,.12,.47);
    }else if(type==='sensory'){
      counter(m.dim,.87,1.45);
      // Individually pressure-rated tasting columns and an angular listening horn.
      for(let i=0;i<3;i++){
        const v=-span*.62+i*span*.62;
        cylinder(m.edge,29.0,1.17,v,.27,.47,.30);
        cylinder(m.warm,29.0,1.94,v,.16,.99,.16);
        cylinder(m.edge,29.0,2.49,v,.27,.13,.27);
      }
      b(m.dark,30.90,2.02,0,.48,2.5,width-.75);
      for(let i=0;i<3;i++)b(m.dim,30.62,1.50+i*.45,0,.08,.07,width-1.0);
      curve(new THREE.ConeGeometry(.30,.85,6),m.edge,28.0,1.50,span*.65,0,0,-Math.PI/2);
    }else if(type==='habitat'){
      counter(m.rust,.86,1.4);
      // A short-stay capsule showroom: recessed sleeping bay and folded bedding.
      const v=-span*.32,w=Math.min(width-.8,3.8);
      b(m.rib,30.10,1.50,v,1.85,2.72,w);
      b(m.dark,29.11,1.62,v,.12,1.91,w-.34);
      b(m.warm,29.04,1.25,v,.06,.44,w-.50);
      b(m.dim,29.03,1.52,v+w*.27,.065,.22,.62);
      b(m.amber,29.01,2.55,v,.035,.055,w-.38);
      for(let i=0;i<3;i++)b(m.dim,27.98,1.02+i*.16,span*.60,.60,.13,.86);
    }else if(type==='luggage'){
      counter(m.rib,.92,1.5);
      const v=-span*.58;
      for(let i=0;i<3;i++){
        b(i%2?m.rust:m.dim,30.45,.44+i*.65,v,.95,.58,1.15-i*.12,0,0);
        b(m.edge,29.94,.42+i*.65,v,.06,.07,.45);
      }
      for(let i=0;i<2;i++){
        const vv=span*.12+i*span*.52;
        b(i%2?m.rust:m.dark,28.03,1.28,vv,.55,.60,.67);
        rod(m.edge,[28.03,1.59,vv-.14],[28.03,1.88,vv-.14],.035);
        rod(m.edge,[28.03,1.88,vv-.14],[28.03,1.88,vv+.14],.035);
      }
    }else if(type==='pharmacy'){
      counter(m.dim,1.08,1.60);
      shelves();
      for(let i=0;i<4;i++){
        const v=-span*.74+i*span*.49;
        bottle(30.80,1.57,v,m.edge,.85);
      }
      b(m.dark,28.12,1.31,-span*.45,.8,.34,.78);
      for(const v of[-.14,.14])bottle(28.10,1.51,-span*.45+v,m.warm,.64);
      b(m.warm,30.70,2.48,span*.62,.07,.62,.17);
      b(m.warm,30.69,2.48,span*.62,.08,.17,.62);
    }

    // All solids live in a guarded retail pocket, never in the promenade route.
    colliders.push({minX:side<0?-31.5:27.1,maxX:side<0?-27.1:31.5,minZ:z-width/2,maxZ:z+width/2,minY:height,maxY:height+4.4});
    landmarks.push({id:shop.id,x:side*25.8,y:height,z,radius:2.35,code:'DECK 02 / INDEPENDENT TRADE',title:shop.name,hint:`Inspect ${shop.name}`,text:shop.description});
    if(staffTypes.has(type))vendorAnchors.push({id:shop.id,type,side,x:side*29.75,y:height,z:z+width*.17,face:side<0?Math.PI/2:-Math.PI/2});
  }

  for(const[material,geometries]of curved){
    const geometry=mergeGeometries(geometries);geometries.forEach(part=>part.dispose());
    curveTriangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
    const mesh=new THREE.Mesh(geometry,material);mesh.name='Promenade / shaped merchandise';mesh.matrixAutoUpdate=false;group.add(mesh);
  }
  // Station traversal owns all appended geometry and shared materials at disposal.
  return{landmarks,vendorAnchors,surfaces:[],stats:{shops:shops.length,types:Object.keys(typeCounts).length,typeCounts,boxes:boxInstances,geometryTriangles:boxInstances*12+curveTriangles,curvedTriangles:curveTriangles,geometryDrawCalls:curved.size,geometryTextures:0,geometryLights:0,shopColliders:shops.length,perFrameUpdates:0}};
}
