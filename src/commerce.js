import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Small independent traders make the port feel like a place people actually use. */
export function createCommerce({importedTree = false, importedPot = false} = {}) {
  const group = new THREE.Group();
  group.name = 'FreeCommerce / independent traders';
  const colliders = [];
  const resources = [];
  const time = {value: 0};
  let lifeTime = 0;
  let disposed = false;
  const track = value => { resources.push(value); return value; };
  const standard = color => track(new THREE.MeshStandardMaterial({color, roughness: .76, metalness: .25}));
  const m = {
    dark: standard('#223236'), metal: standard('#768580'), clay: standard('#ac6f47'),
    green: standard('#697d70'), bone: standard('#c8bb98'),
    glow: track(new THREE.MeshBasicMaterial({vertexColors: true, toneMapped: false})),
  };
  m.glow.onBeforeCompile = shader => {
    shader.uniforms.uLife = time;
    shader.vertexShader = `uniform float uLife; attribute float aSway;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      transformed.x += sin(uLife * .7 + position.y * 1.5 + position.z) * aSway;
      transformed.z += cos(uLife * .55 + position.y + position.x) * aSway * .55;
    `);
  };
  m.glow.customProgramCacheKey = () => 'pfc-commerce-living-culture-v1';

  // All stalls, cloth, labels and illustrated warnings share one printed sheet.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const tiles = [
    ['NIGHT MARKET / TEA', 'BREWED FOR LONG ORBITS', 'FERMENTED LEAF · HOT SPICE · NO CLOCKS', '#874f40'],
    ['QUIET SPORE', 'LICENSED SPECIMEN BROKER', 'LIVING CULTURES / PLEASE DO NOT FEED', '#374f4c'],
    ['BORROWED PARTS', 'REPAIRS WHILE YOU WAIT', 'RECLAIMED COMPONENTS / TESTED ONCE', '#776647'],
    ['ORBITAL ORCHARD', 'SEED STOCK IN TRANSIT', 'GROW SOMETHING ELSE / CYCLE 327', '#4a645b'],
    ['HANDS / HEAT / HOME', 'INDEPENDENT FREE TRADE', 'A PLACE BETWEEN A MILLION PLACES', '#a8764f'],
    ['LIVE CULTURE', 'DO NOT UNSEAL', 'KEEP UPRIGHT / ATMOSPHERE SENSITIVE', '#9a7b4f'],
    ['PFC / COMMUNITY TRADE', 'MANIFEST 327.06', 'ORIGIN VERIFIED · DESTINATION OPTIONAL', '#3e5855'],
    ['SMALL COMFORTS', 'SALT TEA / 03    NIGHT BROTH / 05', 'OPEN UNTIL THE SHIP LEAVES', '#9b674b'],
  ];
  for (let index = 0; index < tiles.length; index++) {
    const [title, subtitle, caption, background] = tiles[index];
    ctx.save(); ctx.translate(index % 2 * 512, Math.floor(index / 2) * 256);
    ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#dfc293'; ctx.lineWidth = 2; ctx.strokeRect(12, 12, 488, 232);
    ctx.fillStyle = '#ead3a6'; ctx.font = '600 33px sans-serif'; ctx.fillText(title, 27, 68, 455);
    ctx.font = '600 20px sans-serif'; ctx.fillText(subtitle, 27, 112, 455);
    ctx.fillStyle = '#d3c2a1'; ctx.font = '13px sans-serif'; ctx.fillText(caption, 27, 151, 455);
    // A hand-stamped angular trade script and woven border, rather than neon UI.
    ctx.strokeStyle = '#d9b17b'; ctx.lineWidth = 3;
    for (let i = 0; i < 11; i++) {
      const x = 30 + i * 42;
      ctx.beginPath(); ctx.moveTo(x, 193); ctx.lineTo(x + 12, 177 + i % 3 * 5);
      ctx.lineTo(x + 24, 193); ctx.lineTo(x + 12, 214 - i % 2 * 9); ctx.stroke();
      if (i % 3) { ctx.beginPath(); ctx.moveTo(x, 207); ctx.lineTo(x + 24, 207); ctx.stroke(); }
    }
    for (let x = 22; x < 490; x += 10) {ctx.fillStyle = x % 3 ? '#e4c398' : '#384c49'; ctx.fillRect(x, 229, 5, 5);}
    ctx.restore();
  }
  const atlas = track(new THREE.CanvasTexture(canvas));
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  m.print = track(new THREE.MeshBasicMaterial({map: atlas, side: THREE.DoubleSide}));

  const batches = new Map();
  const object = new THREE.Object3D();
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  function add(geometry, material, x, y, z, rx = 0, ry = 0, rz = 0, tint = '#d7ba81', sway = 0) {
    if (geometry.index) {const original = geometry; geometry = geometry.toNonIndexed(); original.dispose();}
    object.position.set(x, y, z); object.rotation.set(rx, ry, rz); object.scale.set(1, 1, 1); object.updateMatrix();
    geometry.applyMatrix4(object.matrix);
    if (material === m.glow) {
      const count = geometry.attributes.position.count;
      const colors = new Float32Array(count * 3), sways = new Float32Array(count);
      color.set(tint);
      for (let i = 0; i < count; i++) { colors.set([color.r, color.g, color.b], i * 3); sways[i] = sway; }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('aSway', new THREE.BufferAttribute(sways, 1));
    }
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(geometry);
  }
  function box(material, x, y, z, w, h, d, ry = 0, rz = 0) {add(new THREE.BoxGeometry(w, h, d), material, x, y, z, 0, ry, rz);}
  function cylinder(material, x, y, z, top, bottom, height, segments = 8, rx = 0, ry = 0, rz = 0, tint, sway) {add(new THREE.CylinderGeometry(top, bottom, height, segments), material, x, y, z, rx, ry, rz, tint, sway);}
  function sphere(material, x, y, z, r, tint, sway = 0) {add(new THREE.IcosahedronGeometry(r, 0), material, x, y, z, 0, 0, 0, tint, sway);}
  function ring(material, x, y, z, radius, tube, rx = 0, ry = 0, rz = 0, tint) {add(new THREE.TorusGeometry(radius, tube, 4, 24), material, x, y, z, rx, ry, rz, tint);}
  function rod(material, a, b, radius = .035, tint, sway = 0) {
    start.set(...a); end.set(...b); direction.subVectors(end, start);
    object.position.copy(start).add(end).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(up, direction.clone().normalize()); object.scale.set(1, 1, 1); object.updateMatrix();
    const geometry = new THREE.CylinderGeometry(radius * .7, radius, direction.length(), 5);
    geometry.applyMatrix4(object.matrix);
    // Geometry is already transformed; add it through the identity transform.
    add(geometry, material, 0, 0, 0, 0, 0, 0, tint, sway);
  }
  function sign(tile, x, y, z, w, h, ry = 0, rx = 0, rz = 0) {
    const geometry = new THREE.PlaneGeometry(w, h);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (tile % 2 + .005 + uv.getX(i) * .99) / 2, 1 - (Math.floor(tile / 2) + .005 + (1 - uv.getY(i)) * .99) / 4);
    add(geometry, m.print, x, y, z, rx, ry, rz);
  }
  function solid(x, z, w, d) {colliders.push({minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2});}
  function lantern(x, y, z, size = 1, tile = 4, anchorY = y + 1) {
    rod(m.dark, [x, anchorY, z], [x, y + .65 * size, z], .018);
    cylinder(m.clay, x, y, z, .28 * size, .38 * size, .85 * size, 8);
    for (const yy of [-.45, .45]) cylinder(m.dark, x, y + yy * size, z, .3 * size, .3 * size, .07, 8);
    sign(tile, x, y, z + .39 * size, .57 * size, .57 * size);
    sphere(m.glow, x, y - .51 * size, z, .11 * size, '#deb279');
  }

  // A migratory tea cart, assembled from mismatched freight parts and woven cloth.
  const teaX = -17.5, teaZ = 42;
  solid(teaX, teaZ, 5, 4);
  box(m.dark, teaX, .33, teaZ, 4.8, .66, 3.9);
  box(m.clay, teaX, 1.1, teaZ, 4.7, .98, 3.5);
  box(m.bone, teaX, 1.66, teaZ, 4.9, .14, 3.65);
  for (const dx of [-2.2, 2.2]) for (const dz of [-1.7, 1.7]) {
    rod(m.metal, [teaX + dx, .6, teaZ + dz], [teaX + dx, 4.7, teaZ + dz], .055);
    cylinder(m.dark, teaX + dx, .35, teaZ + dz, .28, .28, .18, 8, Math.PI / 2);
  }
  box(m.clay, teaX, 4.65, teaZ, 5.1, .18, 4.1);
  for (let strip = 0; strip < 9; strip++) {
    sign(strip % 2 ? 4 : 0, teaX - 2.25 + strip * .56, 4.44, teaZ + 2.06, .5, .72, 0, 0, strip % 2 ? .04 : -.04);
  }
  sign(0, teaX, 3.58, teaZ + 1.9, 4.2, 1.45);
  sign(7, teaX, 1.16, teaZ + 1.77, 3.7, .95);
  for (let i = 0; i < 6; i++) {
    const x = teaX - 1.7 + i * .65;
    cylinder(i % 2 ? m.green : m.clay, x, 2.02, teaZ + .7, .17, .22, .58, 8);
    cylinder(m.bone, x, 2.36, teaZ + .7, .2, .19, .08, 8);
    ring(m.metal, x + .21, 2.09, teaZ + .7, .12, .025, Math.PI / 2);
  }
  // Actual imported cookware occupies these two countertop slots when ready.
  // Retain the procedural vessels if that asset could not be loaded.
  if (!importedPot) {
    cylinder(m.metal, teaX + 1.3, 2.38, teaZ - .7, .43, .56, 1.3, 10);
    cylinder(m.bone, teaX + 1.3, 3.09, teaZ - .7, .51, .46, .1, 10);
    rod(m.metal, [teaX + 1.3, 2.68, teaZ - .7], [teaX + 1.95, 2.48, teaZ - .7], .11);
    for (let i = 0; i < 5; i++) cylinder(m.clay, teaX - 1.35, 1.82 + i * .11, teaZ - .7, .36, .2, .15, 10);
  }
  for (const dx of [-2.35, 2.35]) lantern(teaX + dx, 3.3, teaZ + 2.03, .72, 4, 4.65);
  sign(0, teaX, 3.7, teaZ - 2.06, 4.2, 1.45, Math.PI);
  // A trail of high woven lanterns advertises the caravan before it comes into view.
  rod(m.dark, [-22, 6.7, 43], [-12, 6.7, 43], .025);
  for (let i = 0; i < 5; i++) lantern(-21 + i * 2, 5.7 + (i % 2) * .3, 43, .82, i % 2 ? 7 : 4, 6.7);

  // The specimen broker's freight cradle contains a branching luminous culture.
  const sporeX = 17.5, sporeZ = -76;
  solid(sporeX, sporeZ, 5, 4);
  box(m.dark, sporeX, .4, sporeZ, 4.9, .8, 3.9);
  box(m.clay, sporeX, .86, sporeZ, 4.7, .16, 3.7);
  cylinder(m.metal, sporeX, 1.05, sporeZ, 1.7, 1.8, .3, 12);
  ring(m.metal, sporeX, 4.9, sporeZ, 1.9, .075, Math.PI / 2);
  ring(m.glow, sporeX, 4.82, sporeZ, 1.77, .027, Math.PI / 2, 0, 0, '#b6c294');
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    rod(m.metal, [sporeX + Math.cos(a) * 1.85, 1.1, sporeZ + Math.sin(a) * 1.65], [sporeX + Math.cos(a) * 1.85, 4.9, sporeZ + Math.sin(a) * 1.65], .04);
  }
  // Keep the freight cradle even when its specimen is supplied by the GLB.
  if (!importedTree) {
    cylinder(m.green, sporeX, 2.3, sporeZ, .2, .55, 2.6, 8);
    for (let i = 0; i < 12; i++) {
      const angle = i * 2.4;
      const y = 1.7 + i * .21;
      const bx = sporeX + Math.cos(angle) * (1.0 + i % 3 * .13);
      const bz = sporeZ + Math.sin(angle) * (1.0 + i % 2 * .18);
      rod(m.green, [sporeX, y, sporeZ], [bx, y + .6, bz], .055);
      sphere(m.glow, bx, y + .65, bz, .17 + i % 3 * .045, i % 3 ? '#a4bb87' : '#dc9c68', .045);
      for (let leaf = 0; leaf < 3; leaf++) {
        const a = angle + leaf * Math.PI * 2 / 3;
        add(new THREE.ConeGeometry(.22, .75, 3), m.green, bx + Math.cos(a) * .18, y + .35, bz + Math.sin(a) * .18, .35, a, .8);
      }
    }
  }
  sign(1, sporeX, 5.65, sporeZ + 1.95, 4.7, 1.2);
  sign(5, sporeX, .45, sporeZ + 1.96, 3.2, .55);
  sign(1, sporeX, 5.65, sporeZ - 1.95, 4.7, 1.2, Math.PI);
  for (const dx of [-1.95, 1.95]) {
    cylinder(m.dark, sporeX + dx, 1.4, sporeZ + 1.4, .23, .3, .85, 8);
    sphere(m.glow, sporeX + dx, 1.86, sporeZ + 1.4, .12, '#ddb27a');
  }

  // An open repair bench displays a dismantled service unit and a dubious salvage piece.
  const repairX = -79, repairZ = 36.2;
  solid(repairX, repairZ, 7, 3);
  box(m.dark, repairX, .65, repairZ, 6.8, 1.3, 2.9);
  box(m.metal, repairX, 1.36, repairZ, 7.1, .14, 3.1);
  box(m.clay, repairX, .7, repairZ - 1.52, 6.5, 1.1, .15);
  sign(2, repairX, .75, repairZ - 1.61, 5.9, .8, Math.PI);
  for (let i = -2; i <= 2; i++) {
    box(m.metal, repairX + i * 1.2, .72, repairZ - 1.62, .05, .9, .06);
    box(m.bone, repairX + i * 1.2, 1.03, repairZ - 1.67, .5, .12, .035);
  }
  // Articulated mechanical anatomy makes the stall more than another cargo crate.
  box(m.bone, repairX - 1.4, 1.65, repairZ, 1.15, .5, 1.4, .18);
  sphere(m.metal, repairX - 1.9, 1.58, repairZ + 1.1, .31);
  ring(m.dark, repairX - 1.9, 1.6, repairZ + 1.34, .18, .055);
  for (const side of [-1, 1]) {
    sphere(m.dark, repairX - 1.4 + side * .75, 1.6, repairZ + .3, .17);
    rod(m.metal, [repairX - 1.4 + side * .75, 1.6, repairZ + .3], [repairX - 1.4 + side * 1.2, 1.54, repairZ - .45], .12);
    cylinder(m.dark, repairX - 1.4 + side * .75, 1.52, repairZ - 1.0, .18, .18, .35, 8, Math.PI / 2);
  }
  for (let i = 0; i < 8; i++) {
    box(i % 2 ? m.clay : m.green, repairX + .5 + i % 4 * .55, 1.53 + Math.floor(i / 4) * .17, repairZ - .7 + Math.floor(i / 4) * .6, .38, .16, .48, i * .3);
  }
  // Caged black-slate artifact with a warm core: origin politely unspecified.
  cylinder(m.dark, repairX + 2.1, 1.62, repairZ + .5, .62, .62, .35, 8);
  add(new THREE.OctahedronGeometry(.7, 0), m.metal, repairX + 2.1, 2.4, repairZ + .5, .25, .4, .35);
  sphere(m.glow, repairX + 2.1, 2.42, repairZ + 1.02, .16, '#dcb17f', .025);
  ring(m.clay, repairX + 2.1, 2.4, repairZ + .5, .9, .035, .1, .3, .2);
  for (const dx of [-3.3, 3.3]) rod(m.metal, [repairX + dx, 1.3, repairZ + 1.1], [repairX + dx, 4.15, repairZ + 1.1], .045);
  sign(2, repairX, 4.1, repairZ + 1.1, 6.9, 1.1, Math.PI);
  for (const dx of [-2.5, 2.5]) lantern(repairX + dx, 3.0, repairZ + 1, .55, 6, 4.15);

  // A suspended seed library in the gallery: an eccentric living orrery.
  const orchardX = 54, orchardZ = -12;
  solid(orchardX, orchardZ, 2, 2);
  cylinder(m.dark, orchardX, .5, orchardZ, .9, 1, 1, 10);
  cylinder(m.metal, orchardX, 2.2, orchardZ, .12, .2, 3.1, 8);
  ring(m.metal, orchardX, 4.25, orchardZ, 2.45, .045, .4, .1, .3);
  ring(m.clay, orchardX, 4.25, orchardZ, 1.8, .06, 1.0, .5, -.2);
  sphere(m.glow, orchardX, 4.25, orchardZ, .42, '#c1c695', .015);
  for (let i = 0; i < 9; i++) {
    const angle = i / 9 * Math.PI * 2;
    const x = orchardX + Math.cos(angle) * 2.2;
    const z = orchardZ + Math.sin(angle) * 2.2;
    const y = 4.1 + Math.sin(angle * 2) * .9;
    rod(m.metal, [orchardX, 4.25, orchardZ], [x, y, z], .018);
    sphere(m.clay, x, y, z, .23 + i % 3 * .08);
    for (let leaf = 0; leaf < 3; leaf++) {
      const a = angle + leaf * 2.1;
      add(new THREE.ConeGeometry(.17, .74, 3), m.glow, x + Math.cos(a) * .15, y + .4, z + Math.sin(a) * .15, .25, a, .8, i % 3 ? '#a3b58a' : '#c5a674', .035);
    }
  }
  rod(m.dark, [orchardX, 5.5, orchardZ], [orchardX, 16.8, orchardZ], .025);
  sign(3, orchardX, 1.18, orchardZ + 1.03, 2.8, .9);
  sign(3, orchardX, 1.18, orchardZ - 1.03, 2.8, .9, Math.PI);

  let triangles = 0;
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    triangles += geometry.attributes.position.count / 3;
    geometry.computeBoundingSphere();
    if (material === m.glow) geometry.boundingSphere.radius += .08;
    const mesh = new THREE.Mesh(track(geometry), material);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    geometries.forEach(geometry => geometry.dispose());
  }
  const vignettes = [
    {name: 'Night Market Tea', x: teaX, z: teaZ, text: 'The tea seller has stopped asking where anyone is going. They only ask how long they have been awake.'},
    {name: 'Quiet Spore', x: sporeX, z: sporeZ, text: 'Every culture has a transit permit. One of the permits lists the culture as its own custodian.'},
    {name: 'Borrowed Parts', x: repairX, z: repairZ, text: 'Repairs while you wait. The slate object on the counter is not on the price list, and the technician prefers it that way.'},
    {name: 'Orbital Orchard', x: orchardX, z: orchardZ, text: 'A traveling seed library takes the long way between habitable worlds. Someone has reserved an entire branch for home.'},
  ];
  const stats = Object.freeze({drawCalls: batches.size, triangles, textures: 1, vignettes: vignettes.length});
  group.userData.performance = stats;
  return {
    group, colliders, vignettes, stats,
    update(dt, _time, context) {
      if (disposed) return;
      if (!context?.reducedMotion) lifeTime += Math.min(.05, Math.max(0, dt));
      time.value = lifeTime;
    },
    dispose() {if (disposed) return; disposed = true; resources.forEach(resource => resource.dispose()); group.clear();},
  };
}
