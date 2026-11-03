import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** A public departure head with three pressure piers around a separate freight well. */
export function buildDocksDistrict({box, solid, sign, mesh, decal, m}) {
  const hub = [[-15,-139],[15,-139],[22,-146],[22,-164],[15,-171],[-15,-171],[-22,-164],[-22,-146]];
  const deck = new THREE.MeshStandardMaterial({color:'#4d5b67',roughness:.83,metalness:.34});
  const custom = new Map();
  const signs = [];
  let boxCount = 0, solidCount = 0, signCount = 0, customTriangles = 0;
  const b = (...args) => {boxCount++; return box(...args);};
  const s = (...args) => {boxCount++; solidCount++; return solid(...args);};
  const lettering = (...args) => {signCount++; signs.push(args);};
  const vY = new THREE.Vector3(0,1,0);

  function geometry(material, source) {
    const nonIndexed = source.index ? source.toNonIndexed() : source;
    if (source !== nonIndexed) source.dispose();
    if (!custom.has(material)) custom.set(material,[]);
    custom.get(material).push(nonIndexed);
    customTriangles += nonIndexed.attributes.position.count / 3;
  }
  function slab(points, top = 0, thickness = .48, material = deck) {
    const outline = new THREE.Shape();
    points.forEach(([x,z],i) => i ? outline.lineTo(x,-z) : outline.moveTo(x,-z));
    outline.closePath();
    const g = new THREE.ExtrudeGeometry(outline,{depth:thickness,bevelEnabled:false,steps:1,curveSegments:1});
    g.rotateX(-Math.PI/2); g.translate(0,top-thickness,0);
    geometry(material,g);
  }
  function beam(material, a, end, width = .24, depth = width) {
    const start = new THREE.Vector3(...a), finish = new THREE.Vector3(...end);
    const direction = finish.clone().sub(start);
    const g = new THREE.BoxGeometry(width,direction.length(),depth);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vY,direction.normalize()));
    g.translate(...start.add(finish).multiplyScalar(.5).toArray());
    geometry(material,g);
  }
  function panel(material, a, end, bottom, height, thickness = .16) {
    const dx = end[0]-a[0], dz = end[1]-a[1];
    const g = new THREE.BoxGeometry(Math.hypot(dx,dz),height,thickness);
    g.rotateY(-Math.atan2(dz,dx)); g.translate((a[0]+end[0])/2,bottom+height/2,(a[1]+end[1])/2);
    geometry(material,g);
  }
  function kneeWall(a,end) {
    // Small solid pieces follow the actual diagonal perimeter rather than
    // blocking a whole corner with one oversized axis-aligned collision box.
    const length = Math.hypot(end[0]-a[0],end[1]-a[1]);
    const count = Math.ceil(length/1.4);
    for (let i=0;i<count;i++) {
      const x0 = THREE.MathUtils.lerp(a[0],end[0],i/count), x1 = THREE.MathUtils.lerp(a[0],end[0],(i+1)/count);
      const z0 = THREE.MathUtils.lerp(a[1],end[1],i/count), z1 = THREE.MathUtils.lerp(a[1],end[1],(i+1)/count);
      s(m.dark,(x0+x1)/2,.57,(z0+z1)/2,Math.abs(x1-x0)+.21,1.14,Math.abs(z1-z0)+.21);
    }
    beam(m.steel,[a[0],1.2,a[1]],[end[0],1.2,end[1]],.11);
    panel(m.glass,a,end,1.2,16.3,.025);
    beam(m.steel,[a[0],17.7,a[1]],[end[0],17.7,end[1]],.4);
  }
  function arrow(x,z,yaw=0,material=m.amber) {
    const point = (px,pz) => [x+Math.cos(yaw)*px+Math.sin(yaw)*pz,z-Math.sin(yaw)*px+Math.cos(yaw)*pz];
    const shaft = point(0,.18); b(material,shaft[0],.026,shaft[1],.1,.025,1.1,yaw);
    for (const side of [-1,1]) {
      const tip = point(side*.23,-.42);
      b(material,tip[0],.026,tip[1],.08,.025,.65,yaw-side*Math.PI/4);
    }
  }

  // A short, low customs throat makes the tall, many-directional departure
  // head reveal itself only after entering it from the monumental concourse.
  b(deck,0,-.24,-135,22,.48,12);
  b(m.dark,0,5.7,-135,22,.5,12);
  for (const side of [-1,1]) {
    s(m.wall,side*10.8,2.7,-135,.45,5.4,12);
    b(m.cream,side*10.5,1.4,-135,.08,.3,10.4);
    for (const z of [-131,-135,-139]) {
      b(m.steel,side*10.4,2.8,z,.32,5.6,.28);
      b(m.warm,side*10.2,4.3,z,.05,1.3,.09);
    }
    s(m.dark,side*7.9,.76,-135.8,2.2,1.52,2.4);
    b(m.steel,side*7.9,1.56,-135.8,2.3,.12,2.5);
    b(m.soft,side*7.9,2,-135.2,1.4,.48,.05);
    decal(14,side*7.9,1,-134.57,1.65,.65);
  }
  lettering('04  /  DEPARTURES',0,4.65,-131.1,14,.9,0,'#d7dbc9','#24333b');
  b(m.amber,0,.024,-135,.11,.03,10);
  for (const x of [-4.5,4.5]) b(m.cream,x,.024,-135,.05,.03,10);

  // The octagonal hub is a genuine crossing, with an apex far above the
  // pedestrian ceiling of the three boarding piers.
  slab(hub);
  const roof = [];
  for (let i=0;i<hub.length;i++) {
    const a=hub[i],end=hub[(i+1)%hub.length];
    roof.push(0,26,-155,end[0],18,end[1],a[0],18,a[1]);
    beam(m.steel,[a[0],17.8,a[1]],[0,25.5,-155],.44,.7);
    b(m.steel,a[0],9,a[1],.55,18,.55);
    b(m.cream,a[0],1.4,a[1],.58,.32,.58);
    b(m.amber,a[0],3.3,a[1],.58,.09,.58);
  }
  const roofGeometry = new THREE.BufferGeometry();
  roofGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roof,3));
  roofGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(roof.length/3*2),2));
  roofGeometry.computeVertexNormals(); geometry(m.dark,roofGeometry);
  // Suspended hub carrier ring and a physically supported departure display.
  const carrier = new THREE.TorusGeometry(6.3,.21,6,24); carrier.rotateX(Math.PI/2); carrier.translate(0,15.8,-155); geometry(m.steel,carrier);
  for (const x of [-5.7,5.7]) beam(m.steel,[x,16,-155],[x,21.8,-155],.1);
  b(m.dark,0,10.4,-146.5,14,2.7,.42);
  b(m.steel,0,11.88,-146.5,14.6,.24,.7);
  for (const x of [-5.5,5.5]) beam(m.dark,[x,11.8,-146.5],[x,21,-146.5],.1);
  lettering('06  LOCAL     07  LONG-HAUL     08  FREIGHT',0,10.65,-146.22,12.7,1.1,0,'#d0d7ca','#26353d');
  for (let i=0;i<6;i++) b(i===3?m.amber:m.soft,-5.4+i*2.15,9.55,-146.25,1.5,.09,.025);

  // Pressure shell edges stop at the actual corridor openings.
  const shellEdges = [
    [[-15,-139],[-11,-139]],[[11,-139],[15,-139]],
    [[15,-139],[22,-146]],[[22,-146],[22,-154]],
    [[22,-164],[15,-171]],[[15,-171],[5,-171]],
    [[-5,-171],[-15,-171]],[[-15,-171],[-22,-164]],
    [[-22,-154],[-22,-146]],[[-22,-146],[-15,-139]],
  ];
  shellEdges.forEach(([a,end])=>kneeWall(a,end));
  for (const x of [-5.2,5.2]) b(m.steel,x,8.8,-171,.48,17.6,.8);
  b(m.steel,0,7.2,-171,10.6,.6,1.1);
  for (const side of [-1,1]) {
    b(m.steel,side*22,6.8,-159,.8,.65,10.3);
    b(m.dark,side*22,12,-159,.8,9.8,10.3);
  }
  lettering('06  /  LOCAL  ←',-11.7,6.4,-168.1,9,.95,0,'#d8ddca','#263a3c');
  lettering('07  /  LONG-HAUL',0,8.7,-170.52,10.3,1.3,0,'#edc38c','#26353d');
  lettering('08  /  CREW  →',11.7,6.4,-168.1,9,.95,0,'#d8c9b1','#3a3432');

  // The west queue is a real serpentine path; the broad central corridor and
  // the east inspection lane stay clear for through passengers and cleaners.
  for (const x of [-11.7,-8.5,-4.5]) {
    s(m.steel,x,.92,-154.5,.075,.12,9);
    for (const z of [-150,-153,-156,-159]) {
      b(m.steel,x,.48,z,.07,.96,.07);
      b(m.dark,x,.055,z,.42,.11,.42);
      b(m.cream,x,1,z,.1,.065,.1);
    }
  }
  for (const z of [-144,-153,-163,-177,-190]) arrow(0,z);
  for (const side of [-1,1]) {
    for (const x of [14,26,33]) arrow(side*x,-159,side<0?Math.PI/2:-Math.PI/2,side<0?m.soft:m.amber);
    for (const z of [-145,-149]) b(m.cream,side*3.4,.024,z,.07,.025,2.2);
  }
  for (let x=-14;x<=14;x+=2) b(m.cream,x,.024,-142.3,1,.025,.07);
  decal(2,14.8,2.3,-168.85,2.3,1.4);
  decal(11,-14.7,4.4,-168.81,2.5,3.6);

  // Cross-piers have low roofs and glazed sides; the narrow centre pier runs
  // into the exterior void. No hidden rectangle joins their separated ends.
  b(deck,0,-.24,-186,10,.48,30);
  b(m.dark,0,5.75,-183.25,10,.4,30.5);
  b(m.dark,0,6.85,-199.75,10.4,.35,2.5);
  for (const side of [-1,1]) {
    b(deck,side*31,-.24,-159,18,.48,10);
    b(m.dark,side*27.25,5.75,-159,16.5,.4,10);
    b(m.dark,side*37.75,6.85,-159,4.5,.35,10.4);
    for (const z of [-164,-154]) {
      s(m.dark,side*29.9,.57,z,16.2,1.14,.22);
      b(m.glass,side*29.9,3.36,z,16.2,4.35,.025);
      b(m.steel,side*29.9,5.5,z,16.2,.18,.15);
      b(m.steel,side*37,6.15,z,2,1.3,.15);
      for (const x of [23,27,31,35,38]) {
        b(m.steel,side*x,2.9,z,.14,5.8,.28);
        b(m.warm,side*x,4.5,z+(z===-164?.16:-.16),.04,.78,.04);
      }
    }
    for (const z of [-176,-182,-188,-194,-200.5]) {
      b(m.steel,side*5,2.85,z,.24,5.7,.15);
      b(m.cream,side*4.85,.85,z,.08,.1,.5);
      b(m.warm,side*4.8,4.8,z,.05,.06,1.25);
    }
    s(m.dark,side*5,.57,-186, .22,1.14,30);
    b(m.glass,side*5,3.35,-186,.025,4.35,30);
    b(m.steel,side*5,5.5,-186,.15,.18,30);
    b(m.steel,side*5,6.15,-199.75,.15,1.3,2.5);
    for (let z=-174;z>=-198;z-=6) b(m.amber,side*3.7,.025,z,.065,.025,3.3);
    // Lateral-lock floor seams and external pressure coupling collars.
    b(m.cream,side*36,.025,-159,.12,.025,8.8);
    b(m.steel,side*38.15,-.6,-159,.9,1.2,11.2);
  }

  function airlock({x,z,yaw,code,caption,material=m.cream}) {
    const collar = new THREE.TorusGeometry(3.65,.25,6,8);
    collar.rotateY(yaw); collar.translate(x,3.1,z); geometry(m.steel,collar);
    const face = new THREE.CylinderGeometry(3.38,3.38,.38,8);
    face.rotateX(Math.PI/2); face.rotateY(yaw); face.translate(x,3.1,z); geometry(m.dark,face);
    const right = [Math.cos(yaw),-Math.sin(yaw)], front = [Math.sin(yaw),Math.cos(yaw)];
    for (const side of [-1,1]) {
      b(material,x+right[0]*side*1.2+front[0]*.23,2.7,z+right[1]*side*1.2+front[1]*.23,2.28,4.65,.1,yaw);
      b(m.dark,x+right[0]*side*1.2+front[0]*.29,2.7,z+right[1]*side*1.2+front[1]*.29, .07,4.7,.025,yaw);
      for (let i=0;i<4;i++) b(m.amber,x+right[0]*side*2.6+front[0]*.08,1.9+i*.32,z+right[1]*side*2.6+front[1]*.08,.22,.1,.045,yaw);
    }
    const sx = Math.abs(Math.cos(yaw))>.5?9.4:.35, sz = Math.abs(Math.cos(yaw))>.5?.35:9.4;
    s(m.dark,x-front[0]*.25,2.6,z-front[1]*.25,sx,5.2,sz);
    // Keep the flat collision backplate behind the articulated visible doors.
    lettering(code,x+front[0]*.31,4.5,z+front[1]*.31,3.4,.95,yaw,'#24333b','#c4b899');
    lettering(caption,x+front[0]*.31,1.1,z+front[1]*.31,4.8,.36,yaw,'#cfdbc9','#2d3d42');
    b(m.soft,x+front[0]*.22,5.55,z+front[1]*.22,2.8,.07,.08,yaw);
  }
  airlock({x:-37.6,z:-159,yaw:Math.PI/2,code:'06',caption:'LOCAL SHUTTLE / CYCLING',material:m.sage});
  airlock({x:37.6,z:-159,yaw:-Math.PI/2,code:'08',caption:'FREIGHT / CREW ACCESS',material:m.rust});
  airlock({x:0,z:-200.4,yaw:0,code:'07',caption:'LONG-HAUL / STAND BY'});

  // A recessed freight apron makes the existing animated winch legible as a
  // separate operation beyond the passenger glazing, not a pedestrian obstacle.
  b(m.dark,-13,-3.5,-180,16,1,20);
  for (const z of [-172,-178,-184,-189]) {
    b(m.steel,-13,-2.96,z,15,.06,.08);
    for (const x of [-19,-7]) b(m.rust,x,-1.9,z,1.8,2.1,2.8);
  }
  for (const x of [-19.5,-5.5]) b(m.steel,x,6.7,-173,.6,16.4,.6);
  b(m.steel,-12.5,14.1,-171.5,15,.65,1.2);
  for (const x of [-18,-15,-12,-9,-6]) b(m.amber,x,13.72,-170.85,1.4,.12,.06);
  lettering('AUTOMATED FREIGHT / KEEP CLEAR',-13,3.5,-169.9,9.3,.6,0,'#d0c3a6','#28333b');

  // Three different craft give each branch a destination. Their repeated
  // rectangular fittings stay in the common static material batches.
  let shipOffsetX=18,shipOffsetZ=6;
  const shipBox=(material,x,y,z,...rest)=>b(material,x+shipOffsetX,y,z+shipOffsetZ,...rest);
  const shipBeam=(material,a,end,...rest)=>beam(material,[a[0]+shipOffsetX,a[1],a[2]+shipOffsetZ],[end[0]+shipOffsetX,end[1],end[2]+shipOffsetZ],...rest);
  function hull(material,center,radius,length,axis=[0,0,1]) {
    const g = new THREE.CylinderGeometry(radius*.72,radius,length,8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vY,new THREE.Vector3(...axis)));
    g.translate(center[0]+shipOffsetX,center[1],center[2]+shipOffsetZ); geometry(material,g);
  }
  // Long-haul liner: pale pressure hull, habitation windows, twin drive pods.
  hull(m.steel,[0,8.5,-224],4.7,36);
  shipBox(m.cream,0,10.3,-220,7.7,5.2,21);
  shipBox(m.dark,0,8.2,-220,15,1.8,24);
  shipBox(m.soft,0,12.1,-211.5,5.1,.7,.12);
  for (const side of [-1,1]) {
    shipBox(m.rust,side*8,7.5,-228,3.3,4.3,19);
    shipBox(m.dark,side*8,7.5,-238,2.8,3.8,.4);
    shipBox(m.soft,side*8,7.5,-238.25,1.8,2.7,.08);
    for (let z=-213;z>=-230;z-=3.2) shipBox(m.warm,side*3.91,10.2,z,.08,.65,1.2);
    shipBeam(m.steel,[side*6.2,5.1,-220],[side*11.5,1.3,-235],.48,.9);
  }
  // Local shuttle: a compact transverse capsule with landing feet and a
  // saddle-shaped bridge; visible through the west pier's long windows.
  shipOffsetX=4;shipOffsetZ=-18;
  hull(m.sage,[-56,5.2,-159],3.4,26,[1,0,0]);
  shipBox(m.cream,-55,8.05,-159,9.5,1.9,5.1);
  shipBox(m.dark,-56,4.3,-159,21,1.3,12.5);
  shipBox(m.soft,-49.8,7.9,-159,.13,.9,3.9);
  for (const side of [-1,1]) {
    hull(m.dark,[-57,3.4,-159+side*7.1],1.4,15,[1,0,0]);
    shipBox(m.amber,-49.4,3.4,-159+side*7.1,.12,.8,1.3);
    shipBeam(m.steel,[-54,3.2,-159+side*4.5],[-54,.6,-159+side*8],.32);
  }
  // Freight tender: visible skeletal rails around unpressurized containers.
  shipOffsetX=-4;shipOffsetZ=-18;
  hull(m.dark,[58,6.8,-159],2.4,30,[1,0,0]);
  for (const x of [50,56,62,68]) for (const side of [-1,1]) {
    shipBox((x+side)%3?m.rust:m.sage,x,6.1,-159+side*4.6,4.8,5.2,5.2);
    for (const dx of [-1.9,1.9]) shipBox(m.cream,x+dx,6.1,-159+side*4.6,.12,5.3,5.3);
    shipBox(m.dark,x,3.4,-159+side*4.6,5,.25,5.4);
  }
  for (const z of [-168,-150]) {
    shipBeam(m.steel,[45,9.6,z],[73,9.6,z],.4);
    for (const x of [46,55,64,73]) shipBeam(m.steel,[x,3,z],[x,10,z],.3);
  }
  shipBox(m.cream,45.5,9.8,-159,4.6,3.1,5.8);
  shipBox(m.soft,43.15,10.1,-159,.08,.7,4.6);
  // Offset berths are seen through the side glazing instead of being hidden
  // directly behind each sealed lock. Closed transfer couplings reach their hulls.
  for (const [a,end] of [[[0,3.1,-201],[10,6,-215]],[[-38,3.1,-159],[-43,3.1,-173]],[[38,3.1,-159],[44,3.1,-171]]]) {
    beam(m.dark,a,end,3.2,3.2);
    beam(m.steel,[a[0],a[1]-1.65,a[2]],[end[0],end[1]-1.65,end[2]],3.4,.25);
  }

  // Every custom structure shares a material draw instead of one object per rib.
  for (const [material,parts] of custom) {
    const merged = mergeGeometries(parts);
    parts.forEach(part=>part.dispose());
    merged.computeBoundingSphere();
    const object = mesh(merged,material,0,0,0);
    object.name = 'Departure head / merged structure';
  }

  // Twelve large wayfinding signs share one atlas and one geometry. A cropped
  // tile preserves each sign's aspect ratio instead of stretching its glyphs.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext('2d');
  const positions = [], uvs = [];
  const rows = Math.ceil(signs.length/2), tileHeight = 1024/rows;
  signs.forEach(([text,x,y,z,width,height,yaw=0,color='#eed2a2',background='#1a2b2d'],i) => {
    const aspect = width/height;
    const cropWidth = Math.min(496,(tileHeight-16)*aspect), cropHeight = cropWidth/aspect;
    const left = (i%2)*512+8, top = Math.floor(i/2)*tileHeight+8;
    context.fillStyle = background; context.fillRect(left,top,cropWidth,cropHeight);
    context.fillStyle = color;
    let fontSize = cropHeight*.62;
    context.font = `600 ${fontSize}px "Space Grotesk",sans-serif`;
    const textWidth = context.measureText(text).width;
    if (textWidth>cropWidth*.93) fontSize*=cropWidth*.93/textWidth;
    context.font = `600 ${fontSize}px "Space Grotesk",sans-serif`;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text,left+cropWidth/2,top+cropHeight*.53);
    const u0=(left+.6)/1024,u1=(left+cropWidth-.6)/1024;
    const v0=1-(top+cropHeight-.6)/1024,v1=1-(top+.6)/1024;
    for (const [px,py,u,v] of [[-.5,-.5,u0,v0],[.5,-.5,u1,v0],[.5,.5,u1,v1],[-.5,-.5,u0,v0],[.5,.5,u1,v1],[-.5,.5,u0,v1]]) {
      positions.push(x+Math.cos(yaw)*px*width,y+py*height,z-Math.sin(yaw)*px*width);
      uvs.push(u,v);
    }
  });
  const atlas = new THREE.CanvasTexture(canvas); atlas.colorSpace=THREE.SRGBColorSpace; atlas.anisotropy=4;
  const print = new THREE.MeshBasicMaterial({map:atlas,side:THREE.DoubleSide,toneMapped:false});
  const signGeometry = new THREE.BufferGeometry();
  signGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  signGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  signGeometry.computeBoundingSphere();
  mesh(signGeometry,print,0,0,0).name = 'Departure head / shared wayfinding atlas';

  return {
    id:'docks',
    surfaces:[
      {minX:-11,maxX:11,minZ:-141,maxZ:-129,height:0},
      {polygon:hub,height:0},
      {minX:-5,maxX:5,minZ:-201,maxZ:-168,height:0},
      {minX:-37.6,maxX:-17,minZ:-164,maxZ:-154,height:0},
      {minX:17,maxX:37.6,minZ:-164,maxZ:-154,height:0},
    ],
    spawn:{position:[0,1.75,-150],yaw:0},
    terminal:{x:5,z:-164},
    landmarks:[
      {x:-34.5,z:-159,radius:3,title:'Six minutes between worlds.',code:'GATE 06 / LOCAL SHUTTLE',text:['The orbital shuttle follows a six-minute boarding cycle. The view is included. Your luggage may arrive on a different cycle.','The compact green craft beyond this pressure lock carries dock workers, local travelers, and people pretending to be either.']},
      {x:0,z:-196,radius:3,title:'A longer kind of departure.',code:'GATE 07 / LONG-HAUL',text:['The liner is transferring cargo before passenger boarding. A low hull vibration travels through the coupling even while the departure board insists it is standing by.','Behind the west glazing, the freight winch is still handling the cargo nobody was willing to carry by hand.']},
      {x:34.5,z:-159,radius:3,title:'The things that keep moving.',code:'GATE 08 / FREIGHT TENDER',text:['An unpressurized spine carries sealed cargo modules between long-haul ships. The containers have more paperwork than the crew.','Passenger routing ends at this lock. Beyond it, the shift belongs to machinery and people with better gloves.']},
    ],
    routes:[
      [[-6.5,-148],[-6.5,-161],[-10,-161],[-10,-148],[-6.5,-148]],
      [[0,-147],[0,-194],[2,-194],[2,-147],[0,-147]],
      [[10,-151],[16,-151],[16,-159],[34,-159],[34,-157],[18,-157],[18,-148],[10,-148],[10,-151]],
      [[-15,-152],[-17,-159],[-34,-159],[-34,-157],[-16,-157],[-15,-152]],
    ],
    stats:{footprint:'octagonal hub with three boarding piers',publicLevels:1,gateCount:3,ships:3,boxInstances:boxCount,solidSegments:solidCount,customDrawCalls:custom.size+1,labels:signCount,triangles:boxCount*12+customTriangles+signCount*2,textures:1,lights:0},
  };
}
