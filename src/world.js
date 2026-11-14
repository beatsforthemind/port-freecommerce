import * as THREE from 'three';
import { applyIndustrialSurface, createSurfaceLibrary } from './surfaces.js';
import { buildConcourseAccess, RAMP_NORTH, RAMP_SOUTH, PROMENADE_HEIGHT } from './concourse-access.js';
import { PUBLIC_LIFT_SHAFTS } from './concourse-levels.js';
import {PROMENADE_SHOPS,createPromenadeSigns} from './promenade-directory.js';
import {buildPromenadeShops} from './promenade-shops.js';
import {buildPromenadeKeepers} from './promenade-keepers.js';
import {splitPromenadeRail} from './escalator-layout.js';
import {applyGlassSheen} from './kit.js';
import {createSignage} from './signage.js';
import {buildDeckShops,DECK_SHOPS} from './deck-shops.js';
import {createSky} from './sky.js';
import {CONCOURSE_INTERIOR} from './visibility.js';

// Multiple station instances can share the cached atlas during previews/tests.
const surfaceUsers = new Map();

// Architecture is assembled into material batches: the scale comes from repetition,
// without making each rib, shop shutter, or handrail a separate draw call.
export function createStation({glow = null, signage = null} = {}) {
  const group = new THREE.Group();
  group.name = 'Port FreeCommerce / main concourse';
  // The station normally letters its signs on the sheet it is handed; on its
  // own, in a preview or a test, it keeps one for itself.
  const ownSignage = signage ? null : createSignage();
  const lettering = signage || ownSignage;
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
    // Painted shopfront metal: a lit counterpart to the `dim` light colour.
    sage: new THREE.MeshStandardMaterial({ color: '#7d9a92', roughness: .72, metalness: .18 }),
    // Undersides of balconies and bridges. The darkest hull paint reflects
    // about one per cent and reads as a void from below, whatever lights it.
    soffit: new THREE.MeshStandardMaterial({ color: '#35454b', roughness: .84, metalness: .2 }),
    amber: new THREE.MeshBasicMaterial({ color: '#ffb65e' }),
    warm: new THREE.MeshBasicMaterial({ color: '#f5dec0' }),
    cool: new THREE.MeshBasicMaterial({ color: '#c2d7cf' }),
    dim: new THREE.MeshBasicMaterial({ color: '#536b67' }),
    glass: applyGlassSheen(new THREE.MeshBasicMaterial({ color: '#172e32', transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false })),
  };
  // The atlas is shared by every structural batch. Detail has a physical scale,
  // so long balcony slabs do not stretch a single panel over hundreds of metres.
  const surfaces = createSurfaceLibrary();
  surfaceUsers.set(surfaces, (surfaceUsers.get(surfaces) || 0) + 1);
  for (const key of ['shell', 'rib', 'rust', 'soffit']) applyIndustrialSurface(materials[key]);
  for (const key of ['edge', 'dark', 'sage']) applyIndustrialSurface(materials[key], {relief: false});

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
  /**
   * A sign on the shared lettering sheet. `size` is the type size against the
   * sign's width; `flat` lays the lettering on the deck; a null `background`
   * leaves it unbacked. Returns the layer's group, for signs shown together.
   */
  function text(value, x, y, z, width, height, { color = '#e6e2cf', background = '#172329', rotation = 0, align = 'center', size = 90, flat = false, layer = 'concourse' } = {}) {
    return lettering.add(value, {x, y, z, width, height, yaw: rotation, pitch: flat ? -Math.PI / 2 : 0, color, background, align, size, layer});
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
  deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0, -15); deck.receiveShadow = true; deck.userData.castShadow = false; group.add(deck);

  // A lit box's glow is made from its own shape, unless another box is set for it here.
  const glowShapes = new Map();
  // Layered pressure hull and the long, continuous vaulted roof.
  box(materials.dark, 0, 35.5, -15, 72, 2, 234);
  // The roof lining stops inside the north bulkhead's top rib, not flush with its outer face.
  box(materials.shell, 0, 34.3, -14.75, 38, .65, 231.5);
  for (const side of [-1, 1]) {
    const sx = side * 32;
    // The pressure shell clears a generous gallery threshold beneath the first
    // mezzanine, rather than reducing the side passages to low service tunnels.
    box(materials.shell, side * 35, 20.75, -15, 6, 28.5, 230);
    // Ground wall sections intentionally leave broad entries into all districts.
    const gapMin = side < 0 ? 10 : -40, gapMax = side < 0 ? 50 : 0;
    // The wall meets the shell above it. A half-metre gap here once let the
    // hall be seen from outside, along its whole length.
    for (const [a, b] of [[-130, gapMin], [gapMax, 100]]) {
      box(materials.dark, sx + side * .7, 3.25, (a + b) / 2, 1.4, 6.5, b - a);
    }
    // Elevated commercial decks and their illuminated edges.
    for (const level of [7.2, 17.2]) {
      const first = level === 7.2;
      const spans = first ? [[-130,RAMP_NORTH],[RAMP_SOUTH,100]] : [[-130,100]];
      for (const [a,b] of spans) {
        const shaft=PUBLIC_LIFT_SHAFTS.find(item=>item.side===side);
        function slab(material,y,thickness) {
          const before=Math.min(b,shaft.minZ),after=Math.max(a,shaft.maxZ);
          if(before>a)box(material,side*26.5,y,(a+before)/2,11,thickness,before-a);
          if(b>after)box(material,side*26.5,y,(after+b)/2,11,thickness,b-after);
          const low=Math.max(a,shaft.minZ),high=Math.min(b,shaft.maxZ);
          if(high>low)for(const [inner,outer]of[[21,26.7],[30.3,32]])box(material,side*(inner+outer)/2,y,(low+high)/2,outer-inner,thickness,high-low);
        }
        slab(materials.rib,level,.85);
        // The soffit hangs under the slab. Where the two overlapped, their edge faces fought.
        slab(materials.soffit,level-.5425,.235);
        box(materials.amber,side*20.9,level+.05,(a+b)/2,.1,.14,b-a);
      }
      const rails = first ? [[-130,-103],[-97,45],[51,RAMP_NORTH],[RAMP_SOUTH,100]] : [[-130,-87],[-81,17],[23,100]];
      for (const [a,b] of first?rails.flatMap(([start,end])=>splitPromenadeRail(start,end)):rails) {
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
      // Not in the last bay, where the strip would lie inside the south end wall and its halo float out through the wall.
      if (z < 100) box(materials.amber, side * 29.97, 4, z, .04, 3.5, .22);
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
      // The trunk stands on the shell face, not half inside it, and stops short of the shell's end
      // faces; the conduit stands on the trunk. Buried faces showed through every joint from afar.
      box(materials.dark, side * 31.8, yy, -15, .4, .3, 229.6);
      box(materials.edge, side * 31.54, yy + .2, -15, .12, .12, 230);
    }
    for (let z = -118; z < 94; z += 16) {
      if (z > gapMin - 6 && z < gapMax + 6) continue;
      // Each bay is framed in hull plate, with a business set into it (deck-shops.js) under a light strip.
      for (const end of [-6.1, 6.1]) box(materials.rust, side * 31.7, 2.65, z + end, .28, 5.3, .4);
      box(materials.rust, side * 31.7, 5.075, z, .28, .45, 11.8);
      box(materials.amber, side * 31.0, 5.2, z, .15, .1, 11.7);
      // Balconies reveal dense repeating hab windows at the higher levels.
      for (const yy of [11.5, 21.6, 27.7]) {
        // On the shell face, like the trunks, rather than sunk into it.
        box(materials.dark, side * 31.95, yy, z, .1, 3.2, 11.6);
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
    // Up to the lining's underside, not into it.
    box(materials.rib, 0, 33.5625, z, 43, .825, 1.2);
    // Likewise the last rib's strip, which would lie inside the south end wall.
    if (z < 100) box(materials.cool, 0, 33.05, z + .05, 17, .06, .48);
    // The first bay's panel and fins stop at the north bulkhead's inner face (z -129) instead of running out into the sky.
    const north = Math.max(z - 10, -129);
    for (const side of [-1, 1]) {
      box(materials.dark, side * 16.0, 33.0, (north + z - 2) / 2, 4, .4, z - 2 - north);
      // The fins hang 3 cm clear of the panel: flush with it, their top edges flickered from afar.
      for (let k = 0; k < 5; k++) if (z - 9 + k * 1.4 - .15 >= north) box(materials.rib, side * 16.0, 32.67, z - 9 + k * 1.4, 3.7, .2, .3);
    }
  }
  // Like the ribs, the strips stop at the lining's underside.
  for (const x of [-8.7, 8.7]) box(materials.dim, x, 33.9375, -15, .2, .075, 230);
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
    text('↑   TRANSIT   /   DOCKS 01–12', 0, .045, z, 10, 1.2, { color: '#b6bab0', background: null, size: 68, flat: true });
  }

  // North bulkhead: a monumental observation aperture above the dock throat.
  // The piers stop under the lintel, which crosses them at full depth.
  box(materials.rib, -25, 4.375, -130, 14, 8.75, 2);
  box(materials.rib, 25, 4.375, -130, 14, 8.75, 2);
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
  if (glow) for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2, b = (i + 1) / 48 * Math.PI * 2;
    glow.beam([Math.sin(a) * 6.8, 18 + Math.cos(a) * 6.8, -25], [Math.sin(b) * 6.8, 18 + Math.cos(b) * 6.8, -25], .55, '#ffb65e', .42, false);
  }
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
  ];
  signs.forEach(([v,x,y,z,r,c]) => text(v,x,y,z,10.8,1.0,{rotation:r,color:c,size:65}));

  // Crates and baggage live on the margins. Their collider shapes match the deck.
  for (const [x,z,w,h,d] of [[-22,73,2,1.4,2.5],[-27,-67,2.4,2,2],[27,-93,2.5,1.8,2.5],[-23,-110,1.7,1.2,2]]) {
    colliders.push({minX:x-w/2-.15,maxX:x+w/2+.15,minZ:z-d/2-.15,maxZ:z+d/2+.15});
    box(materials.rust,x,h/2,z,w,h,d);
    box(materials.dark,x,h/2,z+d/2+.02,w*.85,.15,.04);
    for (const dx of [-.35,.35]) box(materials.rib,x+dx*w,h/2,z,w*.06,h+.05,d+.04);
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

  // The view outside: one sky shared with the gallery and the docks.
  const sky = createSky();
  group.add(sky.group);

  const deckShops = buildDeckShops({group, box, materials, glow, shops: DECK_SHOPS});
  const access = buildConcourseAccess({group,box,beam,text,materials,colliders});
  const promenade=buildPromenadeShops({group,box,beam,materials,colliders,shops:PROMENADE_SHOPS,height:PROMENADE_HEIGHT});
  const promenadeSigns=createPromenadeSigns({group,shops:PROMENADE_SHOPS,height:PROMENADE_HEIGHT});
  const keepers=buildPromenadeKeepers({group,anchors:promenade.vendorAnchors,height:PROMENADE_HEIGHT});
  const shopLandmarks=PROMENADE_SHOPS.map(shop=>({
    x:shop.side*26.1,y:PROMENADE_HEIGHT,z:shop.z,radius:2.7,
    code:`PFC / DECK 02 / ${shop.side<0?'WEST':'EAST'} TRADE WALK`,
    title:shop.name,hint:`Inspect ${shop.name}`,text:shop.description,
  }));
  if (ownSignage) { ownSignage.build(); group.add(ownSignage.group); }
  const promenadeStats={...promenade.stats,...promenadeSigns.stats,...keepers.stats,shops:PROMENADE_SHOPS.length,types:new Set(PROMENADE_SHOPS.map(shop=>shop.type)).size};
  // Boxes wholly inside the hall are batched apart from the hull around it,
  // so the hall can be skipped as a whole while no opening to it is in view.
  const unitCube = new THREE.BoxGeometry(1,1,1);
  const corner = new THREE.Vector3(), extent = new THREE.Box3();
  const inHall = matrix => {
    extent.makeEmpty();
    for (const x of [-.5,.5]) for (const y of [-.5,.5]) for (const z of [-.5,.5]) extent.expandByPoint(corner.set(x,y,z).applyMatrix4(matrix));
    return CONCOURSE_INTERIOR.containsBox(extent);
  };
  const batchCounts = {hall: 0, hull: 0};
  for (const [mat, transforms] of batches) {
    const parts = {hall: [], hull: []};
    for (const matrix of transforms) parts[inHall(matrix) ? 'hall' : 'hull'].push(matrix);
    for (const [part, list] of Object.entries(parts)) {
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(unitCube, mat, list.length);
      mesh.name = `Concourse / ${part} boxes`;
      list.forEach((matrix, i) => mesh.setMatrixAt(i,matrix));
      mesh.instanceMatrix.needsUpdate=true;
      mesh.receiveShadow=true;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      group.add(mesh);
      batchCounts[part] += list.length;
    }
  }
  let glowFixtures = 0;
  if (glow) {
    // Every light strip and lit panel in the box batches gets its halo. Small
    // inlays (comb teeth, numerals, counter details) are below the size test.
    for (const [material, value, strength] of [
      [materials.amber, '#ffb65e', {strip: .46, panel: .3}],
      [materials.warm, '#f5dec0', {strip: .24, panel: .15}],
      [materials.cool, '#c2d7cf', {strip: .5, panel: .3}],
    ]) for (const matrix of batches.get(material) || []) if (glow.box(glowShapes.get(matrix) || matrix, value, strength)) glowFixtures++;
    // Three broad pools replace point lights that had no fixture: the tea
    // caravan's lanterns, the gallery doorway, and the dock sign.
    glow.pool(-20, 0, 51, 15, '#ffae62', .26);
    glow.pool(22, 0, -24, 16, '#97c4c5', .22);
    glow.pool(0, 0, -102, 17, '#c8d9d0', .2);
    for (const shop of PROMENADE_SHOPS) glow.pool(shop.side * 26.1, PROMENADE_HEIGHT, shop.z, 1.6, shop.accent, .14, .45, Math.max(.4, shop.width / 2 - .8));
  }
  return {
    group, colliders, surfaces:access.surfaces, journeySurfaces:access.journeySurfaces,
    shops:PROMENADE_SHOPS,promenadeStats,
    landmarks:[...access.landmarks,...shopLandmarks,...deckShops.landmarks], routes:access.routes,
    // Shown once the visitor is inside: on the arrival title it sits behind the copy.
    titleCardHidden:access.titleCardHidden,
    stats:{...access.stats,promenadeShops:PROMENADE_SHOPS.length,glowFixtures,deckShops:deckShops.stats,sky:sky.stats,boxes:batchCounts},
    update(dt,_time,context = {}) {
      if (disposed) return;
      // Following the eye is placement, so it continues under reduced motion.
      if (context.camera) sky.follow(context.camera);
      if (context.reducedMotion) return;
      // A local clock pauses motion rather than jumping to wall time on resume.
      motionTime += Math.max(0,Math.min(dt,.1));
      inner.rotation.z=-.5+motionTime*.018;
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
      ownSignage?.dispose();
      sky.dispose();
      const users = surfaceUsers.get(surfaces) - 1;
      if (users > 0) surfaceUsers.set(surfaces,users);
      else {surfaceUsers.delete(surfaces);surfaces.dispose();}
      batches.clear();
      group.clear();
    },
  };
}
