import * as THREE from 'three';

/**
 * Five small GPU batches add movement and depth without extra lights, texture
 * uploads, simulation loops, or full-screen passes. All geometry is immutable.
 */
export function createAtmosphere({ renderer, camera, reducedMotion = false } = {}) {
  const group = new THREE.Group();
  group.name = 'FreeCommerce / atmosphere';
  const time = { value: 0 };
  const projectionScale = { value: 600 };
  const resources = [];
  let effectTime = 0;
  let disposed = false;
  let seed = 60931;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const track = (value) => { resources.push(value); return value; };
  const fragmentOutput = '#include <tonemapping_fragment>\n#include <colorspace_fragment>';

  function points(positions, phases, sizes, material, name) {
    const geometry = track(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    const object = new THREE.Points(geometry, track(material));
    object.name = name;
    // Shader drift is bounded to less than four metres. Expand the sphere once.
    geometry.computeBoundingSphere();
    geometry.boundingSphere.radius += 4;
    object.renderOrder = 2;
    group.add(object);
    return object;
  }

  // Suspended particles catch the shaft light, with just a few near eye level.
  const dustPositions = [], dustPhases = [], dustSizes = [];
  const dustRegions = [
    [640, -20, 20, 1.1, 29, -120, 92],
    [90, 39, 94, 1.2, 14, -36, -4],
    [110, -94, -37, 1.4, 11, 22, 38],
    [40, -8, 8, 1.4, 14, -175, -134],
  ];
  for (const [count, x0, x1, y0, y1, z0, z1] of dustRegions) {
    for (let i = 0; i < count; i++) {
      dustPositions.push(x0 + random() * (x1 - x0), y0 + random() * (y1 - y0), z0 + random() * (z1 - z0));
      dustPhases.push(random() * Math.PI * 2);
      dustSizes.push(.014 + random() * .022);
    }
  }
  const dust = points(dustPositions, dustPhases, dustSizes, new THREE.ShaderMaterial({
    uniforms: { uTime: time, uProjectionScale: projectionScale },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform float uProjectionScale;
      attribute float aPhase; attribute float aSize;
      varying float vAlpha; varying vec3 vTint;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * .12 + aPhase) * .24;
        p.y += sin(uTime * .09 + aPhase * 2.) * .18;
        p.z += cos(uTime * .07 + aPhase) * .2;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        float distanceToEye = length(mv.xyz);
        vAlpha = (.12 + .1 * sin(aPhase) * sin(aPhase))
          * (1. - smoothstep(55., 145., distanceToEye))
          * smoothstep(.6, 2.5, distanceToEye);
        vTint = mix(vec3(.57,.66,.59), vec3(.82,.67,.43), sin(aPhase) * .5 + .5);
        gl_PointSize = clamp(aSize * uProjectionScale / max(1., -mv.z), .75, 4.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vAlpha; varying vec3 vTint;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.;
        float soft = 1. - smoothstep(.08, 1., r);
        gl_FragColor = vec4(vTint, soft * soft * vAlpha);
        ${fragmentOutput}
      }`,
  }), 'Light-catching suspended dust');

  // Each vent uses twenty sprite points. Soft footprints are tightly bounded.
  const vents = [
    [-29.2, .3, 60], [29.2, .3, -52], [-29.2, .3, -86], [29.2, .3, 38],
    [-87, 2.4, 19.9], [-54, 2.4, 40.1], [13.5, 2, -169], [95.5, .3, -34],
  ];
  const steamPositions = [], steamPhases = [], steamSizes = [];
  for (const vent of vents) {
    for (let i = 0; i < 20; i++) {
      steamPositions.push(...vent);
      steamPhases.push(random());
      steamSizes.push(random());
    }
  }
  const steam = points(steamPositions, steamPhases, steamSizes, new THREE.ShaderMaterial({
    uniforms: { uTime: time, uProjectionScale: projectionScale },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime; uniform float uProjectionScale;
      attribute float aPhase; attribute float aSize;
      varying float vAlpha;
      void main() {
        float progress = fract(aPhase + uTime * (.065 + aSize * .035));
        float spread = .08 + progress * .55;
        vec3 p = position + vec3(
          sin(aPhase * 37. + progress * 3.5) * spread,
          progress * 3.7,
          cos(aPhase * 29. + progress * 2.4) * spread * .7
        );
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        float distanceToEye = length(mv.xyz);
        vAlpha = sin(progress * 3.14159265) * .082
          * (1. - smoothstep(45., 110., distanceToEye));
        float size = .14 + progress * .7;
        gl_PointSize = clamp(size * uProjectionScale / max(1., -mv.z), 1., 64.);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.;
        float soft = 1. - smoothstep(0., 1., r);
        gl_FragColor = vec4(.41, .48, .44, soft * soft * vAlpha);
        ${fragmentOutput}
      }`,
  }), 'Sparse warm vent exhaust');

  // Crossed tapered ribbons suggest shafts without a volumetric render pass.
  const shaftPositions = [], shaftUvs = [], shaftIndices = [];
  function ribbon(start, end, width, axis) {
    const index = shaftPositions.length / 3;
    const ax = axis[0], ay = axis[1], az = axis[2];
    for (const [p, extent, u, v] of [
      [start, -.3, 0, 0], [start, .3, 1, 0],
      [end, -width, 0, 1], [end, width, 1, 1],
    ]) {
      shaftPositions.push(p[0] + ax * extent, p[1] + ay * extent, p[2] + az * extent);
      shaftUvs.push(u, v);
    }
    shaftIndices.push(index, index + 2, index + 1, index + 1, index + 2, index + 3);
  }
  for (const z of [-105, -57, -9, 39, 87]) {
    const start = [0, 32.9, z];
    const end = [12, 1, z + 18];
    ribbon(start, end, 4.8, [1, 0, 0]);
    ribbon(start, end, 4.8, [0, 0, 1]);
  }
  for (const z of [-29, -11]) {
    ribbon([96.7, 14.5, z], [62, .15, z + 11], 3.7, [0, 0, 1]);
  }
  const shaftGeometry = track(new THREE.BufferGeometry());
  shaftGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shaftPositions, 3));
  shaftGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(shaftUvs, 2));
  shaftGeometry.setIndex(shaftIndices);
  const shaftMaterial = track(new THREE.ShaderMaterial({
    uniforms: { uTime: time },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv; varying float vDistance;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        vDistance = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv; varying float vDistance;
      void main() {
        float across = sin(vUv.x * 3.14159265);
        float lengthFade = smoothstep(0., .08, vUv.y) * (1. - smoothstep(.65, 1., vUv.y));
        float air = .9 + .1 * sin(vUv.y * 13. + uTime * .15);
        float alpha = across * across * lengthFade * air * .036;
        alpha *= 1. - smoothstep(90., 200., vDistance);
        gl_FragColor = vec4(.55, .65, .57, alpha);
        ${fragmentOutput}
      }`,
  }));
  shaftMaterial.forceSinglePass = true;
  const shafts = new THREE.Mesh(shaftGeometry, shaftMaterial);
  shafts.name = 'Tapered station light shafts';
  group.add(shafts);

  // Flush route chevrons: one draw call, animation derived from world position.
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(-.42, -.04);
  arrowShape.lineTo(0, .54);
  arrowShape.lineTo(.42, -.04);
  arrowShape.lineTo(.24, -.04);
  arrowShape.lineTo(0, .29);
  arrowShape.lineTo(-.24, -.04);
  arrowShape.closePath();
  const arrowGeometry = track(new THREE.ShapeGeometry(arrowShape));
  arrowGeometry.rotateX(-Math.PI / 2);
  const arrowMaterial = track(new THREE.ShaderMaterial({
    uniforms: { uTime: time },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    vertexShader: `
      varying float vPath; varying float vDistance;
      void main() {
        vec4 p = vec4(position, 1.);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        vec4 mv = modelViewMatrix * p;
        vPath = p.z;
        vDistance = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime; varying float vPath; varying float vDistance;
      void main() {
        float pulse = pow(max(0., sin(vPath * .055 + uTime * .42)), 8.);
        float alpha = (.12 + pulse * .28) * (1. - smoothstep(50., 140., vDistance));
        gl_FragColor = vec4(.64, .41, .19, alpha);
        ${fragmentOutput}
      }`,
  }));
  const arrows = new THREE.InstancedMesh(arrowGeometry, arrowMaterial, 36);
  const transform = new THREE.Object3D();
  let arrowIndex = 0;
  for (const x of [-7.8, 7.8]) {
    for (let z = -118; z <= 86; z += 12) {
      transform.position.set(x, .047, z);
      transform.rotation.set(0, x < 0 ? Math.PI : 0, 0);
      transform.updateMatrix();
      arrows.setMatrixAt(arrowIndex++, transform.matrix);
    }
  }
  arrows.count = arrowIndex;
  arrows.computeBoundingSphere();
  arrows.name = 'Traveling deck route chevrons';
  group.add(arrows);

  // Three exterior vessels share one GPU-animated mesh, including their engines.
  const shipPositions = [], shipColors = [], shipRoutes = [], shipPhases = [];
  const unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const sourcePositions = unitBox.getAttribute('position');
  const color = new THREE.Color();
  function shipBox(center, scale, tint, route, phase, yaw) {
    color.set(tint);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < sourcePositions.count; i++) {
      const x = sourcePositions.getX(i) * scale[0] + center[0];
      const y = sourcePositions.getY(i) * scale[1] + center[1];
      const z = sourcePositions.getZ(i) * scale[2] + center[2];
      shipPositions.push(x * c + z * s, y, -x * s + z * c);
      shipColors.push(color.r, color.g, color.b);
      shipRoutes.push(route);
      shipPhases.push(phase);
    }
  }
  for (let i = 0; i < 3; i++) {
    const route = i === 2 ? 1 : 0;
    const yaw = route ? Math.PI / 2 : 0;
    const phase = i * 1.8 + .4;
    shipBox([0, 0, 0], [2, 1.3, 8], '#4e6566', route, phase, yaw);
    shipBox([0, .8, 1.6], [1.35, .55, 2.3], '#82918a', route, phase, yaw);
    shipBox([0, -.2, -1.4], [6.2, .32, 3.3], '#465957', route, phase, yaw);
    for (const side of [-1, 1]) {
      shipBox([side * 2.1, -.1, -1.9], [.8, .8, 3.1], '#77583d', route, phase, yaw);
      shipBox([side * 2.1, -.1, -3.55], [.48, .48, .16], '#d8c098', route, phase, yaw);
    }
  }
  unitBox.dispose();
  const shipGeometry = track(new THREE.BufferGeometry());
  shipGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shipPositions, 3));
  shipGeometry.setAttribute('color', new THREE.Float32BufferAttribute(shipColors, 3));
  shipGeometry.setAttribute('aRoute', new THREE.Float32BufferAttribute(shipRoutes, 1));
  shipGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(shipPhases, 1));
  const shipMaterial = track(new THREE.ShaderMaterial({
    uniforms: { uTime: time },
    vertexShader: `
      uniform float uTime; attribute vec3 color;
      attribute float aRoute; attribute float aPhase; varying vec3 vColor;
      void main() {
        vec3 p = position;
        if (aRoute < .5) {
          p += vec3(137. + aPhase * 3., 18. + aPhase * 2., mod(uTime * 1.45 + aPhase * 43., 190.) - 115.);
        } else {
          p += vec3(mod(uTime * 2. + aPhase * 41., 220.) - 110., 24., -245.);
        }
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, 1.);
        ${fragmentOutput}
      }`,
  }));
  const ships = new THREE.Mesh(shipGeometry, shipMaterial);
  ships.name = 'Distant orbital shipping';
  // Vertex motion crosses the full route; no CPU matrix updates are necessary.
  ships.frustumCulled = false;
  group.add(ships);

  const stats = Object.freeze({
    drawCalls: 5,
    particles: dustPositions.length / 3 + steamPositions.length / 3,
    triangles: shaftIndices.length / 3 + arrowGeometry.index.count / 3 * arrowIndex + shipPositions.length / 9,
    textures: 0,
    lights: 0,
  });
  group.userData.performance = stats;

  return {
    group,
    stats,
    update(dt, _time, context) {
      if (disposed) return;
      const motionReduced = context?.reducedMotion ?? reducedMotion;
      if (!motionReduced) effectTime += Math.max(0, Math.min(dt, .05));
      time.value = effectTime;
      const height = renderer?.domElement?.height || 900;
      const fov = camera?.fov || 64;
      projectionScale.value = height * .5 / Math.tan(fov * Math.PI / 360);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      arrows.dispose();
      resources.forEach(resource => resource.dispose());
      group.clear();
    },
  };
}
