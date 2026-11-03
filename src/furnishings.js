import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Six static material batches, including all printed details and soft contact shadows. */
export function createFurnishings({importedTrees = false} = {}) {
  const group = new THREE.Group();
  group.name = 'Concourse / passenger infrastructure';
  const colliders = [];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const tileW = 512, tileH = 256;
  const tile = (index, draw) => {
    ctx.save(); ctx.translate((index % 2) * tileW, Math.floor(index / 2) * tileH);
    ctx.beginPath(); ctx.rect(0, 0, tileW, tileH); ctx.clip(); draw(); ctx.restore();
  };
  tile(0, () => {
    ctx.fillStyle = '#13272b'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#e4b27a'; ctx.font = '600 23px sans-serif'; ctx.fillText('DEPARTURES / 07', 22, 35);
    ctx.fillStyle = '#829b90'; ctx.font = '11px sans-serif'; ctx.fillText('DESTINATION                 VESSEL              STATUS', 22, 62);
    const rows = [['PRESERVATION', 'PERIHELION', 'BOARDING'], ['NEW TIDELAND', 'CINDER 04', 'IN TRANSIT'], ['OUTER RIM', 'FAR REACH', 'STAND BY'], ['CORPORATION RIM', 'LONGITUDE', 'CARGO HOLD']];
    rows.forEach((r, i) => {
      const y = 96 + i * 38;
      ctx.strokeStyle = '#8baf9b35'; ctx.beginPath(); ctx.moveTo(22, y + 13); ctx.lineTo(490, y + 13); ctx.stroke();
      ctx.font = '600 14px sans-serif'; ctx.fillStyle = '#d5ddc6'; ctx.fillText(r[0], 22, y);
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#a2b9aa'; ctx.fillText(r[1], 230, y);
      ctx.fillStyle = i === 0 ? '#e4b27a' : '#89aa93'; ctx.fillText(r[2], 383, y);
    });
    for (let y = 1; y < 256; y += 4) { ctx.fillStyle = '#06131915'; ctx.fillRect(0, y, 512, 1); }
  });
  tile(1, () => {
    ctx.fillStyle = '#c4ae7c'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#253536';
    for (let x = -100; x < 600; x += 70) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 35, 0); ctx.lineTo(x + 150, 256); ctx.lineTo(x + 115, 256); ctx.fill(); }
    ctx.fillStyle = '#192b2a'; ctx.fillRect(65, 74, 382, 107);
    ctx.fillStyle = '#ddc79e'; ctx.font = '600 31px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('KEEP CLEAR', 256, 119);
    ctx.font = '17px sans-serif'; ctx.fillText('AUTOMATED CARGO ROUTE', 256, 151);
  });
  tile(2, () => {
    ctx.fillStyle = '#9ca897'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#263b3a'; ctx.fillRect(12, 12, 488, 232);
    ctx.strokeStyle = '#b3bda2'; ctx.lineWidth = 2; ctx.strokeRect(24, 24, 464, 208);
    ctx.fillStyle = '#d6d8b5'; ctx.font = '600 31px sans-serif'; ctx.fillText('PFC / SERVICE 108', 43, 77);
    ctx.font = '17px sans-serif'; ctx.fillText('AIR HANDLING · DECK 01', 43, 111);
    ctx.fillStyle = '#a4b29c'; ctx.font = '12px sans-serif'; ctx.fillText('MAINTENANCE CYCLE  327.06 / 04', 43, 145);
    for (let i = 0; i < 74; i++) { ctx.fillStyle = i % 3 ? '#d9ddbf' : '#758d7b'; ctx.fillRect(43 + i * 5, 169, i % 4 ? 2 : 4, 32); }
  });
  tile(3, () => {
    const gradient = ctx.createRadialGradient(256, 128, 8, 256, 128, 123);
    gradient.addColorStop(0, 'rgba(2,12,15,.66)'); gradient.addColorStop(.35, 'rgba(2,12,15,.4)'); gradient.addColorStop(1, 'rgba(2,12,15,0)');
    ctx.translate(256, 128); ctx.scale(2, 1); ctx.translate(-256, -128);
    ctx.fillStyle = gradient; ctx.fillRect(120, 0, 272, 256);
  });
  tile(4, () => {
    ctx.fillStyle = '#142e30'; ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#9aad91'; ctx.lineWidth = 2;
    for (let r = 28; r < 120; r += 23) { ctx.beginPath(); ctx.arc(124, 128, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#dcaf77'; ctx.beginPath(); ctx.ellipse(124, 128, 105, 44, -.6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#d5cfab'; ctx.font = '600 28px sans-serif'; ctx.fillText('PELAGOS', 258, 77);
    ctx.fillStyle = '#a2bfa8'; ctx.font = '17px sans-serif'; ctx.fillText('OBSERVATION', 258, 119); ctx.fillText('GALLERY / 02', 258, 146);
    ctx.fillStyle = '#d8aa77'; ctx.font = '13px sans-serif'; ctx.fillText('A LONGER PERSPECTIVE', 258, 193);
  });
  tile(5, () => {
    ctx.fillStyle = '#b16c45'; ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#e6c79a'; ctx.lineWidth = 3; ctx.strokeRect(17, 17, 478, 222);
    ctx.fillStyle = '#edd5ac'; ctx.font = '600 43px sans-serif'; ctx.fillText('STAY A WHILE.', 36, 80);
    ctx.font = '23px sans-serif'; ctx.fillText('SECOND ORBIT / SHORT STAY', 36, 125);
    ctx.font = '15px sans-serif'; ctx.fillText('A BED. A DOOR. YOUR OWN SMALL CORNER.', 36, 178);
    ctx.fillText('HABITAT DECKS 02—06                         →', 36, 208);
  });
  tile(6, () => {
    ctx.fillStyle = '#d6bd8d'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#233a38'; ctx.font = '600 88px sans-serif'; ctx.fillText('01', 27, 112);
    ctx.font = '600 26px sans-serif'; ctx.fillText('CONCOURSE', 160, 66); ctx.font = '16px sans-serif'; ctx.fillText('PASSENGER REST AREA', 160, 101);
    ctx.fillRect(28, 147, 455, 3); ctx.font = '18px sans-serif'; ctx.fillText('ALL ROUTES CONTINUE FROM HERE.', 28, 192);
    ctx.font = '12px sans-serif'; ctx.fillText('INDEPENDENT TRADE STATION / FREECOMMERCE', 28, 222);
  });
  tile(7, () => {
    ctx.strokeStyle = '#9bb39a'; ctx.lineWidth = 3; ctx.strokeRect(16, 16, 480, 224);
    ctx.fillStyle = '#a8bb99'; ctx.font = '600 55px sans-serif'; ctx.fillText('↑', 238, 72);
    ctx.font = '600 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TRANSIT DOCKS', 256, 143);
    ctx.font = '19px sans-serif'; ctx.fillText('CONTINUE NORTH / 07', 256, 194);
  });
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  const materials = {
    metal: new THREE.MeshStandardMaterial({color: '#435457', roughness: .67, metalness: .58}),
    dark: new THREE.MeshStandardMaterial({color: '#1b2e31', roughness: .8, metalness: .3}),
    sage: new THREE.MeshStandardMaterial({color: '#718473', roughness: .91, metalness: .02}),
    rust: new THREE.MeshStandardMaterial({color: '#965c3d', roughness: .8, metalness: .3}),
    warm: new THREE.MeshBasicMaterial({color: '#dfb67e'}),
    print: new THREE.MeshBasicMaterial({map: atlas, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1}),
  };
  materials.print.forceSinglePass = true;
  const batches = new Map();
  const object = new THREE.Object3D();
  function add(geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) {
    object.position.set(x, y, z); object.rotation.set(rx, ry, rz); object.scale.set(1, 1, 1); object.updateMatrix();
    geometry.applyMatrix4(object.matrix);
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(geometry);
  }
  function box(material, x, y, z, w, h, d) { add(new THREE.BoxGeometry(w, h, d), material, x, y, z); }
  function decal(index, x, y, z, w, h, rx = 0, ry = 0, rz = 0) {
    const geometry = new THREE.PlaneGeometry(w, h);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ((index % 2) + .008 + uv.getX(i) * .984) / 2, 1 - (Math.floor(index / 2) + .008 + (1 - uv.getY(i)) * .984) / 4);
    add(geometry, materials.print, x, y, z, rx, ry, rz);
  }
  function shadow(x, z, w, d) { decal(3, x, .011, z, w, d, -Math.PI / 2); }

  // Rest islands sit beyond the pedestrian traffic lanes and under the balconies.
  for (const side of [-1, 1]) {
    const x = side * 21.7;
    for (const z of [62, 12, -51, -97]) {
      shadow(x, z, 5, 9);
      box(materials.dark, x, .33, z, 2.1, .66, 6.5);
      box(materials.metal, x, .68, z, 2.4, .1, 6.9);
      for (let i = -1; i <= 1; i++) {
        box(materials.sage, x, .8, z + i * 2.1, 2.15, .19, 1.95);
        box(materials.sage, x + side * .9, 1.36, z + i * 2.1, .2, 1.05, 1.95);
        box(materials.metal, x - side * .25, 1.1, z + i * 2.1 + 1, 1.7, .11, .1);
      }
      box(materials.warm, x - side * 1.06, .5, z, .035, .055, 5.9);
      colliders.push({minX: x - 1.25, maxX: x + 1.25, minZ: z - 3.6, maxZ: z + 3.6});
      const pz = z + 5.3;
      shadow(x, pz, 4, 4);
      box(materials.rust, x, .63, pz, 2.05, 1.26, 2.05);
      box(materials.metal, x, 1.23, pz, 2.15, .1, 2.15);
      box(materials.dark, x, 1.3, pz, 1.85, .08, 1.85);
      const usesImportedTree = importedTrees && ((side === -1 && z === 62) || (side === 1 && z === -51));
      if (!usesImportedTree) {
        for (let i = 0; i < 15; i++) {
          const angle = i * 2.4 + z;
          const height = .9 + (i % 4) * .3;
          add(new THREE.ConeGeometry(.16 + (i % 3) * .05, height, 3), materials.sage, x + Math.cos(angle) * .48, 1.4 + height * .4, pz + Math.sin(angle) * .48, Math.cos(angle) * .45, angle, Math.sin(angle) * .5);
        }
      }
      colliders.push({minX: x - 1.13, maxX: x + 1.13, minZ: pz - 1.13, maxZ: pz + 1.13});
    }
    for (const z of [60, -42]) {
      const bx = side * 28;
      const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      shadow(bx, z, 4, 4);
      box(materials.dark, bx, .3, z, 1.9, .6, 1.9);
      box(materials.metal, bx, 2.8, z, .25, 5, .4);
      box(materials.dark, bx, 4.6, z, .3, 3.05, 8.1);
      box(materials.warm, bx - side * .18, 6.05, z, .04, .06, 8.1);
      decal(0, bx - side * .17, 4.6, z, 7.8, 2.8, 0, ry);
      decal(5, bx + side * .17, 4.6, z, 7.8, 2.8, 0, -ry);
      colliders.push({minX: bx - 1, maxX: bx + 1, minZ: z - 1, maxZ: z + 1});
    }
  }

  // Baked contact shadows anchor the existing architecture with no shadow maps.
  for (let z = -124; z <= 100; z += 16) for (const side of [-1, 1]) shadow(side * 26, z, 5.2, 4.5);
  for (const [x, z] of [[-10, 18], [89, -20], [-72, 30], [5, -164]]) shadow(x, z, 3.4, 2.8);
  for (const z of [80, 0, -85]) decal(7, 0, .035, z, 5, 2.5, -Math.PI / 2);
  for (const side of [-1, 1]) {
    decal(1, side * 15, .036, -121, 4, 1.8, -Math.PI / 2);
    decal(6, side * 30.96, 2.4, 91, 3.5, 1.7, 0, -side * Math.PI / 2);
  }

  let triangles = 0;
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    triangles += geometry.index.count / 3;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    geometries.forEach(g => g.dispose());
  }
  return {
    group, colliders,
    stats: {drawCalls: batches.size, triangles, textures: 1},
    dispose() { group.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); Object.values(materials).forEach(m => m.dispose()); atlas.dispose(); },
  };
}
