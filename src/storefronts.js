import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const VARIANTS = 4, TILE_W = 768, TILE_H = 384;

/**
 * Deck-level shop windows. A lit pane with nothing behind it reads as a blank
 * panel, so each window shows one of four backlit interiors: silhouettes
 * against the glow, which is how a lit shop looks from a dim hall. One shared
 * sheet, one draw; the mullions in front are real geometry.
 */
export function createStorefrontDisplays(windows) {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_W * 2; canvas.height = TILE_H * 2;
  const ctx = canvas.getContext('2d');
  let seed = 9173;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const ink = alpha => `rgba(58,42,30,${alpha})`;
  const shelf = y => { ctx.fillStyle = ink(.82); ctx.fillRect(18, y, TILE_W - 36, 7); };
  const box = (x, y, w, h, alpha = .78) => { ctx.fillStyle = ink(alpha); ctx.fillRect(x, y - h, w, h); };
  const jar = (x, y, w, h, alpha = .74) => {
    ctx.fillStyle = ink(alpha);
    ctx.beginPath(); ctx.roundRect(x, y - h, w, h, [w * .35, w * .35, 2, 2]); ctx.fill();
    ctx.fillRect(x + w * .3, y - h - 7, w * .4, 9);
  };
  for (let variant = 0; variant < VARIANTS; variant++) {
    ctx.save();
    ctx.translate(variant % 2 * TILE_W, Math.floor(variant / 2) * TILE_H);
    ctx.beginPath(); ctx.rect(0, 0, TILE_W, TILE_H); ctx.clip();
    // The lit back wall: brightest at lamp height, warmer and dimmer below.
    const wall = ctx.createLinearGradient(0, 0, 0, TILE_H);
    wall.addColorStop(0, '#f6e6c8'); wall.addColorStop(.45, '#fbeed4'); wall.addColorStop(1, '#dcbd92');
    ctx.fillStyle = wall; ctx.fillRect(0, 0, TILE_W, TILE_H);
    const lamp = ctx.createRadialGradient(TILE_W * (.3 + variant * .13), 70, 10, TILE_W * (.3 + variant * .13), 70, 330);
    lamp.addColorStop(0, 'rgba(255,250,236,.75)'); lamp.addColorStop(1, 'rgba(255,250,236,0)');
    ctx.fillStyle = lamp; ctx.fillRect(0, 0, TILE_W, TILE_H);
    ctx.fillStyle = 'rgba(120,92,60,.16)';
    for (let x = 96; x < TILE_W; x += 96) ctx.fillRect(x, 0, 2, TILE_H);
    if (variant === 0) {
      // Provisions: jars and boxes on three shelves.
      for (const y of [126, 236, 346]) {
        shelf(y);
        for (let x = 30; x < TILE_W - 50;) {
          const w = 16 + random() * 26, h = 30 + random() * 52;
          if (random() > .35) jar(x, y, w, h, .58 + random() * .3); else box(x, y, w * 1.5, h * .7, .55 + random() * .3);
          x += w * 1.5 + 8 + random() * 22;
        }
      }
    } else if (variant === 1) {
      // Garments on a rail, with a fitting form.
      ctx.fillStyle = ink(.85); ctx.fillRect(40, 58, TILE_W - 260, 6);
      for (let x = 70; x < TILE_W - 250; x += 46 + random() * 26) {
        const w = 38 + random() * 26, h = 150 + random() * 90;
        ctx.fillStyle = ink(.5 + random() * .35);
        ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x + w * .5, 78); ctx.lineTo(x + w, 64 + h); ctx.lineTo(x - w * .35, 64 + h); ctx.lineTo(x - w * .5, 78); ctx.closePath(); ctx.fill();
      }
      const fx = TILE_W - 150;
      ctx.fillStyle = ink(.8);
      ctx.beginPath(); ctx.ellipse(fx, 104, 20, 25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(fx - 56, 140); ctx.lineTo(fx + 56, 140); ctx.lineTo(fx + 38, 300); ctx.lineTo(fx - 38, 300); ctx.closePath(); ctx.fill();
      ctx.fillRect(fx - 4, 300, 8, 84); ctx.fillRect(fx - 40, 376, 80, 8);
    } else if (variant === 2) {
      // Parts and tools on a pegboard above a bench.
      for (let i = 0; i < 26; i++) {
        const x = 40 + random() * (TILE_W - 80), y = 30 + random() * 190, r = 9 + random() * 24;
        ctx.strokeStyle = ink(.5 + random() * .35); ctx.lineWidth = 3 + random() * 5;
        ctx.beginPath();
        if (i % 3 === 0) ctx.arc(x, y, r, 0, Math.PI * 2); else { ctx.moveTo(x, y); ctx.lineTo(x + (random() - .5) * 14, y + r * 2.4); }
        ctx.stroke();
      }
      box(0, TILE_H, TILE_W, 110, .86);
      for (let x = 30; x < TILE_W - 60; x += 70 + random() * 60) box(x, TILE_H - 110, 34 + random() * 50, 18 + random() * 46, .7);
    } else {
      // A counter, a clerk and a notice board.
      box(0, TILE_H, TILE_W, 120, .86);
      const px = TILE_W * .62;
      ctx.fillStyle = ink(.82);
      ctx.beginPath(); ctx.ellipse(px, 150, 21, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px - 62, 264); ctx.quadraticCurveTo(px - 58, 184, px, 180); ctx.quadraticCurveTo(px + 58, 184, px + 62, 264); ctx.closePath(); ctx.fill();
      ctx.fillStyle = ink(.34); ctx.fillRect(70, 60, 230, 150);
      ctx.fillStyle = ink(.6);
      for (let row = 0; row < 5; row++) ctx.fillRect(88, 80 + row * 25, 110 + random() * 80, 7);
      for (let x = 60; x < 360; x += 44 + random() * 30) jar(x, TILE_H - 120, 18 + random() * 14, 26 + random() * 30, .7);
    }
    // Reflections of the hall on the glass, strongest toward the top.
    const sheen = ctx.createLinearGradient(0, 0, TILE_W, TILE_H);
    sheen.addColorStop(0, 'rgba(210,232,226,.20)'); sheen.addColorStop(.4, 'rgba(210,232,226,0)'); sheen.addColorStop(.62, 'rgba(210,232,226,.09)'); sheen.addColorStop(1, 'rgba(210,232,226,0)');
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, TILE_W, TILE_H);
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const transform = new THREE.Object3D(), pieces = [];
  windows.forEach(({x, y, z, width, height, facing}, index) => {
    const geometry = new THREE.PlaneGeometry(width, height), uv = geometry.attributes.uv;
    const variant = (index * 7 + (facing > 0 ? 1 : 0)) % VARIANTS, u0 = variant % 2 / 2, v0 = 1 - (Math.floor(variant / 2) + 1) / 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (.004 + uv.getX(i) * .992) / 2, v0 + (.006 + uv.getY(i) * .988) / 2);
    transform.position.set(x, y, z); transform.rotation.set(0, facing > 0 ? Math.PI / 2 : -Math.PI / 2, 0); transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix); pieces.push(geometry);
  });
  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  // The pictures lie 1 cm in front of the lit panes (world.js), too close to hold from 130 m away.
  // A constant depth bias, not one scaled by slope, keeps them in front without reaching the mullions.
  const material = new THREE.MeshBasicMaterial({map: texture, polygonOffset: true, polygonOffsetUnits: -2});
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Concourse / backlit shop windows';
  mesh.matrixAutoUpdate = false;
  return {mesh, stats: {windows: windows.length, drawCalls: 1, textures: 1, atlas: `${canvas.width}x${canvas.height}`}};
}
