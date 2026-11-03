import * as THREE from 'three';

const cube = new THREE.BoxGeometry(1, 1, 1);

export function box(group, material, x, y, z, w, h, d, rotationY = 0) {
  const mesh = new THREE.Mesh(cube, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.rotation.y = rotationY;
  group.add(mesh);
  return mesh;
}

export function beam(group, material, start, end, width = 0.15) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const mesh = new THREE.Mesh(cube, material);
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.scale.set(width, a.distanceTo(b), width);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  group.add(mesh);
  return mesh;
}

export function panelMaterial({color = '#29363a', roughness = 0.75, metalness = 0.45} = {}) {
  return new THREE.MeshStandardMaterial({color, roughness, metalness});
}

export function glowMaterial(color, intensity = 1) {
  const material = new THREE.MeshBasicMaterial({color});
  material.color.multiplyScalar(intensity);
  material.toneMapped = false;
  return material;
}

export function label(text, {width = 6, height = 1, color = '#f1d5a0', background = '#131e22', fontSize = 100, tracking = 0} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(32, Math.round(1024 * height / width));
  const ctx = canvas.getContext('2d');
  if (background && background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = color;
  let size = canvas.height * .63 * fontSize / 100;
  ctx.font = `600 ${size}px "Space Grotesk", sans-serif`;
  const textWidth = ctx.measureText(text).width;
  if (textWidth > canvas.width * .94) {
    size *= canvas.width * .94 / textWidth;
    ctx.font = `600 ${size}px "Space Grotesk", sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false});
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}
