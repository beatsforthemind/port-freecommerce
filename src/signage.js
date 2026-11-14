import * as THREE from 'three';

const SHEET_WIDTH = 2048;
const GUTTER = 4;
// The smallest texture limit a WebGL 2 device may have is 2048. The sheet is
// taller than that at full density, so it is drawn smaller where it must be.
const DEFAULT_LIMIT = 4096;
/** Sheet pixels per metre of sign, until a sign reaches the widest tile. */
const DENSITY = 120;
// Two of the widest tiles and their gutters fill one shelf of the sheet.
const MAX_TILE = (SHEET_WIDTH - 3 * GUTTER) / 2, MIN_TILE = 96;
const FACE = '"Space Grotesk", sans-serif';
const scratchColor = new THREE.Color();
const scratchMatrix = new THREE.Matrix4();
const scratchEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const scratchPoint = new THREE.Vector3();

const TURNED = {'←': '→', '→': '←', '↖': '↗', '↗': '↖', '↙': '↘', '↘': '↙'};
/**
 * What a sign says on its reverse. The words are the same; an arrow that
 * points along the sign is turned, so that from behind it still points at the
 * same place.
 */
function reverseOf(text) { return text.replace(/[←→↖↗↙↘]/g, arrow => TURNED[arrow]); }

/** A colour as the display-space numbers a 2D canvas would have composited with. */
function encoded(style, target, offset) {
  scratchColor.set(style).convertLinearToSRGB();
  target[offset] = scratchColor.r; target[offset + 1] = scratchColor.g; target[offset + 2] = scratchColor.b;
}

/**
 * Lettering is stored as coverage and coloured per sign. Ink and backing are
 * mixed in display space, exactly as a canvas would have composited them, and
 * unbacked lettering takes its alpha from coverage alone, so its edges carry
 * no dark fringe. Seen from behind, a sign mirrors its own tile and still
 * reads left to right.
 */
function signMaterial(backed) {
  const material = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide, transparent: !backed, depthWrite: backed,
    // Signs sit a few centimetres proud of their backing panels. The bias is constant: one scaled by
    // slope moves a sign in depth with the viewing angle, into a halo or trim just in front of it.
    polygonOffset: true, polygonOffsetUnits: -2,
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = `attribute vec3 signInk;\nattribute vec3 signPaper;\nattribute vec3 signReverse;\nvarying vec3 vSignInk;\nvarying vec3 vSignPaper;\nvarying vec3 vSignReverse;\n${shader.vertexShader}`
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vSignInk = signInk;\n  vSignPaper = signPaper;\n  vSignReverse = signReverse;');
    shader.fragmentShader = `varying vec3 vSignInk;\nvarying vec3 vSignPaper;\nvarying vec3 vSignReverse;
      vec3 signToLinear( vec3 c ) { return mix( pow( c * 0.9478672986 + 0.0521327014, vec3( 2.4 ) ), c * 0.0773993808, vec3( lessThanEqual( c, vec3( 0.04045 ) ) ) ); }
      ${shader.fragmentShader}`.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        // A transparent two-sided material is drawn as a back pass then a front
        // pass. The back pass flips the winding, so gl_FrontFacing is true
        // there; FLIP_SIDED is what identifies it.
        // The reverse face mirrors its tile, and may have a tile of its own.
        vec2 signBehind = vec2( vSignReverse.x - vMapUv.x, vMapUv.y ) + vSignReverse.yz;
        #ifdef FLIP_SIDED
          vec2 signUv = signBehind;
        #else
          vec2 signUv = gl_FrontFacing ? vMapUv : signBehind;
        #endif
        float signCoverage = texture2D( map, signUv ).r;
        ${backed
          ? 'diffuseColor.rgb *= signToLinear( mix( vSignPaper, vSignInk, signCoverage ) );'
          : 'diffuseColor.rgb *= signToLinear( vSignInk );\n        diffuseColor.a *= signCoverage;'}
      #endif`);
  };
  material.customProgramCacheKey = () => `pfc-signage-v2-${backed ? 'backed' : 'open'}`;
  return material;
}

/**
 * Every lettered sign in the station is a quad on one shared sheet, merged
 * into one backed and one unbacked draw per layer. The sheet is a single
 * channel, and identical lettering is rasterised once whatever its colours.
 *
 * Signs are added while the station is built; `build()` then packs and draws
 * the sheet. A layer is a group the caller can keep, to show or hide its signs
 * together.
 */
