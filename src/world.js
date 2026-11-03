import * as THREE from 'three';
import { applyIndustrialSurface, createSurfaceLibrary } from './surfaces.js';
import { buildConcourseAccess, RAMP_NORTH, RAMP_SOUTH } from './concourse-access.js';

// Multiple station instances can share the cached atlas during previews/tests.
const surfaceUsers = new Map();

// Architecture is assembled into material batches: the scale comes from repetition,
// without making each rib, shop shutter, or handrail a separate draw call.
export function createStation() {
  const group = new THREE.Group();
  group.name = 'Port FreeCommerce / main concourse';
  const colliders = [];
  const batches = new Map();
  const dummy = new THREE.Object3D();
  let disposed = false;
  let motionTime = 0;
  const materials = {
    shell: new THREE.MeshStandardMaterial({ color: '#27353a', roughness: .8, metalness: .3 }),
    rib: new THREE.MeshStandardMaterial({ color: '#4b5c61', roughness: .56, metalness: .42 }),
    edge: new THREE.MeshStandardMaterial({ color: '#768080', roughness: .48, metalness: .5 }),
    dark: new THREE.MeshStandardMaterial({ color: '#131e23', roughness: .8, metalness: .2 }),
    rust: new THREE.MeshStandardMaterial({ color: '#aa5533', roughness: .66, metalness: .3 }),
    amber: new THREE.MeshBasicMaterial({ color: '#ffb65e' }),
    warm: new THREE.MeshBasicMaterial({ color: '#f5dec0' }),
    cool: new THREE.MeshBasicMaterial({ color: '#c2d7cf' }),
    dim: new THREE.MeshBasicMaterial({ color: '#536b67' }),
    glass: new THREE.MeshBasicMaterial({ color: '#172e32', transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false }),
  };
  // The atlas is shared by every structural batch. Detail has a physical scale,
  // so long balcony slabs do not stretch a single panel over hundreds of metres.
  const surfaces = createSurfaceLibrary();
  surfaceUsers.set(surfaces, (surfaceUsers.get(surfaces) || 0) + 1);
  for (const key of ['shell', 'rib', 'rust']) applyIndustrialSurface(materials[key]);
  for (const key of ['edge', 'dark']) applyIndustrialSurface(materials[key], {relief: false});

  function box(mat, x, y, z, w, h, d, ry = 0, rz = 0) {
    const transforms = batches.get(mat) || [];
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, ry, rz);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    transforms.push(dummy.matrix.clone());
    batches.set(mat, transforms);
  }
  function beam(mat, a, b, width = .2, depth = width) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const transforms = batches.get(mat) || [];
    dummy.position.copy(from).add(to).multiplyScalar(.5);
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    dummy.scale.set(width, from.distanceTo(to), depth);
    dummy.updateMatrix();
    transforms.push(dummy.matrix.clone());
    batches.set(mat, transforms);
  }
  function text(value, x, y, z, width, height, { color = '#e6e2cf', background = '#172329', rotation = 0, align = 'center', size = 90 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.max(64, Math.round(1024 * height / width));
    const ctx = canvas.getContext('2d');
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.fillStyle = color;
    ctx.font = `600 ${size}px "Arial", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(value, align === 'center' ? 512 : 48, canvas.height / 2, 944);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: !background, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    group.add(mesh);
    return mesh;
  }

  // A subtly worn deck, with seams that remain legible from human eye level.
  const deckCanvas = document.createElement('canvas');
  deckCanvas.width = deckCanvas.height = 512;
  const dc = deckCanvas.getContext('2d');
  dc.fillStyle = '#354247'; dc.fillRect(0, 0, 512, 512);
  let seed = 17;
  function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  for (let i = 0; i < 18000; i++) {
    dc.fillStyle = `rgba(${rand() > .5 ? '175,187,181' : '9,18,22'},${rand() * .1})`;
    dc.fillRect(rand() * 512, rand() * 512, 1 + rand() * 3, 1);
  }
  dc.lineWidth = 3; dc.strokeStyle = '#202c31';
  for (let i = 0; i <= 512; i += 128) { dc.beginPath(); dc.moveTo(i, 0); dc.lineTo(i, 512); dc.stroke(); dc.beginPath(); dc.moveTo(0, i); dc.lineTo(512, i); dc.stroke(); }
  dc.strokeStyle = '#4e5a5d'; dc.lineWidth = 1;
  dc.strokeRect(5, 5, 502, 502);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * 128, y = j * 128;
    // Recessed seams, rubbed panel centres, and baked edge dirt read as relief.
    const edgeDirt = dc.createLinearGradient(x, y, x, y + 128);
    edgeDirt.addColorStop(0, 'rgba(4,15,18,.28)'); edgeDirt.addColorStop(.07, 'rgba(4,15,18,0)');
    edgeDirt.addColorStop(.88, 'rgba(4,15,18,0)'); edgeDirt.addColorStop(1, 'rgba(4,15,18,.24)');
    dc.fillStyle = edgeDirt; dc.fillRect(x, y, 128, 128);
    dc.strokeStyle = 'rgba(144,156,144,.25)'; dc.lineWidth = .9;
    dc.strokeRect(x + 3.5, y + 3.5, 120, 120);
    for (const dx of [9, 119]) for (const dy of [9, 119]) {
      dc.fillStyle = '#192a2d'; dc.beginPath(); dc.arc(x + dx, y + dy, 2.8, 0, Math.PI * 2); dc.fill();
      dc.fillStyle = '#89958b'; dc.fillRect(x + dx - 1, y + dy - 1, 2, 1);
    }
    dc.fillStyle = 'rgba(162,170,150,.3)'; dc.font = '5px sans-serif';
    dc.fillText(`D1 / ${702 + i * 4 + j}`, x + 18, y + 116);
    for (let mark = 0; mark < 16; mark++) {
      const sx = x + 12 + rand() * 104, sy = y + 15 + rand() * 96;
      dc.strokeStyle = mark % 3 ? 'rgba(10,22,25,.15)' : 'rgba(170,181,159,.1)';
      dc.lineWidth = .3 + rand() * 1.8;
      dc.beginPath(); dc.moveTo(sx, sy); dc.lineTo(sx + 1 + rand() * 22, sy + rand() * 4 - 2); dc.stroke();
    }
    if ((i + j) % 4 === 0) {
      dc.strokeStyle = 'rgba(10,22,25,.15)'; dc.lineWidth = 4;
      dc.beginPath(); dc.arc(x + 80, y + 60, 22, -.9, .9); dc.stroke();
      dc.strokeStyle = 'rgba(177,165,123,.28)'; dc.lineWidth = 2;
      dc.strokeRect(x + 20, y + 20, 20, 13);
    }
  }
  const deckTexture = new THREE.CanvasTexture(deckCanvas);
  deckTexture.colorSpace = THREE.SRGBColorSpace;
  deckTexture.wrapS = deckTexture.wrapT = THREE.RepeatWrapping;
  deckTexture.repeat.set(8, 28.75);
  deckTexture.anisotropy = 8;
  const deckMat = new THREE.MeshStandardMaterial({ map: deckTexture, color: '#a1aaa5', roughness: .66, metalness: .28 });
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(64, 230), deckMat);
  deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0, -15); deck.receiveShadow = true; group.add(deck);

  // Layered pressure hull and the long, continuous vaulted roof.
  box(materials.dark, 0, 35.5, -15, 72, 2, 234);
  box(materials.shell, 0, 34.3, -15, 38, .65, 232);
  for (const side of [-1, 1]) {
    const sx = side * 32;
    // The pressure shell clears a generous gallery threshold beneath the first
    // mezzanine, rather than reducing the side passages to low service tunnels.
    box(materials.shell, side * 35, 20.75, -15, 6, 28.5, 230);
    // Ground wall sections intentionally leave broad entries into all districts.
    const gapMin = side < 0 ? 10 : -40, gapMax = side < 0 ? 50 : 0;
    for (const [a, b] of [[-130, gapMin], [gapMax, 100]]) {
      box(materials.dark, sx + side * .7, 3, (a + b) / 2, 1.4, 6, b - a);
    }
    // Elevated commercial decks and their illuminated edges.
    for (const level of [7.2, 17.2]) {
      const first = level === 7.2;
      const spans = first ? [[-130,RAMP_NORTH],[RAMP_SOUTH,100]] : [[-130,100]];
      for (const [a,b] of spans) {
        box(materials.rib,side*26.5,level,(a+b)/2,11,.85,b-a);
        box(materials.dark,side*26.5,level-.5,(a+b)/2,11,.32,b-a);
        box(materials.amber,side*20.9,level+.05,(a+b)/2,.1,.14,b-a);
      }
      const rails = first ? [[-130,-103],[-97,45],[51,RAMP_NORTH],[RAMP_SOUTH,100]] : [[-130,100]];
      for (const [a,b] of rails) {
        box(materials.edge,side*21.2,level+1.5,(a+b)/2,.11,.11,b-a);
        box(materials.edge,side*21.2,level+.75,(a+b)/2,.07,.07,b-a);
        for(let z=a+.8;z<b;z+=5) box(materials.edge,side*21.2,level+.75,z,.09,1.5,.09);
      }
    }
    // Heavy bolted support ribs and angled ceiling shoulders.
    for (let z = -124; z <= 100; z += 16) {
      box(materials.rib, side * 30.8, 15.8, z, 1.5, 31.6, 2.0);
      colliders.push({ minX: side * 30.8 - .85, maxX: side * 30.8 + .85, minZ: z - 1.1, maxZ: z + 1.1, minY:0, maxY:31.6 });
      box(materials.dark, side * 30.0, 3, z, .25, 6, 2.5);
      box(materials.amber, side * 29.97, 4, z, .04, 3.5, .22);
      beam(materials.rib, [side * 30.8, 26.0, z], [side * 21, 34, z], 1, 1.2);
      beam(materials.dark, [side * 29.8, 26.3, z + 1], [side * 20.6, 33.8, z + 1], .35, .3);
      box(materials.rib, side * 23.2, 33.5, z, 2.0, .6, 2.5);
      // Tall buttresses make eye-level views feel inhabited rather than empty.
      if (z < RAMP_NORTH || z > RAMP_SOUTH) {
        beam(materials.rib, [side * 25.0, 0, z], [side * 30.1, 6.9, z], .55, .75);
        box(materials.edge, side * 25, .5, z, 1.0, 1, 1.2);
      // Project the diagonal's lower two metres onto the walking plane. The
      // support rises clear above that height; the branch axes remain open.
        colliders.push({ minX: side < 0 ? -27.1 : 24.3, maxX: side < 0 ? -24.3 : 27.1, minZ: z - .8, maxZ: z + .8, minY:0,maxY:2.2 });
      }
    }
    // Industrial service trunks and fine horizontal conduits.
    for (const yy of [10.1, 12.0, 20.5, 22.6, 29.8]) {
      box(materials.dark, side * 32.0, yy, -15, .8, .3, 230);
      box(materials.edge, side * 31.55, yy + .2, -15, .12, .12, 230);
    }
    for (let z = -118; z < 94; z += 16) {
      if (z > gapMin - 6 && z < gapMax + 6) continue;
      // Inset storefronts, lit merchandise windows and rolling cargo shutters.
      box(materials.rust, side * 31.7, 2.65, z, .28, 5.3, 12.6);
      box(materials.dark, side * 31.4, 2.5, z, .3, 4.7, 11.8);
      box(materials.warm, side * 31.17, 2.8, z - 2, .08, 2.8, 5.8);
      for (let k = 0; k < 4; k++) box(materials.dark, side * 31.03, 2.7, z - 4.3 + k * 1.5, .1, 3.1, .15);
      box(materials.shell, side * 31.06, 1.35, z - 2, .12, 1.2, 6.2);
      box(materials.dark, side * 30.95, 3.6, z + 4, .14, 1.8, 2.3);
      for (let l = 0; l < 6; l++) box(materials.rib, side * 30.84, 2.6 + l * .27, z + 4, .1, .055, 2.2);
      box(materials.amber, side * 31.0, 5.2, z, .15, .1, 11.7);
      // Balconies reveal dense repeating hab windows at the higher levels.
      for (const yy of [11.5, 21.6, 27.7]) {
        box(materials.dark, side * 32.0, yy, z, .2, 3.2, 11.6);
        for (let k = 0; k < 4; k++) {
          const light = (Math.floor(z + 160) + k) % 5 < 3 ? materials.dim : materials.warm;
          box(light, side * 31.85, yy, z - 4.5 + k * 3, .08, 1.6, 1.8);
          box(materials.shell, side * 31.7, yy - .4, z - 4.5 + k * 3, .08, .08, 1.8);
        }
      }
    }
  }

  // Roof ribs cross the entire station, beneath broad luminous service panels.
  for (let z = -124; z <= 100; z += 16) {
    box(materials.rib, 0, 33.6, z, 43, .9, 1.2);
    box(materials.cool, 0, 33.05, z + .05, 17, .06, .48);
    for (const side of [-1, 1]) {
      box(materials.dark, side * 16.0, 33.0, z - 6, 4, .4, 8);
      for (let k = 0; k < 5; k++) box(materials.rib, side * 16.0, 32.7, z - 9 + k * 1.4, 3.7, .2, .3);
    }
  }
  for (const x of [-8.7, 8.7]) box(materials.dim, x, 34, -15, .2, .2, 230);
  for (let z = -115; z < 95; z += 10) {
    for (const x of [-9.5, 9.5]) {
      box(materials.amber, x, .025, z, .13, .018, 5.6);
      box(materials.dark, x + Math.sign(x) * .3, .02, z, .17, .02, 9.5);
    }
    box(materials.dim, 0, .025, z, .12, .02, 1.8);
  }
  // Floor track grids and a few flush service hatch lids.
  for (const side of [-1, 1]) {
    box(materials.dark, side * 17.5, .015, -15, 1, .025, 229);
    for (let z = -128; z < 100; z += .8) box(materials.rib, side * 17.5, .031, z, .8, .016, .09);
    for (let z = -110; z < 100; z += 32) box(materials.dark, side * 13.2, .02, z, 2.5, .028, 3.2);
  }
  for (const z of [65, 17, -65, -108]) {
    const decal = text('↑   TRANSIT   /   DOCKS 01–12', 0, .045, z, 10, 1.2, { color: '#b6bab0', background: null, size: 68 });
    decal.rotation.x = -Math.PI / 2;
  }

  // North bulkhead: a monumental observation aperture above the dock throat.
  box(materials.rib, -25, 4.8, -130, 14, 9.6, 2);
  box(materials.rib, 25, 4.8, -130, 14, 9.6, 2);
  for (const x of [-25,25]) colliders.push({minX:x-7,maxX:x+7,minZ:-131,maxZ:-129,minY:0,maxY:9.6});
  box(materials.rib, 0, 33.3, -130, 65, 2.3, 2);
  box(materials.dark, 0, 9.4, -130, 64, 1.3, 2);
  for (const x of [-31, -16, 0, 16, 31]) box(materials.rib, x, 21.3, -130, .6, 23, .8);
  box(materials.rib, 0, 22, -130, 64, .35, .8);
  box(materials.glass, 0, 21.1, -130.1, 61.5, 22, .03);
  box(materials.amber, 0, 8.7, -128.9, 29, .13, .1);
  text('PORT FREECOMMERCE', 0, 29, -128.6, 28, 3.1, { color: '#e8dfc8', background: null, size: 84 });
  text('TRANSIT DOCKS     01 — 12     ↑', 0, 7.25, -128.8, 26, 1.4, { color: '#ffd28b', background: '#1e2c30', size: 62 });

  // Entry end is deliberately distant and layered rather than a flat end wall.
  box(materials.dark, 0, 17, 100, 64, 34, 1);
  for (const x of [-24, -8, 8, 24]) {
    box(materials.rib, x, 12, 99, .8, 24, 1);
    colliders.push({minX:x-.4,maxX:x+.4,minZ:98.5,maxZ:99.5,minY:0,maxY:24});
    box(materials.dim, x, 12, 98.4, .08, 19, .08);
  }
  text('ARRIVALS   /   CUSTOMS', 0, 12, 98.3, 25, 2.3, { rotation: Math.PI, color: '#c0c8bc', size: 78 });

  // The suspended navigation gyroscope is the concourse's unmistakable landmark.
  const halo = new THREE.Group();
  halo.position.set(0, 18.0, -25);
  const outer = new THREE.Mesh(new THREE.TorusGeometry(7.6, .46, 12, 96), materials.rib);
  halo.add(outer);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.8, .13, 8, 112), materials.amber);
  halo.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(6.4, .075, 8, 112, Math.PI * 1.65), materials.dim);
  inner.rotation.z = -.5; halo.add(inner);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(.10, .58, .18), materials.warm);
    tick.position.set(Math.sin(a) * 7.6, Math.cos(a) * 7.6, .5); tick.rotation.z = -a; halo.add(tick);
  }
  group.add(halo);
  for (const x of [-6.5, 6.5]) beam(materials.dark, [x, 23.4, -25], [x, 34, -25], .12);
  text('P / F C', 0, 19.2, -24.35, 9.4, 2.2, { background: null, color: '#e8e6d6', size: 125 });
  text('FREE TRADE. EVERY ORBIT.', 0, 16.5, -24.35, 9.8, .8, { background: null, color: '#dfb77c', size: 58 });
  box(materials.dark, 0, 9, -25, 17, 2.0, .65);
  box(materials.amber, -8.4, 9, -24.6, .12, 2, .05);
  text('01   CENTRAL CONCOURSE', 0, 9.15, -24.6, 16.5, 1.45, { color: '#e6ddbe', size: 68 });
  for (const x of [-7, 7]) beam(materials.dark, [x, 10, -25], [x, 13.8, -25], .1);

  // Direction markers bridge human scale and the much larger structural rhythm.
  const signs = [
    ['EXCHANGE   /   FOOD   ←', -22.7, 5.0, 36, Math.PI / 2, '#f8bc75'],
    ['OBSERVATION GALLERY   →', 22.7, 5.0, -19, -Math.PI / 2, '#c3dcd2'],
    ['CARGO / SERVICE', -30.6, 5.8, -51, Math.PI / 2, '#f8bc75'],
    ['PASSAGE / SUPPLY', 30.6, 5.8, 43, -Math.PI / 2, '#f8bc75'],
    ['NOODLES  /  24H', -30.7, 4.6, 83, Math.PI / 2, '#ffb75c'],
    ['ORBITAL SUPPLY', 30.7, 4.6, 75, -Math.PI / 2, '#d2d8c9'],
    ['CONTRACTS & CLAIMS', -30.7, 4.6, -99, Math.PI / 2, '#a8c7bf'],
    ['SHORT-STAY HABITATS', 30.7, 4.6, -83, -Math.PI / 2, '#e7cc9b'],
  ];
  signs.forEach(([v,x,y,z,r,c]) => text(v,x,y,z,10.8,1.0,{rotation:r,color:c,size:65}));

  // Crates and baggage live on the margins. Their collider shapes match the deck.
  for (const [x,z,w,h,d] of [[-22,73,2,1.4,2.5],[24,57,1.8,1.2,2],[-27,-67,2.4,2,2],[27,-93,2.5,1.8,2.5],[-23,-110,1.7,1.2,2]]) {
    box(materials.rust,x,h/2,z,w,h,d);
    box(materials.dark,x,h/2,z+d/2+.02,w*.85,.15,.04);
    for (const dx of [-.35,.35]) box(materials.rib,x+dx*w,h/2,z,w*.06,h+.05,d+.04);
    colliders.push({minX:x-w/2-.15,maxX:x+w/2+.15,minZ:z-d/2-.15,maxZ:z+d/2+.15});
  }

  // Service infrastructure stays in the existing material batches and above the
  // walking clearance. These details add scale without new lights or draw calls.
  let extraDetailBoxes = 0;
  const detailBox = (...args) => {box(...args); extraDetailBoxes++;};
  for (const side of [-1, 1]) {
    for (let z = -116; z < 96; z += 32) {
      const gapMin = side < 0 ? 10 : -40, gapMax = side < 0 ? 50 : 0;
      if (z > gapMin - 5 && z < gapMax + 5) continue;
      // Wall-mounted exchanger units, louvers, isolation valves, and feed cable.
      detailBox(materials.rib, side * 31.05, 4.05, z + 5, .55, 2.5, 2.5);
      detailBox(materials.dark, side * 30.74, 4.05, z + 5, .1, 2.15, 2.12);
      detailBox(materials.edge, side * 30.64, 5.08, z + 5, .09, .07, 2.12);
      for (let i = 0; i < 6; i++) detailBox(materials.rib, side * 30.62, 3.38 + i * .24, z + 5, .18, .09, 1.7);
      detailBox(materials.amber, side * 30.59, 4.85, z + 5.7, .07, .1, .1);
      detailBox(materials.dark, side * 31.15, 5.8, z + 6, .2, 1.05, .2);
      detailBox(materials.edge, side * 31.03, 5.8, z + 6, .08, .08, .32);
    }
    for (let z = -124; z <= 100; z += 16) {
      // Bolted foot collars sit entirely inside the existing column colliders.
      detailBox(materials.dark, side * 30.8, .28, z, 1.65, .55, 2.1);
      detailBox(materials.edge, side * 29.94, .63, z, .1, .12, 2.1);
      for (const dz of [-.72, .72]) detailBox(materials.rust, side * 29.92, .31, z + dz, .14, .18, .18);
      // Suspended cable trays and their hangers follow the structural rhythm.
      detailBox(materials.rib, side * 12.8, 31.9, z, 1.25, .12, .22);
      detailBox(materials.edge, side * 12.25, 32.45, z, .06, 1.15, .06);
      detailBox(materials.edge, side * 13.35, 32.45, z, .06, 1.15, .06);
    }
    for (const x of [12.3, 12.65, 13, 13.35]) detailBox(materials.dark, side * x, 31.9, -15, .17, .17, 228);
    for (const x of [12.12, 13.53]) detailBox(materials.rib, side * x, 31.88, -15, .07, .25, 228);
  }
  group.userData.detailStats = {extraDrawCalls: 0, extraTriangles: extraDetailBoxes * 12, atlasTextures: 2, atlasSize: 1024};

  // A distant original planet texture, generated locally. No asset download needed.
  const planetCanvas = document.createElement('canvas');
  planetCanvas.width = 1024; planetCanvas.height = 512;
  const pc = planetCanvas.getContext('2d');
  const gradient = pc.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#8b9f9c'); gradient.addColorStop(.35, '#aab1a0'); gradient.addColorStop(.5, '#6b8588'); gradient.addColorStop(.72, '#b2ab8d'); gradient.addColorStop(1, '#6b8b90');
  pc.fillStyle = gradient; pc.fillRect(0,0,1024,512);
  for (let i=0;i<85;i++) {
    const y=rand()*512; pc.strokeStyle = `rgba(${i%3 ? '220,211,182':'40,70,77'},${.06+rand()*.18})`; pc.lineWidth=2+rand()*12;
    pc.beginPath(); pc.moveTo(0,y);
    for(let x=0;x<=1024;x+=16) pc.lineTo(x,y+Math.sin(x*.012+i)*7+Math.sin(x*.026+i)*3);
    pc.stroke();
  }
  const planetMap = new THREE.CanvasTexture(planetCanvas); planetMap.colorSpace = THREE.SRGBColorSpace;
  const planet = new THREE.Mesh(new THREE.SphereGeometry(285, 64, 48), new THREE.MeshStandardMaterial({map:planetMap, roughness:1, metalness:0, emissive:'#334446', emissiveIntensity:.2, fog:false}));
  planet.position.set(-75,140,-850); planet.rotation.z=-.22; group.add(planet);
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(289,48,32),new THREE.MeshBasicMaterial({color:'#b4d9d3',transparent:true,opacity:.07,side:THREE.BackSide,depthWrite:false,fog:false}));
  atmosphere.position.copy(planet.position); group.add(atmosphere);
  const starPositions=[];
  for(let i=0;i<1400;i++) { const a=rand()*Math.PI*2,u=rand()*2-1,r=1100; starPositions.push(Math.cos(a)*Math.sqrt(1-u*u)*r,u*r,Math.sin(a)*Math.sqrt(1-u*u)*r); }
  const starGeometry=new THREE.BufferGeometry(); starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  group.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#c0d0cc',size:1.0,sizeAttenuation:true,transparent:true,opacity:.7,depthWrite:false,fog:false})));

  const access = buildConcourseAccess({group,box,beam,text,materials});
  for (const [mat, transforms] of batches) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), mat, transforms.length);
    transforms.forEach((matrix, i) => mesh.setMatrixAt(i,matrix));
    mesh.instanceMatrix.needsUpdate=true;
    mesh.receiveShadow=true;
    group.add(mesh);
  }
  const driftLights = [];
  for (const [x,z,color,power] of [[-22,55,0xffae62,80],[22,-25,0x97c4c5,90],[0,-98,0xc8d9d0,100]]) {
    const light = new THREE.PointLight(color,power,45,1.3); light.position.set(x,5,z); group.add(light); driftLights.push(light);
  }
  return {
    group, colliders, surfaces:access.surfaces, landmarks:access.landmarks, routes:access.routes, stats:access.stats,
    update(dt,_time,context = {}) {
      if (disposed || context.reducedMotion) return;
      // A local clock pauses motion rather than jumping to wall time on resume.
      motionTime += Math.max(0,Math.min(dt,.1));
      inner.rotation.z=-.5+motionTime*.018;
      planet.rotation.y=motionTime*.003;
      driftLights[0].intensity=80+Math.sin(motionTime*.65)*3;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set(), ownedMaterials = new Set(Object.values(materials)), textures = new Set();
      group.traverse(node => {
        if (node.isLight) {node.dispose?.();return;}
        if (!node.isMesh && !node.isPoints) return;
        // InstancedMesh.dispose also releases instanceMatrix/instanceColor.
        node.dispose?.();
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) ownedMaterials.add(material);
      });
      for (const material of ownedMaterials) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      textures.delete(surfaces.albedo); textures.delete(surfaces.normal);
      geometries.forEach(geometry=>geometry.dispose());
      ownedMaterials.forEach(material=>material.dispose());
      textures.forEach(texture=>texture.dispose());
      const users = surfaceUsers.get(surfaces) - 1;
      if (users > 0) surfaceUsers.set(surfaces,users);
      else {surfaceUsers.delete(surfaces);surfaces.dispose();}
      batches.clear();
      group.clear();
    },
  };
}
