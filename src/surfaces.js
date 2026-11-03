import * as THREE from 'three';

let surfaceLibrary;

/** One reusable sheet-metal atlas, generated once rather than loaded or updated. */
export function createSurfaceLibrary() {
  if (surfaceLibrary) return surfaceLibrary;
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  const heightCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = heightCanvas.width = heightCanvas.height = size;
  const color = colorCanvas.getContext('2d');
  const height = heightCanvas.getContext('2d', {willReadFrequently: true});
  let seed = 1193;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  color.fillStyle = '#e5e6df'; color.fillRect(0, 0, size, size);
  height.fillStyle = '#808080'; height.fillRect(0, 0, size, size);

  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = col * 256, y = row * 256, id = row * 4 + col;
    const shade = 220 + Math.floor(random() * 15);
    color.fillStyle = `rgb(${shade},${shade + 1},${shade - 3})`;
    color.fillRect(x + 4, y + 4, 248, 248);
    const grime = color.createLinearGradient(x, y, x, y + 256);
    grime.addColorStop(0, 'rgba(16,28,29,.17)');
    grime.addColorStop(.12, 'rgba(16,28,29,0)');
    grime.addColorStop(.82, 'rgba(16,28,29,0)');
    grime.addColorStop(1, 'rgba(16,28,29,.12)');
    color.fillStyle = grime; color.fillRect(x, y, 256, 256);
    color.strokeStyle = '#707d7c'; color.lineWidth = 5;
    color.strokeRect(x + 3, y + 3, 250, 250);
    color.strokeStyle = '#f3f0df'; color.lineWidth = 1.4;
    color.strokeRect(x + 8, y + 8, 239, 239);
    height.fillStyle = '#929292'; height.fillRect(x + 6, y + 6, 244, 244);
    height.strokeStyle = '#606060'; height.lineWidth = 4;
    height.strokeRect(x + 3, y + 3, 250, 250);

    for (const dx of [18, 238]) for (const dy of [18, 238]) {
      color.fillStyle = '#6a7775'; color.beginPath(); color.arc(x + dx, y + dy, 4.3, 0, Math.PI * 2); color.fill();
      color.fillStyle = '#e5e9de'; color.beginPath(); color.arc(x + dx - 1, y + dy - 1, 2.2, 0, Math.PI * 2); color.fill();
      color.strokeStyle = '#546260'; color.lineWidth = 1.2;
      color.beginPath(); color.moveTo(x + dx - 2, y + dy); color.lineTo(x + dx + 2, y + dy); color.stroke();
      height.fillStyle = '#b7b7b7'; height.beginPath(); height.arc(x + dx, y + dy, 3.5, 0, Math.PI * 2); height.fill();
    }

    // Small maintenance language becomes visible only when a visitor gets close.
    color.fillStyle = '#a2aaa2'; color.font = '600 12px sans-serif';
    color.fillText(`PFC / ${String(470 + id).padStart(4, '0')}`, x + 30, y + 45);
    color.font = '8px sans-serif'; color.fillText('PRESSURE SHELL • INSPECTION A', x + 30, y + 59);
    color.fillStyle = '#b2b6a8'; color.fillRect(x + 31, y + 70, 31, 3);
    color.fillStyle = '#949f98'; color.fillRect(x + 65, y + 70, 8, 3);
    if (id % 3 === 0) {
      color.fillStyle = '#d1be88'; color.fillRect(x + 28, y + 191, 94, 17);
      color.save(); color.beginPath(); color.rect(x + 28, y + 191, 94, 17); color.clip();
      color.fillStyle = '#79816e';
      for (let i = -1; i < 8; i++) {
        const bx = x + 28 + i * 19;
        color.beginPath(); color.moveTo(bx, y + 191); color.lineTo(bx + 9, y + 191);
        color.lineTo(bx - 3, y + 208); color.lineTo(bx - 12, y + 208); color.fill();
      }
      color.restore();
      color.fillStyle = '#96a098'; color.font = '8px sans-serif'; color.fillText('ISOLATE BEFORE SERVICE', x + 28, y + 221);
    } else {
      color.fillStyle = '#89958e'; color.fillRect(x + 29, y + 184, 98, 2);
      color.font = '8px sans-serif'; color.fillText('NO STEP / 2.4 BAR', x + 29, y + 200);
      color.fillStyle = '#9ca69a';
      for (let i = 0; i < 20; i++) color.fillRect(x + 29 + i * 4, y + 211, i % 3 ? 1 : 2, 10);
    }
    if (id % 2 === 0) {
      // An inset inspection cover: baked bevels and a small louver grille.
      color.fillStyle = '#a2aca6'; color.fillRect(x + 149, y + 122, 76, 97);
      color.strokeStyle = '#7c8984'; color.lineWidth = 2; color.strokeRect(x + 149, y + 122, 76, 97);
      color.strokeStyle = '#eef0df'; color.lineWidth = 1; color.strokeRect(x + 152, y + 125, 70, 91);
      height.fillStyle = '#737373'; height.fillRect(x + 150, y + 123, 74, 95);
      for (let line = 0; line < 8; line++) {
        color.fillStyle = '#6f817b'; color.fillRect(x + 159, y + 138 + line * 8, 55, 3);
        color.fillStyle = '#d6dacb'; color.fillRect(x + 159, y + 141 + line * 8, 55, 1);
        height.fillStyle = '#555555'; height.fillRect(x + 159, y + 138 + line * 8, 55, 2);
      }
    }
  }

  // Brushed machining, paint scratches, and dust remain mip-filtered in the distance.
  for (let i = 0; i < 4400; i++) {
    const x = random() * size, y = random() * size;
    color.strokeStyle = i % 3 ? 'rgba(26,49,46,.035)' : 'rgba(255,252,229,.1)';
    color.lineWidth = .4 + random() * .7;
    color.beginPath(); color.moveTo(x, y); color.lineTo(x + 1 + random() * 36, y + random() * .4); color.stroke();
  }
  const albedo = new THREE.CanvasTexture(colorCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.anisotropy = 4;

  // Pack the baked relief into a normal map; no animated displacement or extra geometry.
  const heights = height.getImageData(0, 0, size, size).data;
  const normalPixels = height.createImageData(size, size);
  const output = normalPixels.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const offset = (y * size + x) * 4;
    const left = heights[(y * size + (x + size - 1) % size) * 4];
    const right = heights[(y * size + (x + 1) % size) * 4];
    const up = heights[(((y + size - 1) % size) * size + x) * 4];
    const down = heights[(((y + 1) % size) * size + x) * 4];
    const nx = (left - right) / 85, ny = (down - up) / 85;
    const length = Math.hypot(nx, ny, 1);
    output[offset] = (nx / length * .5 + .5) * 255;
    output[offset + 1] = (ny / length * .5 + .5) * 255;
    output[offset + 2] = (.5 / length + .5) * 255;
    output[offset + 3] = 255;
  }
  height.putImageData(normalPixels, 0, 0);
  const normal = new THREE.CanvasTexture(heightCanvas);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.anisotropy = 4;
  surfaceLibrary = {albedo, normal, dispose() {albedo.dispose(); normal.dispose(); surfaceLibrary = undefined;}};
  return surfaceLibrary;
}

