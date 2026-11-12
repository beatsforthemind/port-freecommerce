import * as THREE from 'three';

/**
 * Soft blobs under people the shadow map cannot reach: the three side
 * districts, or everywhere when the shadow map is switched off. One instanced
 * draw per crowd, rewritten in the same pass that poses the crowd.
 */
export function createContactShadows(capacity, name = 'Contact shadows') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(0,0,0,.58)'); gradient.addColorStop(.55, 'rgba(0,0,0,.26)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, capacity));
  mesh.name = name;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 1;
  const transform = new THREE.Object3D();
  let count = 0, last = -1;
  return {
    mesh,
    begin() { count = 0; },
    /** tiltX/tiltZ follow a ramp so the blob lies on it instead of cutting through. */
    add(x, y, z, yaw = 0, width = .95, length = 1.15, tiltX = 0, tiltZ = 0) {
      if (count >= capacity) return;
      transform.position.set(x, y + .02, z);
      transform.rotation.set(tiltX, yaw, tiltZ, 'YXZ');
      transform.scale.set(width, 1, length);
      transform.updateMatrix();
      mesh.setMatrixAt(count++, transform.matrix);
    },
    end() {
      mesh.count = count;
      if (count || last) mesh.instanceMatrix.needsUpdate = true;
      last = count;
    },
    dispose() { mesh.dispose(); geometry.dispose(); material.dispose(); texture.dispose(); },
  };
}