export function createSignage({maxSize = DEFAULT_LIMIT} = {}) {
  const limit = Math.max(1024, Math.min(8192, Math.floor(maxSize) || DEFAULT_LIMIT));
  const sheetWidth = Math.min(SHEET_WIDTH, limit);
  const group = new THREE.Group();
  group.name = 'Signage / shared lettering sheet';
  const layers = new Map(), tiles = new Map(), sprites = [];
  const materials = {backed: signMaterial(true), open: signMaterial(false)};
  const geometries = [];
  let sheet = null, built = false, disposed = false, signCount = 0;

  function layerFor(name) {
    let layer = layers.get(name);
    if (!layer) {
      layer = {group: new THREE.Group(), backed: [], open: []};
      layer.group.name = `Signage / ${name}`;
      layers.set(name, layer); group.add(layer.group);
    }
    return layer;
  }

  /**
   * Two type conventions are kept so existing signs look as they did.
   * With `size`, type is sized against the sign's width (the figure is pixels
   * on a 1024-wide sheet) and an over-long line is condensed to fit. Without
   * it, type fills 63% of the sign's height and shrinks to fit its width.
   */
  function tileFor(text, width, height, {size = null, scale = 100, align = 'center', density = DENSITY}) {
    if (built) throw new Error('Signage is already built; add signs before build().');
    const w = Math.min(MAX_TILE, Math.max(MIN_TILE, Math.round(width * density)));
    const h = Math.max(24, Math.round(w * height / width));
    const key = [text, w, h, size ?? `fill ${scale}`, align].join('\u0001');
    let tile = tiles.get(key);
    if (!tile) tiles.set(key, tile = {text, w, h, fullWidth: w, fullHeight: h, size, scale, align, x: 0, y: 0});
    return tile;
  }

  function draw(ctx, tile) {
    ctx.save();
    ctx.beginPath(); ctx.rect(tile.x, tile.y, tile.w, tile.h); ctx.clip();
    ctx.translate(tile.x, tile.y);
    ctx.textBaseline = 'middle';
    if (tile.size !== null) {
      const unit = tile.w / 1024;
      // Very wide signs once had a sheet no shorter than 64 rows, which
      // pressed their type slightly flat. The proportion is kept.
      const pressed = Math.min(1, 1024 * tile.h / tile.w / 64);
      ctx.font = `600 ${tile.size * unit}px ${FACE}`;
      ctx.textAlign = tile.align;
      ctx.translate(tile.align === 'center' ? tile.w / 2 : 48 * unit, tile.h / 2);
      ctx.scale(1, pressed);
      ctx.fillText(tile.text, 0, 0, 944 * unit);
    } else {
      let size = tile.h * .63 * tile.scale / 100;
      ctx.font = `600 ${size}px ${FACE}`;
      const measured = ctx.measureText(tile.text).width;
      if (measured > tile.w * .94) {
        size *= tile.w * .94 / measured;
        ctx.font = `600 ${size}px ${FACE}`;
      }
      ctx.textAlign = 'center';
      ctx.fillText(tile.text, tile.w / 2, tile.h / 2);
    }
    ctx.restore();
  }

  /** Tallest first, left to right in shelves. Returns the sheet height. */
  function pack() {
    let x = GUTTER, y = GUTTER, shelf = 0;
    for (const tile of [...tiles.values()].sort((a, b) => b.h - a.h || b.w - a.w)) {
      if (x + tile.w + GUTTER > sheetWidth) { x = GUTTER; y += shelf + GUTTER; shelf = 0; }
      tile.x = x; tile.y = y; x += tile.w + GUTTER; shelf = Math.max(shelf, tile.h);
    }
    return Math.max(4, Math.ceil((y + shelf + GUTTER) / 4) * 4);
  }
  /** Pack at full density; if the sheet would exceed the device's limit, draw every tile smaller until it fits. */
  function fit() {
    let height = pack();
    for (let shrink = 1; height > limit && shrink > .2;) {
      shrink *= Math.min(.95, Math.sqrt(limit / height) * .98);
      const widest = (sheetWidth - 3 * GUTTER) / 2;
      for (const tile of tiles.values()) {
        tile.w = Math.max(16, Math.min(widest, Math.round(tile.fullWidth * shrink)));
        tile.h = Math.max(8, Math.round(tile.fullHeight * shrink));
      }
      height = pack();
    }
    return height;
  }

  function rasterise() {
    const height = fit();
    const canvas = document.createElement('canvas');
    canvas.width = sheetWidth; canvas.height = height;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, sheetWidth, height);
    ctx.fillStyle = '#fff';
    for (const tile of tiles.values()) draw(ctx, tile);
    const pixels = ctx.getImageData(0, 0, sheetWidth, height).data;
    const coverage = new Uint8Array(sheetWidth * height);
    for (let i = 0, j = 0; i < coverage.length; i++, j += 4) coverage[i] = pixels[j];
    // The canvas has done its work; only the single channel is kept.
    canvas.width = canvas.height = 0;
    const texture = new THREE.DataTexture(coverage, sheetWidth, height, THREE.RedFormat, THREE.UnsignedByteType);
    texture.name = 'Signage / lettering coverage';
    texture.colorSpace = THREE.NoColorSpace;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }

  /** Row 0 of the sheet is its top row, so v grows downwards. */
  function quads(items) {
    const count = items.length;
    const position = new Float32Array(count * 12), uv = new Float32Array(count * 8);
    const ink = new Float32Array(count * 12), paper = new Float32Array(count * 12), reverse = new Float32Array(count * 12);
    const index = new (count * 4 > 65535 ? Uint32Array : Uint16Array)(count * 6);
    const width = sheet.image.width, height = sheet.image.height;
    items.forEach((item, n) => {
      const {tile} = item, behind = item.reverse || tile;
      const u0 = (tile.x + .5) / width, u1 = (tile.x + tile.w - .5) / width;
      const top = (tile.y + .5) / height, bottom = (tile.y + tile.h - .5) / height;
      scratchEuler.set(item.pitch, item.yaw, 0);
      scratchMatrix.makeRotationFromEuler(scratchEuler).setPosition(item.x, item.y, item.z);
      const corners = [[-.5, .5, u0, top], [.5, .5, u1, top], [-.5, -.5, u0, bottom], [.5, -.5, u1, bottom]];
      corners.forEach(([px, py, u, v], corner) => {
        const vertex = n * 4 + corner;
        scratchPoint.set(px * item.width, py * item.height, 0).applyMatrix4(scratchMatrix);
        scratchPoint.toArray(position, vertex * 3);
        uv[vertex * 2] = u; uv[vertex * 2 + 1] = v;
        encoded(item.color, ink, vertex * 3);
        if (item.background) encoded(item.background, paper, vertex * 3);
        // Mirror about the tile's own centre, then step to the reverse tile if there is one.
        reverse.set([u0 + u1, (behind.x - tile.x) / width, (behind.y - tile.y) / height], vertex * 3);
      });
      index.set([0, 2, 1, 2, 3, 1].map(corner => n * 4 + corner), n * 6);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setAttribute('signInk', new THREE.BufferAttribute(ink, 3));
    geometry.setAttribute('signPaper', new THREE.BufferAttribute(paper, 3));
    geometry.setAttribute('signReverse', new THREE.BufferAttribute(reverse, 3));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    geometries.push(geometry);
    return geometry;
  }

  return {
    group,
    /**
     * Add a fixed sign. `x, y, z` is its centre in the world; `yaw` turns it
     * about the vertical and `pitch` tips it (a floor marking is -90 degrees).
     * A null `background` leaves the lettering unbacked. Seen from behind, a
     * sign reads left to right with its arrows turned to match. Returns the
     * layer's group.
     */
    add(text, {x = 0, y = 0, z = 0, width, height, yaw = 0, pitch = 0, color = '#e6e2cf', background = '#172329', layer = 'concourse', ...type}) {
      const target = layerFor(layer), unbacked = !background || background === 'transparent';
      const tile = tileFor(text, width, height, type), behind = reverseOf(text);
      (unbacked ? target.open : target.backed).push({tile, reverse: behind === text ? null : tileFor(behind, width, height, type), x, y, z, width, height, yaw, pitch, color, background: unbacked ? null : background});
      signCount++;
      return target.group;
    },
    /**
     * A sign the caller moves each frame, such as a marker that faces the eye.
     * It shares the sheet but is its own draw; add it to the scene yourself.
     */
    sprite(text, {width, height, color = '#e6e2cf', background = null, ...type}) {
      const unbacked = !background || background === 'transparent';
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), unbacked ? materials.open : materials.backed);
      mesh.name = `Signage / marker ${text}`;
      // Unbacked lettering blends after glazing and other see-through layers.
      if (unbacked) mesh.renderOrder = 1;
      sprites.push({mesh, item: {tile: tileFor(text, width, height, type), x: 0, y: 0, z: 0, width, height, yaw: 0, pitch: 0, color, background: unbacked ? null : background}});
      signCount++;
      return mesh;
    },
    /** Pack and draw the sheet, then turn every layer into at most two draws. */
    build() {
      if (built || disposed) return;
      built = true;
      if (!tiles.size) return;
      sheet = rasterise();
      materials.backed.map = materials.open.map = sheet;
      for (const [name, layer] of layers) for (const kind of ['backed', 'open']) {
        if (!layer[kind].length) continue;
        const mesh = new THREE.Mesh(quads(layer[kind]), materials[kind]);
        mesh.name = `Signage / ${name} / ${kind === 'backed' ? 'backed signs' : 'unbacked lettering'}`;
        mesh.matrixAutoUpdate = false;
        if (kind === 'open') mesh.renderOrder = 1;
        layer.group.add(mesh);
      }
      for (const sprite of sprites) {
        sprite.mesh.geometry.dispose();
        sprite.mesh.geometry = quads([sprite.item]);
      }
    },
    get stats() {
      const draws = [...layers.values()].reduce((sum, layer) => sum + (layer.backed.length > 0) + (layer.open.length > 0), 0) + sprites.length;
      return {signs: signCount, tiles: tiles.size, layers: layers.size, drawCalls: draws, textures: sheet ? 1 : 0,
        sheet: sheet ? `${sheet.image.width}x${sheet.image.height}` : null, sheetBytes: sheet ? sheet.image.data.length : 0,
        tilePixels: [...tiles.values()].reduce((sum, tile) => sum + tile.w * tile.h, 0)};
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const sprite of sprites) { sprite.mesh.removeFromParent(); sprite.mesh.geometry.dispose(); }
      geometries.forEach(geometry => geometry.dispose());
      materials.backed.dispose(); materials.open.dispose(); sheet?.dispose();
      group.removeFromParent(); group.clear();
      layers.clear(); tiles.clear(); sprites.length = geometries.length = 0;
    },
  };
}