/** Stable metre-scaled UVs for stretched, instanced architectural boxes. */
export function applyIndustrialSurface(material, {relief = true, scale = .125} = {}) {
  const surfaces = createSurfaceLibrary();
  material.map = surfaces.albedo;
  if (relief) {
    material.normalMap = surfaces.normal;
    material.normalScale = new THREE.Vector2(.3, .3);
  }
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `
      #include <worldpos_vertex>
      vec4 pfcWorld = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        pfcWorld = instanceMatrix * pfcWorld;
      #endif
      pfcWorld = modelMatrix * pfcWorld;
      vec3 pfcAxis = abs(inverseTransformDirection(transformedNormal, viewMatrix));
      vec2 pfcUv = pfcAxis.y > max(pfcAxis.x, pfcAxis.z) ? pfcWorld.xz
        : (pfcAxis.x > pfcAxis.z ? pfcWorld.zy : pfcWorld.xy);
      vMapUv = pfcUv * ${scale.toFixed(5)};
      #ifdef USE_NORMALMAP
        vNormalMapUv = pfcUv * ${scale.toFixed(5)};
      #endif
    `);
    // Reuse the existing albedo sample for wear roughness: no extra texture lookup.
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (.7 - sampledDiffuseColor.r) * .16, .35, 1.0);
    `);
  };
  material.customProgramCacheKey = () => `pfc-industrial-surface-v1-${scale}-${relief}`;
  material.needsUpdate = true;
  return material;
}
