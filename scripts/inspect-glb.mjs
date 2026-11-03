#!/usr/bin/env node
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Box3, Matrix4, Quaternion, Vector3} from 'three';

/** Inspect downloaded glTF binaries without browser APIs or model conversion. */
export async function inspectGLB(filename) {
  const bytes = await readFile(filename);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67) throw new Error(`${filename}: not a GLB`);
  if (bytes.readUInt32LE(4) !== 2) throw new Error(`${filename}: only glTF 2 is supported`);
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error(`${filename}: GLB length does not match file`);
  let document;
  let binary;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    if (end > bytes.length) throw new Error(`${filename}: invalid chunk length`);
    const chunk = bytes.subarray(offset + 8, end);
    if (type === 0x4e4f534a) document = JSON.parse(chunk.toString('utf8').replace(/[\u0000\s]+$/, ''));
    if (type === 0x004e4942) binary = chunk;
    offset = end;
  }
  if (!document) throw new Error(`${filename}: JSON chunk is missing`);
  const g = document;
  const primitiveTriangles = primitive => {
    const count = g.accessors?.[primitive.indices ?? primitive.attributes?.POSITION]?.count || 0;
    const mode = primitive.mode ?? 4;
    return mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
  };
  const meshes = (g.meshes || []).map((mesh, index) => ({
    index,
    name: mesh.name || `mesh-${index}`,
    primitives: mesh.primitives.length,
    triangles: mesh.primitives.reduce((sum, p) => sum + primitiveTriangles(p), 0),
    vertices: mesh.primitives.reduce((sum, p) => sum + (g.accessors[p.attributes.POSITION]?.count || 0), 0),
    materials: [...new Set(mesh.primitives.map(p => p.material ?? null))],
    morphTargets: Math.max(0, ...mesh.primitives.map(p => p.targets?.length || 0)),
  }));

  // Node-instanced counts and bounds use the default scene, not orphan meshes.
  const bounds = new Box3();
  let sceneTriangles = 0;
  let scenePrimitives = 0;
  let meshInstances = 0;
  const instances = [];
  const usedMaterials = new Set();
  const traverse = (index, parentMatrix, ancestors = new Set()) => {
    if (ancestors.has(index)) throw new Error(`${filename}: cyclic node hierarchy`);
    const node = g.nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3(...(node.translation || [0, 0, 0])),
      new Quaternion(...(node.rotation || [0, 0, 0, 1])),
      new Vector3(...(node.scale || [1, 1, 1])),
    );
    const world = new Matrix4().multiplyMatrices(parentMatrix, local);
    if (node.mesh !== undefined) {
      const mesh = g.meshes[node.mesh];
      const info = meshes[node.mesh];
      meshInstances++;
      sceneTriangles += info.triangles;
      scenePrimitives += info.primitives;
      info.materials.forEach(id => usedMaterials.add(id));
      const nodeBounds = new Box3();
      for (const primitive of mesh.primitives) {
        const accessor = g.accessors[primitive.attributes.POSITION];
        if (accessor.min && accessor.max) nodeBounds.union(new Box3(new Vector3(...accessor.min), new Vector3(...accessor.max)).applyMatrix4(world));
      }
      bounds.union(nodeBounds);
      instances.push({node: index, name: node.name || `node-${index}`, mesh: node.mesh, skin: node.skin ?? null, triangles: info.triangles, bounds: nodeBounds.isEmpty() ? null : {min: nodeBounds.min.toArray(), max: nodeBounds.max.toArray()}});
    }
    const nextAncestors = new Set(ancestors).add(index);
    (node.children || []).forEach(child => traverse(child, world, nextAncestors));
  };
  const sceneIndex = g.scene ?? 0;
  const scene = g.scenes?.[sceneIndex];
  const roots = scene?.nodes || (g.nodes || []).map((_, i) => i).filter(i => !(g.nodes || []).some(n => n.children?.includes(i)));
  roots.forEach(index => traverse(index, new Matrix4()));
  const accessorRange = index => {
    const accessor = g.accessors[index];
    if (accessor.min && accessor.max) return [accessor.min[0], accessor.max[0]];
    const view = g.bufferViews?.[accessor.bufferView];
    if (!binary || !view || view.buffer !== 0 || accessor.componentType !== 5126 || accessor.type !== 'SCALAR') return null;
    const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
    const stride = view.byteStride || 4;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < accessor.count; i++) { const value = binary.readFloatLE(offset + i * stride); min = Math.min(min, value); max = Math.max(max, value); }
    return [min, max];
  };
  const animations = (g.animations || []).map((clip, index) => {
    const ranges = clip.samplers.map(sampler => accessorRange(sampler.input)).filter(Boolean);
    return {
      name: clip.name || `animation-${index}`,
      duration: ranges.length ? Math.max(...ranges.map(r => r[1])) - Math.min(...ranges.map(r => r[0])) : null,
      channels: clip.channels.length,
      targets: [...new Set(clip.channels.map(channel => channel.target.path))],
    };
  });
  return {
    file: filename,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    kibibytes: +(bytes.length / 1024).toFixed(2),
    generator: g.asset?.generator || null,
    copyright: g.asset?.copyright || null,
    requiredExtensions: g.extensionsRequired || [],
    extensionsUsed: g.extensionsUsed || [],
    defaultScene: scene?.name || sceneIndex,
    meshCount: meshes.length,
    meshInstances,
    sceneTriangles,
    scenePrimitives,
    uniqueMeshTriangles: meshes.reduce((sum, mesh) => sum + mesh.triangles, 0),
    usedMaterialCount: usedMaterials.size,
    materials: (g.materials || []).map((m, index) => ({index, name: m.name || `material-${index}`, alphaMode: m.alphaMode || 'OPAQUE', doubleSided: !!m.doubleSided, baseColor: m.pbrMetallicRoughness?.baseColorFactor || null, metalness: m.pbrMetallicRoughness?.metallicFactor ?? 1, roughness: m.pbrMetallicRoughness?.roughnessFactor ?? 1, emissive: m.emissiveFactor || [0, 0, 0], hasBaseColorTexture: m.pbrMetallicRoughness?.baseColorTexture !== undefined, hasNormalTexture: m.normalTexture !== undefined})),
    textureCount: g.textures?.length || 0,
    images: (g.images || []).map((image, index) => {
      const view = image.bufferView !== undefined ? g.bufferViews[image.bufferView] : null;
      const offset = view?.byteOffset || 0;
      const isPNG = image.mimeType === 'image/png' && binary && view?.buffer === 0 && view.byteLength >= 24;
      return {index, name: image.name || null, mimeType: image.mimeType || null, embedded: !!view || !!image.uri?.startsWith('data:'), bytes: view?.byteLength || null, dimensions: isPNG ? [binary.readUInt32BE(offset + 16), binary.readUInt32BE(offset + 20)] : null};
    }),
    externalResources: [...(g.buffers || []), ...(g.images || [])].map(r => r.uri).filter(uri => uri && !uri.startsWith('data:')),
    skins: (g.skins || []).map((skin, index) => ({index, name: skin.name || null, joints: skin.joints.length})),
    animations,
    bounds: bounds.isEmpty() ? null : {min: bounds.min.toArray(), max: bounds.max.toArray(), size: bounds.getSize(new Vector3()).toArray(), note: 'Default-scene accessor bounds after node transforms; skinned animation may exceed these base bounds.'},
    meshes,
    instances,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const entries = process.argv.slice(2);
  if (!entries.length) entries.push('public/models/poly-pizza');
  const files = [];
  for (const entry of entries) {
    if (entry.toLowerCase().endsWith('.glb')) files.push(entry);
    else for (const name of await readdir(entry)) if (name.toLowerCase().endsWith('.glb')) files.push(path.join(entry, name));
  }
  const reports = [];
  for (const filename of files.sort()) reports.push(await inspectGLB(filename));
  process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
}
