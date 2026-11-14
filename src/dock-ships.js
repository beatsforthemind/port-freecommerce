import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SUN_DIRECTION, PELAGOS_DIRECTION } from './sky.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, 1);

/** Hull paints and lamps. Lamps are the same colour whatever the light. */
const PAINT = Object.freeze({
  hull: '#c9c5b5', shade: '#a9ada1', belly: '#59646a', graphite: '#252c2f', glass: '#0b151a',
  rust: '#b3593a', sage: '#7c9885', cream: '#d0c4a5', slate: '#566b7a', ochre: '#bb8c46', steel: '#7c8582',
  radiator: '#1c2326', rib: '#444d4f', soot: '#161a1b', fabric: '#353e42',
  stencil: '#e9e1cb', lamp: '#e6c58c', lampDim: '#a98f63', lampCool: '#b9d2cc', drive: '#8fd6cf', port: '#e2543f', starboard: '#57cb8b', beacon: '#f2b35d',
});

// ---------------------------------------------------------------------------
// Hull forms. A hull is skinned over cross-sections along its length (+z is
// the bow). Each section is a superellipse: `n` of 2 is an ellipse and larger
// values square it off; crown and keel have their own depths.

function hullSections(rows) {
  return rows.map(([z, w, top, keel = top, n = 2.4, y = 0]) => ({z, w, top, keel, n, y})).sort((a, b) => a.z - b.z);
}
function sectionAt(sections, z) {
  if (z <= sections[0].z) return sections[0];
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1], b = sections[i];
    if (z > b.z) continue;
    const f = (z - a.z) / (b.z - a.z), mix = key => a[key] + (b[key] - a[key]) * f;
    return {z, w: mix('w'), top: mix('top'), keel: mix('keel'), n: mix('n'), y: mix('y')};
  }
  return sections[sections.length - 1];
}
function ringPoint(section, angle, out = new THREE.Vector3()) {
  const c = Math.cos(angle), s = Math.sin(angle), e = 2 / section.n;
  return out.set(section.w * Math.sign(c) * Math.abs(c) ** e, section.y + (s >= 0 ? section.top : section.keel) * Math.sign(s) * Math.abs(s) ** e, section.z);
}
/** The angle at which a hull's side passes height `y`, on the +x (1) or -x (-1) side. */
function sideAngle(section, y, side) {
  const v = y - section.y, e = 2 / section.n;
  const s = v >= 0 ? Math.min(1, v / section.top) ** (1 / e) : -(Math.min(1, -v / section.keel) ** (1 / e));
  return side > 0 ? Math.asin(s) : Math.PI - Math.asin(s);
}
/** A point on the hull and the way out from it. */
function hullFrame(sections, z, angle, lift = 0) {
  const p = ringPoint(sectionAt(sections, z), angle);
  const along = ringPoint(sectionAt(sections, z + .05), angle).sub(ringPoint(sectionAt(sections, z - .05), angle));
  const around = ringPoint(sectionAt(sections, z), angle + .01).sub(ringPoint(sectionAt(sections, z), angle - .01));
  const normal = new THREE.Vector3().crossVectors(around, along).normalize();
  return {p: p.addScaledVector(normal, lift), normal};
}

/** Surface coordinates are metres, so plating keeps one physical size on every part. */
function grid(rows, cols, point, wrap = false) {
  const position = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2), index = [];
  const p = new THREE.Vector3(), surface = [0, 0];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    point(j, i, p, surface);
    p.toArray(position, (j * cols + i) * 3); uv.set(surface, (j * cols + i) * 2);
    if (j < rows - 1 && i < cols - 1) { const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1; index.push(a, b, c, b, d, c); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index); geometry.computeVertexNormals();
  if (wrap) {
    // The first and last columns are the same seam: share one normal across it.
    const normal = geometry.attributes.normal, a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let j = 0; j < rows; j++) {
      a.fromBufferAttribute(normal, j * cols).add(b.fromBufferAttribute(normal, j * cols + cols - 1)).normalize();
      normal.setXYZ(j * cols, a.x, a.y, a.z); normal.setXYZ(j * cols + cols - 1, a.x, a.y, a.z);
    }
  }
  return geometry;
}
function loft(sections, around = 28) {
  const girth = Math.max(...sections.map(s => Math.PI * (3 * (s.w + (s.top + s.keel) / 2) - Math.sqrt((3 * s.w + (s.top + s.keel) / 2) * (s.w + 3 * (s.top + s.keel) / 2)))));
  // Columns start at the keel, so the seam is underneath.
  return grid(sections.length, around + 1, (j, i, p, surface) => {
    ringPoint(sections[j], -Math.PI / 2 + i / around * TAU, p);
    surface[0] = i / around * girth; surface[1] = sections[j].z;
  }, true);
}
/** A flat closure over one cross-section: a transom, or the back of a cab. */
function cap(section, around = 24) {
  const position = [0, section.y + (section.top - section.keel) / 2, section.z], p = new THREE.Vector3(), index = [];
  for (let i = 0; i <= around; i++) position.push(...ringPoint(section, i / around * TAU, p).toArray());
  for (let i = 1; i <= around; i++) index.push(0, i, i + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(position.length / 3 * 2), 2));
  geometry.setIndex(index); geometry.computeVertexNormals();
  return geometry;
}
/**
 * A patch lying on a hull between two stations and two angles (which may vary along it).
 * Its rows fall on the hull's own sections as well: a patch that bridged a knuckle of the
 * hull would sink into it there.
 */
