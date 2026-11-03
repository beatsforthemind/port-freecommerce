import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MODEL_ROOT = '/models/poly-pizza/';
const SOURCES = Object.freeze({
  robot: {file: 'animated-robot.glb', title: 'Animated Robot', author: 'Quaternius', source: 'https://poly.pizza/m/QCm7qe9uNJ'},
  computer: {file: 'scifi-computer.glb', title: 'Scifi Computer', author: 'Quaternius', source: 'https://poly.pizza/m/U0xmt6tUlL'},
  tree: {file: 'tree-spiral.glb', title: 'Tree Spiral', author: 'Quaternius', source: 'https://poly.pizza/m/poFJzEWCk8'},
  pot: {file: 'cooking-pot.glb', title: 'Cooking Pot', author: 'Quaternius', source: 'https://poly.pizza/m/jAUb3FoCN7'},
});

/**
 * Imported foreground detail is deliberately bounded. Static copies share both
 * geometry and materials through instancing; one service unit owns one mixer.
 * Each load can fail independently without hiding the procedural station.
 */
export async function createImportedModels({renderer, camera, floorHeight = () => 0, loadTimeoutMs = 8000} = {}) {
  const group = new THREE.Group();
  group.name = 'Port FreeCommerce / Poly Pizza models';
  const colliders = [];
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const skeletons = new Set();
  const instances = [];
  const sources = [];
  const locations = [];
  const errors = [];
  const loaded = {robot: false, computer: false, tree: false, pot: false};
  const loader = new GLTFLoader();
  const object = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  const bounds = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const robotFrustum = new THREE.Frustum();
  const projectionView = new THREE.Matrix4();
  const robotSphere = new THREE.Sphere(new THREE.Vector3(), 2);
  const closedImages = new Set();
  const deadlineMs = Number.isFinite(loadTimeoutMs) && loadTimeoutMs > 0 ? loadTimeoutMs : 8000;
  let robot = null;
  let mixer = null;
  let animationTime = 0;
  let disposed = false;
  let submittedDrawCalls = 0;
  let submittedTriangles = 0;
  let instanceCount = 0;
  const stats = {
    loadedAssets: 0, expectedAssets: Object.keys(SOURCES).length,
    instances: 0, drawCalls: 0, triangles: 0, textures: 0,
    animation: null, animationActive: false, loaded, errors, sources, locations, disposed: false,
  };

  function releaseTexture(texture) {
    texture.dispose();
    const image = texture.image;
    if (image?.close && !closedImages.has(image)) {image.close(); closedImages.add(image);}
  }

  function discardLoadedAsset(gltf) {
    // A parser can finish after its deadline even when the fetch was aborted.
    // Such a result must never install geometry or retain decoded bitmaps.
    const assetGeometry = new Set(), assetMaterials = new Set(), assetTextures = new Set(), assetSkeletons = new Set();
    gltf.scene.traverse(node => {
      if (node.skeleton) assetSkeletons.add(node.skeleton);
      if (!node.isMesh) return;
      assetGeometry.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        assetMaterials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) assetTextures.add(value);
      }
    });
    assetSkeletons.forEach(skeleton => skeleton.dispose());
    assetGeometry.forEach(geometry => geometry.dispose());
    assetMaterials.forEach(material => material.dispose());
    assetTextures.forEach(releaseTexture);
    gltf.scene.clear();
  }

  function loadAsset(descriptor) {
    const url = `${MODEL_ROOT}${descriptor.file}`;
    const controller = new AbortController();
    const timeoutError = new Error(`${descriptor.title} exceeded its ${deadlineMs} ms loading deadline.`);
    let expired = false, timer;
    const work = (async () => {
      const response = await fetch(url, {signal:controller.signal, credentials:'same-origin'});
      if (!response.ok) throw new Error(`${descriptor.title} could not load (HTTP ${response.status}).`);
      const data = await response.arrayBuffer();
      if (expired) throw timeoutError;
      const gltf = await loader.parseAsync(data, MODEL_ROOT);
      if (expired) {discardLoadedAsset(gltf); throw timeoutError;}
      return gltf;
    })();
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {expired = true; controller.abort(); reject(timeoutError);}, deadlineMs);
    });
    return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
  }

  function collectResources(root) {
    root.traverse(node => {
      if (node.isSkinnedMesh && node.skeleton) skeletons.add(node.skeleton);
      if (!node.isMesh) return;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
      node.castShadow = false;
      node.receiveShadow = false;
    });
  }

  function normalize(root, limits) {
    const normalized = new THREE.Group();
    const pivot = new THREE.Group();
    normalized.add(pivot); pivot.add(root);
    normalized.updateMatrixWorld(true);
    bounds.setFromObject(root);
    bounds.getSize(size); bounds.getCenter(center);
    if (bounds.isEmpty() || !Number.isFinite(size.y) || size.y <= 0) throw new Error('Model has no usable bounds.');
    let scale = limits.height / size.y;
    if (limits.width && size.x > 0) scale = Math.min(scale, limits.width / size.x);
    if (limits.depth && size.z > 0) scale = Math.min(scale, limits.depth / size.z);
    const dimensions = {width: size.x * scale, height: size.y * scale, depth: size.z * scale};
    pivot.scale.setScalar(scale);
    pivot.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    normalized.updateMatrixWorld(true);
    return {root: normalized, dimensions};
  }

  function colliderAt(placement, dimensions) {
    const yaw = placement.yaw || 0;
    const scale = placement.scale || 1;
    const width = (Math.abs(Math.cos(yaw)) * dimensions.width + Math.abs(Math.sin(yaw)) * dimensions.depth) * scale;
    const depth = (Math.abs(Math.sin(yaw)) * dimensions.width + Math.abs(Math.cos(yaw)) * dimensions.depth) * scale;
    colliders.push({minX: placement.x - width / 2, maxX: placement.x + width / 2, minZ: placement.z - depth / 2, maxZ: placement.z + depth / 2,minY:placement.y||0,maxY:(placement.y||0)+dimensions.height*scale});
  }

  function staticCopies(gltf, limits, placements, name, solid = false) {
    collectResources(gltf.scene);
    const template = normalize(gltf.scene, limits);
    template.root.traverse(source => {
      if (!source.isMesh) return;
      if (source.isSkinnedMesh) throw new Error('A static model unexpectedly contains a skin.');
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, placements.length);
      mesh.name = `${name} / shared ${source.name || 'mesh'}`;
      mesh.matrixAutoUpdate = false;
      for (let index = 0; index < placements.length; index++) {
        const placement = placements[index];
        object.position.set(placement.x, placement.y || 0, placement.z);
        object.rotation.set(0, placement.yaw || 0, 0);
        object.scale.setScalar(placement.scale || 1);
        object.updateMatrix();
        matrix.multiplyMatrices(object.matrix, source.matrixWorld);
        mesh.setMatrixAt(index, matrix);
      }
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      instances.push(mesh); group.add(mesh);
      const count = source.geometry.index ? source.geometry.index.count : source.geometry.attributes.position.count;
      submittedTriangles += count / 3 * placements.length;
      submittedDrawCalls += Array.isArray(source.material) ? source.material.length : 1;
    });
    if (solid) for (const placement of placements) colliderAt(placement, template.dimensions);
    for (const placement of placements) locations.push({model: name, x: placement.x, y: placement.y || 0, z: placement.z, yaw: placement.yaw || 0, scale: placement.scale || 1});
    instanceCount += placements.length;
    return template.dimensions;
  }

  function batchComputerColors(gltf) {
    // This model's five opaque, untextured PBR materials differ only in color.
    // Vertex colors preserve their linear RGB factors while using one draw.
    collectResources(gltf.scene);
    gltf.scene.updateMatrixWorld(true);
    const meshes = [];
    gltf.scene.traverse(node => {if (node.isMesh) meshes.push(node);});
    const first = meshes[0]?.material;
    const properties = ['metalness','roughness','opacity','transparent','side','alphaTest','depthTest','depthWrite','blending','flatShading','premultipliedAlpha','dithering','toneMapped'];
    const compatible = first?.isMeshStandardMaterial && meshes.every(mesh => {
      const material = mesh.material;
      return !mesh.isSkinnedMesh && material?.isMeshStandardMaterial && !material.vertexColors
        && !Object.values(material).some(value => value?.isTexture)
        && material.emissive.equals(first.emissive)
        && properties.every(key => material[key] === first[key]);
    });
    if (!compatible || meshes.length < 2) return;
    const inverseRoot = gltf.scene.matrixWorld.clone().invert();
    const pieces = [];
    for (const mesh of meshes) {
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseRoot,mesh.matrixWorld));
      const count = geometry.attributes.position.count;
      const colors = new Float32Array(count * 3), tint = mesh.material.color;
      for (let i=0;i<count;i++) {colors[i*3]=tint.r;colors[i*3+1]=tint.g;colors[i*3+2]=tint.b;}
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
      pieces.push(geometry);
    }
    const geometry = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    if (!geometry) return;
    const material = first.clone();
    material.color.setRGB(1,1,1); material.vertexColors = true;
    material.name = 'Information console / preserved PBR vertex colors';
    const mesh = new THREE.Mesh(geometry,material);
    mesh.name = 'Information console / five color regions';
    gltf.scene.clear(); gltf.scene.add(mesh);
    geometries.add(geometry);materials.add(material);
    stats.computerColorBatches = 1;
  }

  function addRobot(gltf) {
    collectResources(gltf.scene);
    const model = cloneSkeleton(gltf.scene);
    batchRigidRobot(model);
    const idle = gltf.animations.find(clip => /idle|stand|breath/i.test(clip.name));
    if (idle) {
      mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(idle).play(); mixer.update(0);
      stats.animation = idle.name;
    } else stats.animation = 'Static pose: no stationary animation clip supplied';
    model.updateMatrixWorld(true);
    model.traverse(node => {
      if (!node.isSkinnedMesh) return;
      node.skeleton.update(); node.computeBoundingBox(); node.computeBoundingSphere();
    });
    const normalized = normalize(model, {height: 1.85, width: 1.25, depth: 1.2});
    robot = normalized.root;
    robot.name = 'Imported service unit / Quaternius';
    robot.position.set(-16, 0, 24);
    robot.rotation.y = .28;
    robotSphere.center.set(-16,normalized.dimensions.height/2,24);
    // The supplied idle pose is under 1.9 m tall. A 2 m sphere also covers its
    // extremities and animation, keeping edge-of-frame limbs from popping out.
    robotSphere.radius = Math.max(2,Math.hypot(normalized.dimensions.width,normalized.dimensions.height,normalized.dimensions.depth)/2+.5);
    robot.traverse(node => {
      if (!node.isMesh) return;
      node.frustumCulled = !node.isSkinnedMesh;
      const count = node.geometry.index ? node.geometry.index.count : node.geometry.attributes.position.count;
      submittedTriangles += count / 3;
      submittedDrawCalls += Array.isArray(node.material) ? node.material.length : 1;
    });
    collectResources(robot); group.add(robot);
    colliderAt({x: -16, z: 24, yaw: .28}, normalized.dimensions);
    // The label "Animated" does not guarantee useful clips. Only an identified
    // stationary clip is used; a walking/dancing unit would skate in place.
    instanceCount++;
    locations.push({model: 'Imported service unit', x: -16, y: 0, z: 24, yaw: .28});
    return normalized.dimensions;
  }

  function batchRigidRobot(model) {
    model.updateMatrixWorld(true);
    const skins = [];
    const rigid = [];
    model.traverse(node => {
      if (node.isSkinnedMesh) skins.push(node);
      else if (node.isMesh) rigid.push(node);
    });
    if (!skins.length) return;
    const bones = skins[0].skeleton.bones;
    const inverseRoot = model.matrixWorld.clone().invert();
    const groups = new Map();
    const replaced = [];
    for (const mesh of rigid) {
      // A weighted attachment follows its original animated bone. Arbitrarily
      // merging these meshes as static geometry would break the supplied rig.
      let bone = mesh.parent;
      while (bone && !bones.includes(bone)) bone = bone.parent;
      const boneIndex = bones.indexOf(bone);
      if (boneIndex < 0 || Array.isArray(mesh.material) || mesh.geometry.morphAttributes.position?.length) continue;
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld));
      const count = geometry.attributes.position.count;
      const indices = new Uint16Array(count * 4);
      const weights = new Float32Array(count * 4);
      for (let index = 0; index < count; index++) {indices[index * 4] = boneIndex; weights[index * 4] = 1;}
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
      geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
      if (!groups.has(mesh.material)) groups.set(mesh.material, []);
      groups.get(mesh.material).push(geometry); replaced.push(mesh);
    }
    if (!groups.size) return;
    const skeleton = new THREE.Skeleton(bones);
    skeletons.add(skeleton);
    const combinedMeshes = [];
    for (const [material, parts] of groups) {
      const geometry = mergeGeometries(parts);
      parts.forEach(part => part.dispose());
      if (!geometry) throw new Error('Unable to batch the robot’s rigid bone attachments.');
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.name = `Service unit / ${material.name} articulated batch`;
      model.add(mesh); model.updateMatrixWorld(true);
      mesh.bind(skeleton, mesh.matrixWorld);
      combinedMeshes.push(mesh); geometries.add(geometry);
    }
    replaced.forEach(mesh => mesh.removeFromParent());
    stats.robotRigidBatches = combinedMeshes.length;
  }

  const definitions = [
    ['robot', addRobot],
    ['computer', gltf => {batchComputerColors(gltf); return staticCopies(gltf, {height: 1.9, width: 1.5, depth: 1.1}, [
      {x: -10, z: 18}, {x: 89, y:floorHeight(89,-20), z: -20, yaw: -Math.PI / 2},
    ], 'Imported information consoles', true);} ],
    ['tree', gltf => staticCopies(gltf, {height: 3.4, width: 3, depth: 3}, [
      {x: 17.5, y: 1.2, z: -76, yaw: .3},
      {x: -21.7, y: 1.34, z: 67.3, yaw: -1.1, scale: 1.8 / 3.4},
      {x: 21.7, y: 1.34, z: -45.7, yaw: .8, scale: 1.8 / 3.4},
    ], 'Imported spiral cultures')],
    ['pot', gltf => staticCopies(gltf, {height: 1.15, width: 1.1, depth: 1.1}, [
      {x: -16.2, y: 1.73, z: 41.3, yaw: .2}, {x: -18.85, y: 1.73, z: 41.3, yaw: -.35, scale: .85 / 1.1},
    ], 'Imported cooking vessels')],
  ];
  const results = await Promise.allSettled(definitions.map(async ([key, install]) => {
    const descriptor = SOURCES[key];
    const url = `${MODEL_ROOT}${descriptor.file}`;
    const gltf = await loadAsset(descriptor);
    const before = {children: group.children.length, instances: instances.length, colliders: colliders.length, locations: locations.length,
      triangles: submittedTriangles, calls: submittedDrawCalls, count: instanceCount, robot, mixer};
    let dimensions;
    try {
      dimensions = install(gltf);
    } catch (error) {
      while (group.children.length > before.children) group.remove(group.children[group.children.length - 1]);
      while (instances.length > before.instances) instances.pop().dispose();
      colliders.length = before.colliders; locations.length = before.locations;
      submittedTriangles = before.triangles; submittedDrawCalls = before.calls; instanceCount = before.count;
      if (mixer !== before.mixer) {mixer?.stopAllAction(); mixer?.uncacheRoot(mixer.getRoot());}
      robot = before.robot; mixer = before.mixer;
      throw error;
    }
    loaded[key] = true;
    stats.loadedAssets++;
    sources.push({...descriptor, url, license: 'CC0-1.0', dimensions, clips: gltf.animations.map(clip => clip.name)});
  }));
  results.forEach((result, index) => {
    if (result.status === 'rejected') errors.push({model: definitions[index][0], message: result.reason?.message || String(result.reason)});
  });
  stats.instances = instanceCount;
  stats.drawCalls = submittedDrawCalls;
  stats.triangles = submittedTriangles;
  stats.textures = textures.size;
  stats.materials = materials.size;
  group.userData.importedModels = stats;

  return {
    group, colliders, stats, loaded,
    update(dt, _time, context = {}) {
      if (disposed || !robot) return;
      const eye = context.camera || camera;
      const distanceSquared = eye ? (eye.position.x + 16) ** 2 + (eye.position.z - 24) ** 2 : 0;
      let inFrustum = true;
      if (eye?.projectionMatrix && eye?.matrixWorldInverse) {
        eye.updateMatrixWorld();
        projectionView.multiplyMatrices(eye.projectionMatrix,eye.matrixWorldInverse);
        robotFrustum.setFromProjectionMatrix(projectionView);
        inFrustum = robotFrustum.intersectsSphere(robotSphere);
      }
      robot.visible = distanceSquared < 10000 && inFrustum;
      stats.animationActive = Boolean(mixer && robot.visible && distanceSquared < 4225 && !context.reducedMotion);
      if (!stats.animationActive) {animationTime = 0; return;}
      animationTime += Math.max(0, Math.min(dt, .1));
      if (animationTime >= .05) {mixer.update(animationTime); animationTime = 0;}
    },
    dispose() {
      if (disposed) return;
      disposed = true; stats.disposed = true;
      if (mixer) {mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot());}
      instances.forEach(mesh => mesh.dispose());
      skeletons.forEach(skeleton => skeleton.dispose());
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(releaseTexture);
      group.clear();
    },
  };
}
