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

/**
 * A printed sheet laid out as a grid of tiles reads mirrored from behind.
 * Flip each tile about its own centre on back faces, so cloth, boards and
 * screens read left to right from either side. Not for sheets with arrows:
 * a turned arrow would point the wrong way.
 */
export function readableTiles(material, columns) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec2 tileUv = vMapUv;
        #ifdef FLIP_SIDED
          bool tileBehind = true;
        #else
          bool tileBehind = ! gl_FrontFacing;
        #endif
        if ( tileBehind ) tileUv.x = ( 2.0 * floor( vMapUv.x * ${columns}.0 ) + 1.0 ) / ${columns}.0 - vMapUv.x;
        diffuseColor *= texture2D( map, tileUv );
      #endif`);
  };
  material.customProgramCacheKey = () => `pfc-readable-tiles-${columns}`;
  return material;
}
