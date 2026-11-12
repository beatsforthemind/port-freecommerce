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
  return material;
}

/**
 * A two-sided sign reads mirrored from behind. Flip the texture on back faces
 * so hanging and free-standing lettering is legible from either side.
 */
export function readableFromBothSides(material) {
  material.side = THREE.DoubleSide;
  material.onBeforeCompile = shader => {
    // A transparent two-sided material is drawn as a back pass then a front
    // pass. The back pass flips the winding, so gl_FrontFacing is true there;
    // FLIP_SIDED is what identifies it.
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        #ifdef FLIP_SIDED
          vec2 pfcSignUv = vec2( 1.0 - vMapUv.x, vMapUv.y );
        #else
          vec2 pfcSignUv = gl_FrontFacing ? vMapUv : vec2( 1.0 - vMapUv.x, vMapUv.y );
        #endif
        vec4 sampledDiffuseColor = texture2D( map, pfcSignUv );
        diffuseColor *= sampledDiffuseColor;
      #endif`);
  };
  material.customProgramCacheKey = () => 'pfc-sign-readable-both-sides-v2';
  return material;
}

/**
 * Glazing with presence. Face-on it stays nearly clear; toward a grazing
 * angle it picks up a pale sheen and turns more opaque, as glass does. No
 * environment lookup: one dot product on a material that was already blended.
 */
export function applyGlassSheen(material, {sheen = '#a9c3bf', edge = .4} = {}) {
  const tint = new THREE.Color(sheen);
  material.onBeforeCompile = shader => {
    shader.uniforms.pfcSheen = {value: tint};
    shader.uniforms.pfcEdge = {value: edge};
    shader.vertexShader = `varying vec3 vPfcNormal;\nvarying vec3 vPfcView;\n${shader.vertexShader}`.replace('#include <project_vertex>', `
      #include <project_vertex>
      vec3 pfcNormal = normal;
      #ifdef USE_INSTANCING
        mat3 pfcInstance = mat3( instanceMatrix );
        pfcNormal /= vec3( dot( pfcInstance[ 0 ], pfcInstance[ 0 ] ), dot( pfcInstance[ 1 ], pfcInstance[ 1 ] ), dot( pfcInstance[ 2 ], pfcInstance[ 2 ] ) );
        pfcNormal = pfcInstance * pfcNormal;
      #endif
      vPfcNormal = normalMatrix * pfcNormal;
      vPfcView = - mvPosition.xyz;`);
    shader.fragmentShader = `uniform vec3 pfcSheen;\nuniform float pfcEdge;\nvarying vec3 vPfcNormal;\nvarying vec3 vPfcView;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `
      #include <color_fragment>
      float pfcGraze = pow( 1.0 - abs( dot( normalize( vPfcNormal ), normalize( vPfcView ) ) ), 3.0 );
      diffuseColor.rgb = mix( diffuseColor.rgb, pfcSheen, pfcGraze );
      diffuseColor.a = mix( diffuseColor.a, pfcEdge, pfcGraze );`);
  };
  material.customProgramCacheKey = () => 'pfc-glass-sheen-v1';
  return material;
}

export function label(text, {width = 6, height = 1, color = '#f1d5a0', background = '#131e22', fontSize = 100, tracking = 0} = {}) {
  const canvas = document.createElement('canvas');
  // Resolution follows the sign's physical size: a half-metre marker does not
  // need the same megapixel sheet as a twelve-metre fascia.
  canvas.width = Math.min(1024, Math.max(128, Math.ceil(width * 360 / 64) * 64));
  canvas.height = Math.max(32, Math.round(canvas.width * height / width));
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
  texture.anisotropy = 4;
  // A backed sign is solid: it belongs in the opaque pass and writes depth.
  const solid = Boolean(background) && background !== 'transparent';
  const material = readableFromBothSides(new THREE.MeshBasicMaterial({map: texture, transparent: !solid, depthWrite: solid}));
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}
