import * as THREE from 'three';

/** The concourse volume covered by the overhead shadow map. */
export const SHADOW_BOUNDS = Object.freeze({minX: -36, maxX: 36, minZ: -132, maxZ: 102, top: 30});
/** Slightly inside the map's edge: anything here is grounded by a real shadow. */
export function castsRealShadow(x, z) { return x > -33 && x < 33 && z > -130.5 && z < 100.5; }

const PROBE_POINTS = Object.freeze({concourse: [0, 9, 10], market: [-70, 3.2, 32], observation: [76, 6, -20], docks: [0, 6, -155]});
const PROBE_SIZE = 128;
const REFLECTION = .38;
// Probes add their own ambient term, so the hemisphere gives a little back.
const AMBIENT_WITH_PROBES = 1.4, AMBIENT_ALONE = 1.6;

/**
 * Station lighting. An overhead key stands in for the roof luminaires and owns
 * the only shadow map; one reflection probe per sector, captured once from the
 * finished scene, gives the metal something to reflect. Both are "detail" and
 * can be switched off together on hardware that cannot afford them.
 */
export function createLighting({scene, renderer, detail = true, shadowMapSize = [2048, 4096]} = {}) {
  // The floor is the largest bright surface in the hall, so the ground term is
  // its bounce. The roof and soffit materials are very dark; anything weaker
  // leaves the structural bays overhead indistinguishable from black.
  const hemisphere = new THREE.HemisphereLight('#c4d5cc', '#d2d8cd', AMBIENT_WITH_PROBES);
  // The low raking light keeps the long sheen on the deck and models walls and
  // faces. It casts no shadow, so shaded ground is dimmed rather than blacked out.
  const sun = new THREE.DirectionalLight('#e1d4b3', 2);
  sun.position.set(-18, 45, -60);
  const fill = new THREE.DirectionalLight('#9bbbc0', 1.1);
  fill.position.set(70, 20, 30);
  const warm = new THREE.PointLight('#edaa6c', 220, 85, 1.6);
  warm.position.set(0, 14, -25);
  // Straight down from beneath the roof zone. The roof slab, its trusses and
  // cable trays sit behind the shadow camera: the hall is lit by its ceiling
  // rather than sealed by it, and small parts thirty metres up cast nothing.
  const key = new THREE.DirectionalLight('#e8e4d4', 2);
  const centreZ = (SHADOW_BOUNDS.minZ + SHADOW_BOUNDS.maxZ) / 2;
  key.position.set(0, SHADOW_BOUNDS.top, centreZ);
  key.target.position.set(0, 0, centreZ);
  key.shadow.mapSize.set(...shadowMapSize);
  const view = key.shadow.camera;
  view.up.set(0, 0, -1);
  view.left = SHADOW_BOUNDS.minX; view.right = SHADOW_BOUNDS.maxX;
  view.top = (SHADOW_BOUNDS.maxZ - SHADOW_BOUNDS.minZ) / 2; view.bottom = -view.top;
  view.near = .2; view.far = SHADOW_BOUNDS.top + 1.1;
  view.updateProjectionMatrix();
  key.shadow.bias = -.0006; key.shadow.normalBias = .06; key.shadow.radius = 2.5;
  scene.add(hemisphere, sun, fill, warm, key, key.target);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // People move slowly and the crowd itself uploads at 20 Hz, so the map is
  // refreshed on a timer instead of with every frame.
  renderer.shadowMap.autoUpdate = false;

  const volume = new THREE.Box3(new THREE.Vector3(SHADOW_BOUNDS.minX, -1, SHADOW_BOUNDS.minZ), new THREE.Vector3(SHADOW_BOUNDS.maxX, SHADOW_BOUNDS.top, SHADOW_BOUNDS.maxZ));
  const sphere = new THREE.Sphere();
  const probes = {};
  let generator = null, placeholder = null;
  let current = null, wanted = null, blend = 1;
  let shadowClock = 0, disposed = false;

  function applyDetail() {
    key.castShadow = detail;
    hemisphere.intensity = detail && current ? AMBIENT_WITH_PROBES : AMBIENT_ALONE;
    scene.environment = detail ? current || placeholder?.texture || null : null;
    scene.environmentIntensity = detail && current ? REFLECTION : 0;
    renderer.shadowMap.needsUpdate = true;
  }

  const api = {
    hemisphere, sun, fill, warm, key,
    get detail() { return detail; },
    get stats() {
      return {detail, shadowMap: detail ? shadowMapSize.join('x') : null, probes: Object.keys(probes).length, probeSize: PROBE_SIZE,
        realtimeLights: 5, shadowRefreshHz: 30};
    },
    /** Decide who casts and who receives. Call once the scene is complete. */
    configureShadows() {
      scene.updateMatrixWorld(true);
      scene.traverse(node => {
        if (!node.isMesh) return;
        const material = Array.isArray(node.material) ? node.material[0] : node.material;
        const lit = Boolean(material?.isMeshStandardMaterial);
        node.receiveShadow = lit;
        let casts = lit && !material.transparent && node.userData.castShadow !== false;
        if (casts && node.frustumCulled) {
          // Anything wholly outside the map would only be submitted to be clipped.
          const bounds = node.isInstancedMesh ? (node.boundingSphere || (node.computeBoundingSphere(), node.boundingSphere)) : (node.geometry.boundingSphere || (node.geometry.computeBoundingSphere(), node.geometry.boundingSphere));
          sphere.copy(bounds).applyMatrix4(node.matrixWorld);
          casts = volume.intersectsSphere(sphere);
        }
        node.castShadow = casts;
      });
      applyDetail();
    },
    /** Reserve the reflective shader variants before compiling, so capture and swap reuse them. */
    reserveEnvironment() {
      if (!detail || generator) return;
      generator = new THREE.PMREMGenerator(renderer);
      placeholder = generator.fromScene(new THREE.Scene(), 0, .1, 10, {size: PROBE_SIZE});
      applyDetail();
    },
    /**
     * The probes are captured into a linear, untonemapped target, which needs
     * its own variant of every shader. Link those off the main thread too, or
     * the capture would stall on them one by one.
     */
    compileForCapture(camera) {
      if (!detail || !generator) return Promise.resolve();
      const target = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType});
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      const linked = renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(previous);
      return linked.finally(() => target.dispose());
    },
    captureProbes() {
      if (!detail || !generator || current) return;
      for (const [id, point] of Object.entries(PROBE_POINTS)) {
        probes[id] = generator.fromScene(scene, .015, .1, 600, {size: PROBE_SIZE, position: new THREE.Vector3(...point)});
      }
      current = wanted = probes.concourse.texture; blend = 1;
      placeholder.dispose(); placeholder = null;
      // The generator's scratch targets are tiny; it is released with the lighting.
      applyDetail();
    },
    setDetail(value) {
      value = Boolean(value) && Object.keys(probes).length > 0;
      if (value === detail) return;
      detail = value; applyDetail();
    },
    update(dt, sector) {
      if (disposed) return;
      shadowClock += dt;
      if (detail && shadowClock >= 1 / 30) { shadowClock = 0; renderer.shadowMap.needsUpdate = true; }
      if (!detail || !current) return;
      // Dip, swap, recover: the probe changes at a doorway without a visible cut.
      wanted = (probes[sector] || probes.concourse).texture;
      if (wanted !== current) {
        blend -= dt / .25;
        if (blend <= 0) { blend = 0; current = wanted; scene.environment = current; }
      } else if (blend < 1) blend = Math.min(1, blend + dt / .4);
      scene.environmentIntensity = REFLECTION * (.3 + .7 * blend);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.environment = null;
      for (const target of Object.values(probes)) target.dispose();
      placeholder?.dispose(); generator?.dispose();
      for (const light of [hemisphere, sun, fill, warm, key]) { light.removeFromParent(); light.dispose?.(); }
      key.shadow.dispose?.(); key.target.removeFromParent();
    },
  };
  return api;
}