function patch(sections, z0, z1, angle0, angle1, lift = .03, steps = 10, across = 1) {
  const from = typeof angle0 === 'function' ? angle0 : () => angle0, to = typeof angle1 === 'function' ? angle1 : () => angle1;
  const step = Math.abs(z1 - z0) / steps, knuckles = sections.map(({z}) => z).filter(z => (z - z0) * (z - z1) < 0);
  // A row within half a step of a section gives way to it: a sliver of a row beside the
  // knuckle would turn the patch's shading there abruptly.
  const rows = Array.from({length: steps + 1}, (_, j) => z0 + (z1 - z0) * j / steps)
    .filter((row, j) => j === 0 || j === steps || knuckles.every(z => Math.abs(row - z) >= step / 2))
    .concat(knuckles).sort((a, b) => (a - b) * (z1 - z0));
  return grid(rows.length, across + 1, (j, i, p, surface) => {
    const z = rows[j], a = from(z) + (to(z) - from(z)) * i / across;
    p.copy(hullFrame(sections, z, a, lift).p);
    surface[0] = i / across; surface[1] = (z - z0) / (z1 - z0);
  });
}
/** A band at fixed heights along one side of a hull. */
function band(sections, z0, z1, low, high, side, lift = .04, steps = 12) {
  // On the +x side angle grows upwards; on the -x side it grows downwards.
  const bottom = z => sideAngle(sectionAt(sections, z), side > 0 ? low : high, side), top = z => sideAngle(sectionAt(sections, z), side > 0 ? high : low, side);
  // Three strips across: one flat strip would cut inside the curve of the side.
  return patch(sections, z0, z1, bottom, top, lift, steps, 3);
}
function slab(w, h, d) {
  const geometry = new THREE.BoxGeometry(w, h, d), uv = geometry.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * faces[i >> 2][0], uv.getY(i) * faces[i >> 2][1]);
  return geometry;
}
/** A body of revolution about z, from [radius, z] pairs. */
function lathe(profile, radial = 18) {
  let length = 0, widest = 0;
  profile.forEach(([r, z], i) => { widest = Math.max(widest, r); if (i) length += Math.hypot(r - profile[i - 1][0], z - profile[i - 1][1]); });
  const geometry = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), radial), uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * TAU * widest, uv.getY(i) * length);
  return geometry.rotateX(Math.PI / 2);
}
function disc(radius, radial = 18) { return new THREE.CircleGeometry(radius, radial); }
/** A flat plate cut to an outline of [x, z] points, `thickness` deep in y. */
function plate(outline, thickness) {
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 1}).rotateX(Math.PI / 2).translate(0, thickness / 2, 0);
}
/** A square member from a to b. */
function strut(a, b, width, depth = width) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), run = to.clone().sub(from);
  return slab(width, run.length(), depth)
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, run.clone().normalize()))
    .translate(...from.add(to).multiplyScalar(.5).toArray());
}
/** A flat panel facing `normal`, upright against `up`, reading left to right from outside. */
function panel(centre, normal, width, height, up = UP) {
  const n = normal.clone().normalize(), v = up.clone().addScaledVector(n, -up.dot(n)).normalize(), u = new THREE.Vector3().crossVectors(v, n);
  const corners = [[-.5, -.5, 0, 1], [.5, -.5, 1, 1], [.5, .5, 1, 0], [-.5, .5, 0, 0]];
  const position = [], uv = [];
  for (const [x, y, s, t] of corners) {
    position.push(...centre.clone().addScaledVector(u, x * width).addScaledVector(v, y * height).toArray());
    uv.push(s, t);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([...n.toArray(), ...n.toArray(), ...n.toArray(), ...n.toArray()], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

// ---------------------------------------------------------------------------
// Stencilled names and codes share one small coverage sheet, like the signs.

function createMarkings(entries) {
  const size = 512, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const marks = {};
  let x = 4, y = 4, shelf = 0;
  for (const [key, text, height] of entries) {
    ctx.font = `600 ${height * .82}px "Space Grotesk", sans-serif`;
    const width = Math.min(size - 8, Math.ceil(ctx.measureText(text).width) + 6);
    if (x + width + 4 > size) { x = 4; y += shelf + 4; shelf = 0; }
    ctx.fillText(text, x + 3, y + height / 2 + 1, width - 6);
    marks[key] = {u0: x / size, u1: (x + width) / size, v0: y / size, v1: (y + height) / size, aspect: width / height};
    x += width + 4; shelf = Math.max(shelf, height);
  }
  const pixels = ctx.getImageData(0, 0, size, size).data, coverage = new Uint8Array(size * size);
  for (let i = 0, j = 0; i < coverage.length; i++, j += 4) coverage[i] = pixels[j];
  canvas.width = canvas.height = 0;
  const texture = new THREE.DataTexture(coverage, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  texture.name = 'Docked craft / stencilled markings';
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
  return {texture, marks};
}

// ---------------------------------------------------------------------------
// Craft outside the hull are lit by what is out there: the star, Pelagos, and
// the light spilling from the departure hall's glazing. No fog reaches them.

function hullMaterial(markings) {
  return new THREE.ShaderMaterial({
    name: 'Docked craft / painted hull', side: THREE.DoubleSide, fog: false, alphaToCoverage: true,
    uniforms: {
      uSun: {value: SUN_DIRECTION}, uPlanet: {value: PELAGOS_DIRECTION},
      uHall: {value: new THREE.Vector3(0, 6, -158)}, uMarks: {value: markings},
    },
    vertexShader: `
      attribute vec3 paint; attribute float glow; attribute vec2 mark;
      varying vec3 vPaint; varying float vGlow; varying vec2 vPlate; varying vec2 vMark; varying vec3 vNormal; varying vec3 vWorld;
      void main() {
        vPaint = paint; vGlow = glow; vPlate = uv; vMark = mark;
        vec4 world = modelMatrix * vec4(position, 1.);
        vWorld = world.xyz;
        vNormal = mat3(modelMatrix) * normal;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform vec3 uSun; uniform vec3 uPlanet; uniform vec3 uHall; uniform sampler2D uMarks;
      varying vec3 vPaint; varying float vGlow; varying vec2 vPlate; varying vec2 vMark; varying vec3 vNormal; varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        // Stencils are cut from their quad: only the lettering is drawn.
        float marked = step(0., vMark.x);
        float ink = mix(1., texture2D(uMarks, max(vMark, 0.)).r, marked);
        if (ink < .35) discard;

        // Plating: staggered courses, each plate a slightly different shade,
        // with seams that fade out before they could shimmer.
        vec2 g = vPlate;
        g.y += .5 * mod(floor(g.x), 2.);
        vec2 edge = min(fract(g), 1. - fract(g));
        vec2 width = fwidth(g) + 1e-5;
        vec2 seams = (1. - smoothstep(vec2(.004), vec2(.004) + width * 1.5, edge)) * (1. - smoothstep(.12, .45, width));
        float seam = max(seams.x, seams.y);
        vec3 albedo = vPaint * (.92 + .16 * hash(floor(g))) * (1. - .5 * seam);

        vec3 n = normalize(vNormal);
        if (!gl_FrontFacing) n = -n;
        float sun = max(dot(n, uSun), 0.);
        float day = pow(sun, .8);
        vec3 toHall = uHall - vWorld;
        float reach = dot(toHall, toHall);
        float spill = max(dot(n, toHall * inversesqrt(reach)), 0.) * 520. / (520. + reach);
        vec3 light = vec3(1.08, 1.03, .94) * day * .82
          + vec3(.19, .24, .21) * (.3 + .7 * max(dot(n, uPlanet), 0.))
          + vec3(1., .76, .5) * spill * .6
          + vec3(.03, .04, .05);
        vec3 eye = normalize(cameraPosition - vWorld);
        float gloss = pow(max(dot(n, normalize(eye + uSun)), 0.), 70.) * step(.001, sun) * .2;
        vec3 c = mix(albedo * light + vec3(gloss), vPaint, vGlow);
        gl_FragColor = vec4(c, ink);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------------------------------------------------------------------
// One craft is one mesh: every part is fitted for the same batch and merged.

function createYard(marks) {
  const pieces = [], lamps = [];
  const color = new THREE.Color(), matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler();
  const position = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const yard = {
    /**
     * Take a part. `paint` is a colour, or a function of the part's own
     * coordinates for liveries. `plating` is the plate size in metres along
     * the part's two surface directions; without it the part is one piece.
     */
    add(geometry, paint, {at = null, turn = null, plating = null, glow = 0, mark = null} = {}) {
      for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
      const count = geometry.attributes.position.count, source = geometry.attributes.position;
      if (!geometry.index) geometry.setIndex([...Array(count).keys()]);
      const uv = geometry.attributes.uv, plates = new Float32Array(count * 2), marking = new Float32Array(count * 2).fill(-1);
      const paints = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        if (mark) { marking[i * 2] = mark.u0 + (mark.u1 - mark.u0) * uv.getX(i); marking[i * 2 + 1] = mark.v0 + (mark.v1 - mark.v0) * uv.getY(i); }
        // A quarter-plate offset keeps seams off the part's own edges.
        if (plating && uv) { plates[i * 2] = uv.getX(i) / plating[0] + .25; plates[i * 2 + 1] = uv.getY(i) / plating[1] + .25; }
        else plates[i * 2] = plates[i * 2 + 1] = .5;
        color.set(typeof paint === 'function' ? paint(source.getX(i), source.getY(i), source.getZ(i)) : paint);
        color.toArray(paints, i * 3);
      }
      geometry.setAttribute('uv', new THREE.BufferAttribute(plates, 2));
      geometry.setAttribute('paint', new THREE.BufferAttribute(paints, 3));
      geometry.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(count).fill(glow), 1));
      geometry.setAttribute('mark', new THREE.BufferAttribute(marking, 2));
      if (at || turn) {
        quaternion.setFromEuler(euler.set(...(turn || [0, 0, 0])));
        geometry.applyMatrix4(matrix.compose(position.set(...(at || [0, 0, 0])), quaternion, one));
      }
      pieces.push(geometry);
      return geometry;
    },
    /** The same part on both sides: `make(side)` builds it for +x (1) and -x (-1). */
    pair(make) { for (const side of [1, -1]) make(side); },
    /** A lit window on a hull, with a fair chance that nobody is home. */
    window(sections, z, y, side, width, height, index) {
      const {p, normal} = hullFrame(sections, z, sideAngle(sectionAt(sections, z), y, side), .1);
      const lit = (index * 7 + (side > 0 ? 3 : 0)) % 9;
      yard.add(panel(p, normal, width, height), lit < 2 ? PAINT.glass : lit === 5 ? PAINT.lampCool : lit === 7 ? PAINT.lampDim : PAINT.lamp, {glow: lit < 2 ? 0 : 1});
    },
    /** Stencilled lettering of a given cap height, centred on a point of a hull side or any flat face. */
    stencil(key, centre, normal, height, paint, up = UP) {
      const entry = marks[key];
      yard.add(panel(centre.clone().addScaledVector(normal.clone().normalize(), .07), normal, height * entry.aspect, height, up), paint, {mark: entry});
    },
    /** A lamp: a small lit body, and a halo once the craft is placed. */
    lamp(at, radius, paint, reach = .7, strength = .55) {
      yard.add(new THREE.SphereGeometry(radius, 8, 6), paint, {at, glow: 1});
      lamps.push({at, paint, reach, strength});
    },
    lamps,
    /** Merge everything into one mesh, placed in the world. */
    launch(name, material, at, heading, glow) {
      const geometry = mergeGeometries(pieces);
      pieces.forEach(piece => piece.dispose());
      geometry.computeBoundingSphere(); geometry.computeBoundingBox();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name; mesh.position.set(...at); mesh.rotation.y = heading;
      mesh.updateMatrixWorld(true); mesh.matrixAutoUpdate = false;
      for (const lamp of lamps) glow?.point(position.set(...lamp.at).applyMatrix4(mesh.matrixWorld).toArray(), lamp.reach, lamp.paint, lamp.strength);
      return mesh;
    },
  };
  return yard;
}

/** An engine: cowl, bell, and the idle light of a drive that is not quite off. */
function engine(yard, x, y, zFront, zBack, radius, cowl = PAINT.shade) {
  const length = zFront - zBack;
  yard.add(lathe([[radius * .72, zBack], [radius * .94, zBack + length * .12], [radius, zBack + length * .3], [radius, zFront - length * .16], [radius * .86, zFront - length * .05], [radius * .55, zFront]]), cowl, {at: [x, y, 0], plating: [radius * 1.1, length * .25]});
  yard.add(lathe([[radius * .6, zBack + length * .02], [radius * .84, zBack - radius * .75], [radius * 1.04, zBack - radius * 1.5]], 18), PAINT.soot, {at: [x, y, 0]});
  yard.add(disc(radius * .6, 16), PAINT.drive, {at: [x, y, zBack + length * .02], glow: .55});
  yard.add(disc(radius * .55, 14), PAINT.soot, {at: [x, y, zFront]});
  yard.lamps.push({at: [x, y, zBack - radius * .6], paint: PAINT.drive, reach: radius * 1.5, strength: .3});
}
/** Four small thrusters on a block, for turning and holding station. */
function thrusterQuad(yard, at, out) {
  const n = new THREE.Vector3(...out).normalize(), base = new THREE.Vector3(...at);
  const turn = new THREE.Quaternion().setFromUnitVectors(UP, n);
  yard.add(slab(.55, .32, .55).applyQuaternion(turn), PAINT.rib, {at: base.clone().addScaledVector(n, .1).toArray()});
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const axis = new THREE.Vector3(dx, .7, dz).normalize().applyQuaternion(turn);
    const cone = new THREE.ConeGeometry(.13, .34, 8, 1, true).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, axis.clone().negate()));
    yard.add(cone, PAINT.soot, {at: base.clone().addScaledVector(n, .26).addScaledVector(axis, .2).toArray()});
  }
}
/** A docking collar where a transfer tunnel meets the hull. The sleeve reaches back to a curving hull. */
function collar(yard, sections, z, y, side, radius) {
  const {p, normal} = hullFrame(sections, z, sideAngle(sectionAt(sections, z), y, side), 0);
  const turn = new THREE.Quaternion().setFromUnitVectors(FORWARD, normal);
  yard.add(new THREE.TorusGeometry(radius, .2, 8, 20).applyQuaternion(turn), PAINT.steel, {at: p.clone().addScaledVector(normal, .32).toArray()});
  yard.add(lathe([[radius * .98, -1.6], [radius * .98, .36]], 20).applyQuaternion(turn), PAINT.rib, {at: p.toArray()});
  return p.addScaledVector(normal, .36);
}
/** Dark glazing over the crown of a hull, divided into panes by slim frames. */
function glazing(yard, sections, z0, z1, from, to, panes) {
  // Three facets to a pane: one flat facet each would dip under the hull's shoulders.
  yard.add(patch(sections, z0, z1, from, to, .04, 5, panes * 3), PAINT.glass);
  for (let i = 0; i <= panes; i++) {
    const angle = from + (to - from) * i / panes;
    yard.add(patch(sections, z0, z1, angle - .011, angle + .011, .09, 5), PAINT.steel);
  }
  for (const z of [z0, z1]) yard.add(patch(sections, z - .07, z + .07, from - .011, to + .011, .09, 1, panes * 3), PAINT.steel);
}

// ---------------------------------------------------------------------------

/** Long-haul liner: two passenger decks, a glazed bridge, twin drives and radiators. */
function buildLiner(yard) {
  const S = hullSections([
    [-36, 2.5, 2.3, 2.1, 2.6], [-33, 3.5, 3.1, 2.8, 2.7], [-28, 4.3, 3.8, 3.3, 2.8], [-23, 4.6, 4.0, 3.5, 2.8],
    [-16, 5.4, 4.7, 3.9, 2.9], [-9, 5.6, 4.9, 4.0, 3.0], [16, 5.6, 4.9, 4.0, 3.0], [23, 5.3, 4.6, 3.8, 2.8],
    [28.5, 4.5, 3.8, 3.2, 2.6], [32, 3.4, 2.8, 2.4, 2.4], [34.6, 1.9, 1.6, 1.4, 2.2], [35.7, .8, .7, .6, 2.1], [36, .1, .09, .09, 2],
  ]);
  // Pale above, dark below, a graphite radome, and a duller engineering section.
  yard.add(loft(S, 32), (x, y, z) => z > 34 ? PAINT.graphite : y < -2.3 ? PAINT.belly : z < -19 ? PAINT.shade : PAINT.hull, {plating: [1.45, 2.6]});
  yard.add(cap(S[0]), PAINT.rib);

  yard.pair(side => {
    // Two decks of cabins behind dark glazing bands, and a line of livery below them.
    for (const [deck, y] of [[0, 1.75], [1, -.55]]) {
      yard.add(band(S, -14, 22.4, y - .5, y + .5, side, .04, 16), PAINT.glass);
      for (let i = 0; i < 23; i++) yard.window(S, -13 + i * 1.56, y, side, .92, .5, i + deck * 5);
    }
    yard.add(band(S, -18, 31, -1.75, -1.4, side, .045, 22), PAINT.rust);
    // Drive pods on swept pylons, well clear of the cabins.
    yard.add(plate([[4, -20.5], [7.4, -24], [7.4, -31], [4, -30]].map(([x, z]) => [x * side, z]), .8), PAINT.shade, {at: [0, .4, 0], plating: [1.6, 2.4]});
    engine(yard, side * 8.9, .4, -19.5, -35, 2.1);
    // Radiators stand in a V over the engineering section, edge-on to the star's heat.
    yard.add(slab(.14, 6, 11.5), PAINT.radiator, {at: [side * 4.5, 6.6, -16.5], turn: [0, 0, -side * .62], plating: [.55, 60]});
    for (const z of [-10.75, -16.5, -22.25]) yard.add(slab(.24, 6.1, .24), PAINT.rib, {at: [side * 4.5, 6.6, z], turn: [0, 0, -side * .62]});
    yard.add(slab(.26, .26, 11.7), PAINT.rib, {at: [side * 6.27, 9.08, -16.5]});
    for (const z of [26, -26]) thrusterQuad(yard, hullFrame(S, z, sideAngle(sectionAt(S, z), 1.6, side)).p.toArray(), [side, .45, 0]);
    yard.stencil('liner', hullFrame(S, 12, sideAngle(sectionAt(S, 12), .6, side)).p, new THREE.Vector3(side, 0, 0), .62, PAINT.belly);
  });
  // The bridge looks forward and up through a brow of dark glass.
  glazing(yard, S, 27.4, 30.8, Math.PI * .17, Math.PI * .83, 11);
  // Spine fairing, communications mast and dish.
  yard.add(slab(1.5, .55, 36), PAINT.shade, {at: [0, 4.85, 1], plating: [2.4, 2.6]});
  yard.add(strut([0, 4.6, 19.5], [0, 9.6, 19.5], .16), PAINT.rib);
  yard.add(lathe([[.05, 0], [.7, .12], [1.15, .42], [1.3, .7]], 14).rotateX(-1.15), PAINT.hull, {at: [0, 8.2, 19.9]});
  yard.add(new THREE.SphereGeometry(.7, 12, 8, 0, TAU, 0, Math.PI / 2), PAINT.hull, {at: [0, 5.1, 8]});
  // Three small sustainer bells between the pods.
  for (const [x, y] of [[0, 1.1], [-1.05, -.6], [1.05, -.6]]) {
    yard.add(lathe([[.5, -36], [.72, -37], [.85, -37.9]], 12), PAINT.soot, {at: [x, y, 0]});
    yard.add(disc(.5, 10), PAINT.drive, {at: [x, y, -36.02], glow: .4});
  }
  yard.lamp([5.75, .2, 8], .16, PAINT.starboard, .62, .52);
  yard.lamp([-5.75, .2, 8], .16, PAINT.port, .62, .52);
  yard.lamp([0, 9.75, 19.5], .14, PAINT.beacon, .74, .6);
  yard.lamp([0, -3.95, 20], .14, PAINT.lampCool, .62, .38);
  return {port: collar(yard, S, 6, -1.9, -1, 1.5), bore: 1.3};
}

/** Local shuttle: a lifting body with a canopy, stub wings and two small drives. */
function buildShuttle(yard) {
  const S = hullSections([
    [-12.5, 2.9, 1.9, 1.35, 3], [-10.5, 3.4, 2.2, 1.5, 3.2], [-5, 3.6, 2.3, 1.5, 3.2], [4.5, 3.4, 2.15, 1.45, 3],
    [8.2, 2.7, 1.7, 1.2, 2.6], [10.8, 1.7, 1.1, .85, 2.3], [12.1, .8, .55, .45, 2.1], [12.5, .08, .07, .07, 2],
  ]);
  yard.add(loft(S, 26), (x, y, z) => z > 11.6 ? PAINT.graphite : y < -.35 ? PAINT.cream : PAINT.sage, {plating: [1.1, 1.9]});
  // The transom carries the boarding ramp, closed for the crossing.
  yard.add(cap(S[0]), PAINT.rib);
  yard.add(slab(3.3, 1.9, .1), PAINT.cream, {at: [0, .15, -12.56], plating: [1.1, .95]});
  for (const x of [-1.9, 1.9]) yard.add(slab(.12, 2.1, .16), PAINT.rib, {at: [x, .15, -12.6]});
  glazing(yard, S, 7.1, 10.1, Math.PI * .16, Math.PI * .84, 7);
  yard.pair(side => {
    yard.add(band(S, -7.4, 4.9, .4, 1.1, side, .04, 8), PAINT.glass);
    for (let i = 0; i < 8; i++) yard.window(S, -6.6 + i * 1.5, .75, side, .8, .4, i + 2);
    yard.add(band(S, -11, 9.5, -.5, -.3, side, .045, 12), PAINT.cream);
    // Low stub wings with tip pods carry the manoeuvring thrusters.
    yard.add(plate([[2.9, 2.5], [7.3, -6.4], [7.3, -10.6], [2.9, -10.6]].map(([x, z]) => [x * side, z]), .32), PAINT.sage, {at: [0, -1, 0], plating: [1.4, 1.9]});
    yard.add(lathe([[.3, -11.4], [.5, -10.6], [.5, -6.2], [.05, -4.9]], 12), PAINT.cream, {at: [side * 7.3, -1, 0]});
    thrusterQuad(yard, [side * 7.3, -.5, -8.5], [0, 1, 0]);
    engine(yard, side * 2.25, 2.15, -6, -13.4, .95, PAINT.cream);
    yard.add(slab(.34, .3, 13), PAINT.rib, {at: [side * 1.6, -1.6, -1]});
    yard.stencil('shuttle', hullFrame(S, -1.5, sideAngle(sectionAt(S, -1.5), -.02, side)).p, new THREE.Vector3(side, 0, 0), .34, PAINT.belly);
    yard.stencil('06', new THREE.Vector3(side * .12, 3.75, -10.6), new THREE.Vector3(side, 0, 0), .95, PAINT.cream);
    yard.lamp([side * 1.2, -.55, -12.66], .09, PAINT.port, .43, .38);
  });
  // Tail fin, roof hatch and antenna.
  yard.add(plate([[2.2, -12.2], [2.2, -7.6], [4.9, -10.6], [4.9, -12.5]], .22).rotateZ(Math.PI / 2), PAINT.sage, {plating: [1.4, 1.9]});
  yard.add(lathe([[.75, 0], [.75, .22], [.6, .3]], 14).rotateX(-Math.PI / 2), PAINT.rib, {at: [0, 2.2, 1]});
  yard.add(strut([0, 2.1, 5.5], [0, 3.5, 5.2], .08), PAINT.rib);
  yard.lamp([7.3, -1, -4.8], .12, PAINT.starboard, .56, .52);
  yard.lamp([-7.3, -1, -4.8], .12, PAINT.port, .56, .52);
  yard.lamp([0, 5, -11.6], .11, PAINT.beacon, .62, .6);
  // The collar sits aft of the cabin windows and clear above the wing.
  return {port: collar(yard, S, -9.2, .55, -1, 1.1), bore: .95};
}

/**
 * Freight tender: a pusher. Cargo modules are clamped two abreast along an
 * open spine; the crew cab rides behind and above them, looking forward over
 * the load, with the drive block at its back.
 */
function buildTender(yard) {
  // The spine is a box truss: four longerons, frames between bays, and bracing.
  const frames = [16.75, 11.25, 5.75, .25, -5.25];
  yard.pair(side => { for (const y of [-1.1, 1.1]) yard.add(slab(.22, .22, 22.6), PAINT.steel, {at: [side * 1.1, y, 5.7]}); });
  for (const z of frames) {
    yard.pair(side => yard.add(slab(.18, 2.4, .18), PAINT.steel, {at: [side * 1.1, 0, z]}));
    for (const y of [-1.1, 1.1]) yard.add(slab(2.4, .18, .18), PAINT.steel, {at: [0, y, z]});
  }
  frames.slice(1).forEach((z, i) => {
    const front = frames[i], flip = i % 2 ? 1 : -1;
    for (const y of [-1.1, 1.1]) yard.add(strut([-1.1 * flip, y, front], [1.1 * flip, y, z], .12), PAINT.rib);
    yard.pair(side => yard.add(strut([side * 1.1, -1.1 * flip, front], [side * 1.1, 1.1 * flip, z], .12), PAINT.rib));
  });
  // An open buffer frame and a docking probe lead the load.
  for (const [a, b] of [[[-1.4, -1.4], [1.4, -1.4]], [[1.4, -1.4], [1.4, 1.4]], [[1.4, 1.4], [-1.4, 1.4]], [[-1.4, 1.4], [-1.4, -1.4]], [[-1.4, -1.4], [1.4, 1.4]], [[1.4, -1.4], [-1.4, 1.4]]]) {
    yard.add(strut([a[0], a[1], 17.2], [b[0], b[1], 17.2], .24), PAINT.steel);
  }
  yard.add(lathe([[.62, 16.9], [.62, 17.45], [.4, 17.6], [.3, 18.2], [.1, 18.5]], 12), PAINT.rib);
  for (const [x, y] of [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]]) yard.add(slab(.5, .5, .34), PAINT.ochre, {at: [x, y, 17.36]});
  // Cargo modules. One bay on the station side stands empty: the transfer is still under way.
  const liveries = [PAINT.rust, PAINT.slate, PAINT.cream, PAINT.sage, PAINT.ochre, PAINT.rust, PAINT.slate, PAINT.sage];
  const codes = ['cargo-a', 'cargo-b', 'cargo-c', 'cargo-d'];
  [14, 8.5, 3, -2.5].forEach((z, bay) => yard.pair(side => {
    for (const dz of [-1.7, 1.7]) yard.add(slab(.42, .5, .5), PAINT.rib, {at: [side * 1.36, 0, z + dz]});
    if (side > 0 && bay === 1) return;
    const index = bay * 2 + (side > 0 ? 0 : 1), x = side * 3.07;
    yard.add(slab(2.9, 3.2, 5), liveries[index], {at: [x, 0, z], plating: [.34, 40]});
    for (const dx of [-1.45, 1.45]) for (const dz of [-2.5, 2.5]) yard.add(slab(.16, 3.3, .16), PAINT.rib, {at: [x + dx, 0, z + dz]});
    for (const y of [-1.6, 1.6]) yard.add(slab(3, .12, 5.1), PAINT.rib, {at: [x, y, z]});
    const pale = liveries[index] === PAINT.cream || liveries[index] === PAINT.ochre;
    yard.stencil(codes[index % 4], new THREE.Vector3(x + side * 1.46, .95, z - side * .5), new THREE.Vector3(side, 0, 0), .42, pale ? PAINT.graphite : PAINT.stencil);
  }));
  // An overhead rail carries the handling trolley above the open bay.
  yard.add(slab(.26, .26, 22.2), PAINT.rib, {at: [0, 2.35, 5.7]});
  for (const z of frames) yard.add(slab(.14, 1.2, .14), PAINT.rib, {at: [0, 1.75, z]});
  yard.add(slab(1.3, .5, 1.5), PAINT.ochre, {at: [0, 2.7, 8.5]});
  yard.add(strut([0, 2.75, 8.5], [3.6, 2.95, 8.5], .2), PAINT.ochre);
  yard.add(strut([3.3, 2.9, 8.5], [3.3, 1.9, 8.5], .05), PAINT.rib);
  yard.add(slab(1.5, .16, .9), PAINT.rib, {at: [3.3, 1.85, 8.5]});
  // Crew cab: a squared pressure module, raised so its glazing clears the load.
  const C = hullSections([[-12, 1.9, 1.7, 1.6, 4, 1], [-11.3, 2.3, 1.9, 1.7, 4.6, 1], [-7.9, 2.3, 1.9, 1.7, 4.6, 1], [-6.5, 1.9, 1.5, 1.5, 3.4, 1], [-5.75, 1.1, .8, 1, 2.6, 1], [-5.6, .08, .06, .08, 2, 1]]);
  yard.add(loft(C, 24), (x, y) => y < .5 ? PAINT.slate : PAINT.cream, {plating: [1.1, 1.7]});
  glazing(yard, C, -7.6, -6.1, Math.PI * .14, Math.PI * .86, 7);
  yard.add(strut([0, 2.9, -9.4], [0, 4.6, -9.8], .08), PAINT.rib);
  yard.pair(side => {
    for (const [i, z] of [[2, -10.4], [4, -8.9]]) yard.window(C, z, 2.2, side, .8, .42, i);
    yard.stencil('tender', hullFrame(C, -9.6, sideAngle(sectionAt(C, -9.6), 2.66, side)).p, new THREE.Vector3(side, 0, 0), .25, PAINT.belly);
    // Drive block: tanks beside it, four bells behind.
    yard.add(new THREE.SphereGeometry(1.3, 24, 16), PAINT.cream, {at: [side * 2.55, .2, -12.7]});
    for (const y of [-.58, .98]) engine(yard, side * .85, y, -14.9, -16.9, .62, PAINT.rib);
    yard.stencil('08', new THREE.Vector3(side * 1.71, 0, -14.9), new THREE.Vector3(side, 0, 0), .9, PAINT.cream);
    yard.add(slab(.1, 2.6, 3.4), PAINT.radiator, {at: [side * 2.45, 3.1, -14], turn: [0, 0, -side * .5], plating: [.5, 60]});
  });
  yard.add(slab(3.4, 3.1, 3.6), PAINT.belly, {at: [0, .2, -13.9], plating: [1.2, 1.55]});
  yard.lamp([1.5, 1.5, 17.25], .12, PAINT.port, .56, .52);
  yard.lamp([-1.5, 1.5, 17.25], .12, PAINT.starboard, .56, .52);
  yard.lamp([0, 4.7, -9.8], .11, PAINT.beacon, .62, .6);
  yard.lamp([0, 2.3, 8.5], .1, PAINT.lamp, .87, .38);
  return {port: collar(yard, C, -9, .55, 1, 1.15), bore: 1};
}

/**
 * A soft transfer tunnel from a station lock to a craft's collar: it leaves
 * the lock squarely, turns once at a gimbal ring, and is ribbed along its
 * length. Points are in the world; the tunnel joins the craft's own mesh.
 */
function tunnel(yard, frame, lock, out, port, bore) {
  const toLocal = frame.matrixWorld.clone().invert();
  const start = new THREE.Vector3(...lock), elbow = start.clone().add(new THREE.Vector3(out[0], 0, out[1]).multiplyScalar(bore + 1.4));
  const add = (geometry, paint) => yard.add(geometry.applyMatrix4(toLocal), paint);
  const sleeve = (from, to, size) => loft(hullSections([[from, size, size, size, 4], [to, size, size, size, 4]]), 16);
  for (const [a, b] of [[start, elbow], [elbow, port]]) {
    const run = b.clone().sub(a), length = run.length(), turn = new THREE.Quaternion().setFromUnitVectors(FORWARD, run.clone().normalize());
    const place = geometry => geometry.applyQuaternion(turn).translate(a.x, a.y, a.z);
    add(place(sleeve(0, length, bore)), PAINT.fabric);
    for (let d = .8; d < length - .3; d += 1.2) add(place(sleeve(d - .1, d + .1, bore + .11)), PAINT.steel);
  }
  add(new THREE.SphereGeometry(bore * 1.22, 14, 10).translate(elbow.x, elbow.y, elbow.z), PAINT.rib);
}

/**
 * The three craft moored at the departure head, each one mesh, sharing one
 * material and one small sheet of stencils.
 */
export function createDockShips({glow = null} = {}) {
  const markings = createMarkings([
    ['liner', 'PFC 07   LONG WAY ROUND', 44], ['shuttle', 'PFC 06   SIX MINUTES', 36], ['tender', 'PFC 08   SEALED + COUNTED', 34],
    ['06', '06', 72], ['08', '08', 72],
    ['cargo-a', 'KSU 418 207', 34], ['cargo-b', 'PFC 048 771', 34], ['cargo-c', 'DRY GOODS / SEALED', 34], ['cargo-d', 'ORE GRADE 2', 34],
  ]);
  const material = hullMaterial(markings.texture);
  const meshes = [];
  let triangles = 0;
  // Each craft: where it lies, which way its bow points, and the lock it serves.
  // The shuttle and the tender lie along their piers' glazing, and the liner
  // runs north from the hall, so each is seen broadside from its own gate.
  for (const [name, build, at, heading, lock, out] of [
    ['Docked craft / long-haul liner', buildLiner, [20.5, 6.6, -224], 0, [0, 3.1, -200.95], [0, -1]],
    ['Docked craft / local shuttle', buildShuttle, [-35, 5, -177], Math.PI / 2, [-38.15, 3.1, -159], [-1, 0]],
    ['Docked craft / freight tender', buildTender, [30.5, 4.8, -177.2], -Math.PI / 2, [38.15, 3.1, -159], [1, 0]],
  ]) {
    const yard = createYard(markings.marks);
    const {port, bore} = build(yard);
    // The tunnel is fitted in the world, so the craft is placed before it is merged.
    const frame = new THREE.Object3D();
    frame.position.set(...at); frame.rotation.y = heading; frame.updateMatrixWorld(true);
    tunnel(yard, frame, lock, out, port.clone().applyMatrix4(frame.matrixWorld), bore);
    const mesh = yard.launch(name, material, at, heading, glow);
    triangles += mesh.geometry.index.count / 3;
    meshes.push(mesh);
  }
  let disposed = false;
  return {
    meshes,
    stats: Object.freeze({craft: meshes.length, drawCalls: meshes.length, triangles, textures: 1, lighting: 'star, planet and station spill; no fog'}),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mesh of meshes) { mesh.removeFromParent(); mesh.geometry.dispose(); }
      material.dispose(); markings.texture.dispose();
    },
  };
}
