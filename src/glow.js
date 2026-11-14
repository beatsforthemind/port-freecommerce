import * as THREE from 'three';

const MAX_SEGMENT = 12;

/**
 * Fixture glow without a bloom pass. Light strips get a camera-facing halo,
 * lit panels get a soft card, and floors get an additive pool where a fixture
 * would light them. Builders register shapes; build() bakes two instanced
 * draws. Nothing is uploaded per frame, and nothing here is a real light.
 */
export function createGlow() {
  const beams = [], cards = [];
  const color = new THREE.Color();
  const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  const axis = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let built = false;

  // Halos are added in display space, so their colours are display-referred.
  function tint(value, strength) {
    color.set(value).convertLinearToSRGB();
    return [color.r * strength, color.g * strength, color.b * strength];
  }

  const api = {
    /** A halo along the segment a→b. Long runs are split so each part fades by its own distance. */
    beam(a, b, radius, value, strength = 1, caps = true) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const parts = Math.max(1, Math.ceil(length / MAX_SEGMENT)), rgb = tint(value, strength);
      for (let i = 0; i < parts; i++) {
        const t0 = i / parts, t1 = (i + 1) / parts;
        beams.push({
          a: a.map((v, k) => v + (b[k] - v) * t0), b: a.map((v, k) => v + (b[k] - v) * t1),
          // Joints inside a run, or around a closed ring, carry no caps: they would double up.
          radius, capA: caps && i === 0 ? 1 : 0, capB: caps && i === parts - 1 ? 1 : 0, rgb,
        });
      }
    },
    /** A round halo for a lamp or lantern. */
    point(p, radius, value, strength = 1) { api.beam(p, p, radius, value, strength); },
    /**
     * A soft-edged card in the plane of u and v, extending `radius` beyond the
     * lit rectangle. `core` is how much lands on the rectangle itself: a lit
     * panel is already bright and only needs its surround, a pool is all core.
     */
    card(center, u, v, halfU, halfV, radius, value, strength = 1, core = .15, lift = Math.min(.35, radius * .4)) {
      // `lift` floats the card clear of mullions and trim around the panel, so
      // the surround spills over them as light would instead of being cut.
      cards.push({center: [...center], u: [...u], v: [...v], halfU, halfV, radius, core, lift, rgb: tint(value, strength)});
    },
    /** Light falling on a floor: a round pool, or a rounded strip with half-extents along x and z. */
    pool(x, y, z, radius, value, strength = 1, halfX = 0, halfZ = 0) {
      api.card([x, y + .03, z], [1, 0, 0], [0, 0, 1], halfX, halfZ, radius, value, strength, 1, .04);
    },
    /** Classify an emissive box by its proportions: strips become beams, panels become cards. */
    box(matrix, value, {strip = .5, panel = .3} = {}) {
      matrix.decompose(position, quaternion, scale);
      const size = [Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)];
      axis[0].set(1, 0, 0).applyQuaternion(quaternion); axis[1].set(0, 1, 0).applyQuaternion(quaternion); axis[2].set(0, 0, 1).applyQuaternion(quaternion);
      const order = [0, 1, 2].sort((p, q) => size[q] - size[p]), [long, mid, thin] = order;
      if (size[long] >= 2.4 && size[mid] <= .62) {
        const half = size[long] / 2, d = axis[long];
        api.beam(
          [position.x - d.x * half, position.y - d.y * half, position.z - d.z * half],
          [position.x + d.x * half, position.y + d.y * half, position.z + d.z * half],
          Math.max(.32, Math.min(1, size[mid] * 1.2 + .28)), value, strip);
        return 'beam';
      }
      if (size[long] >= 1.2 && size[mid] >= .9 && size[thin] <= .3) {
        api.card(position.toArray(), axis[long].toArray(), axis[mid].toArray(), size[long] / 2, size[mid] / 2, Math.max(.45, Math.min(1.1, size[mid] * .35)), value, panel);
        return 'card';
      }
      return null;
    },
    get counts() { return {beams: beams.length, cards: cards.length}; },
    build() {
      if (built) throw new Error('Station glow is already built.');
      built = true;
      const group = new THREE.Group();
      group.name = 'Fixture glow / halos and light pools';
      const fog = {value: 0};
      const resources = [];
      const shared = {transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: {uFog: fog}};
      const attribute = (geometry, name, data, size) => geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(data), size));

      if (beams.length) {
        const geometry = new THREE.InstancedBufferGeometry();
        // (which end, which side, cap direction): two end caps around a ribbon, with a
        // centre line along the strip so the ribbon can fold there (see the float below).
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([0,-1,-1, 0,0,-1, 0,1,-1, 0,-1,0, 0,0,0, 0,1,0, 1,-1,0, 1,0,0, 1,1,0, 1,-1,1, 1,0,1, 1,1,1], 3));
        geometry.setIndex([0,1,3, 3,1,4, 1,2,4, 4,2,5, 3,4,6, 6,4,7, 4,5,7, 7,5,8, 6,7,9, 9,7,10, 7,8,10, 10,8,11]);
        attribute(geometry, 'aA', beams.flatMap(b => b.a), 3);
        attribute(geometry, 'aB', beams.flatMap(b => b.b), 3);
        attribute(geometry, 'aShape', beams.flatMap(b => [b.radius, b.capA, b.capB]), 3);
        attribute(geometry, 'aColor', beams.flatMap(b => b.rgb), 3);
        geometry.instanceCount = beams.length;
        const material = new THREE.ShaderMaterial({
          ...shared,
          vertexShader: `
            attribute vec3 aA; attribute vec3 aB; attribute vec3 aShape; attribute vec3 aColor;
            uniform float uFog;
            varying vec2 vUv; varying vec3 vColor;
            void main() {
              vec3 base = mix(aA, aB, position.x);
              vec3 toCamera = cameraPosition - base;
              float range = max(length(toCamera), .001);
              toCamera /= range;
              vec3 axis = aB - aA;
              float span = length(axis);
              axis = span > .0001 ? axis / span : vec3(0., 1., 0.);
              vec3 across = cross(axis, toCamera);
              float facing = length(across);
              // Seen end-on, or a point source: any direction across the view gives a round halo.
              across = facing > .001 ? across / facing : normalize(cross(toCamera, vec3(.37, .91, .19)));
              vec3 along = normalize(cross(toCamera, across));
              // Distant fixtures keep a visible halo, as a screen-space bloom would give them.
              float radius = aShape.x * (1. + range * .006);
              float cap = position.z < 0. ? aShape.y : aShape.z;
              vec3 world = base + across * position.y * radius + along * position.z * cap * radius;
              // Float clear of the mounting surface so the halo is not sliced by it. The rim floats half as far
              // again as the strip: a flat ribbon facing the eye lies in the plane of any face that also faces
              // the eye, and where it floated into one the two fought over the whole overlap.
              float rim = min(1., length(vec2(position.y, position.z * cap)));
              world += toCamera * min(radius * .8, range * .5) * (1. + .5 * rim);
              vUv = position.zy;
              vColor = aColor * exp(-uFog * uFog * range * range) * smoothstep(.25, 1.4, range);
              gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
            }`,
          fragmentShader: `
            varying vec2 vUv; varying vec3 vColor;
            void main() {
              float glow = max(0., 1. - length(vUv));
              glow = glow * glow * (.4 + .6 * glow);
              gl_FragColor = vec4(vColor * glow, 1.);
            }`,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'Fixture glow / strip halos';
        mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 3;
        group.add(mesh); resources.push(geometry, material);
      }

      if (cards.length) {
        const geometry = new THREE.InstancedBufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0], 3));
        geometry.setIndex([0,1,2, 0,2,3]);
        attribute(geometry, 'aCenter', cards.flatMap(c => c.center), 3);
        attribute(geometry, 'aU', cards.flatMap(c => c.u), 3);
        attribute(geometry, 'aV', cards.flatMap(c => c.v), 3);
        attribute(geometry, 'aExtent', cards.flatMap(c => [c.halfU, c.halfV, c.radius, c.core]), 4);
        attribute(geometry, 'aColor', cards.flatMap(c => [...c.rgb, c.lift]), 4);
        geometry.instanceCount = cards.length;
        const material = new THREE.ShaderMaterial({
          // Pushed two depth steps back, never pulled forward: a card is lifted clear of its panel, so what lies
          // within a step of it is trim in front (a service trunk before a window), which must keep the card behind it.
          ...shared, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetUnits: 2,
          vertexShader: `
            attribute vec3 aCenter; attribute vec3 aU; attribute vec3 aV; attribute vec4 aExtent; attribute vec4 aColor;
            uniform float uFog;
            varying vec2 vP; varying vec4 vExtent; varying vec3 vColor;
            void main() {
              vec2 reach = aExtent.xy + aExtent.z;
              vec3 world = aCenter + aU * position.x * reach.x + aV * position.y * reach.y;
              vec3 toCamera = cameraPosition - aCenter;
              float range = length(toCamera);
              vec3 normal = normalize(cross(aU, aV));
              // Sit proud of the lit surface, on whichever side is being viewed.
              world += normal * (dot(normal, toCamera) < 0. ? -aColor.w : aColor.w);
              vP = position.xy * reach; vExtent = aExtent;
              vColor = aColor.rgb * exp(-uFog * uFog * range * range);
              gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
            }`,
          fragmentShader: `
            varying vec2 vP; varying vec4 vExtent; varying vec3 vColor;
            void main() {
              vec2 outside = abs(vP) - vExtent.xy;
              float d = length(max(outside, 0.)) / max(vExtent.z, .001);
              float glow = max(0., 1. - d);
              glow = glow * glow * (3. - 2. * glow);
              // Ease from the surround down to the core level just inside the edge.
              float inset = clamp(-max(outside.x, outside.y) / .35, 0., 1.);
              glow *= mix(1., vExtent.w, inset);
              gl_FragColor = vec4(vColor * glow, 1.);
            }`,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'Fixture glow / panel cards and floor pools';
        mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 3;
        group.add(mesh); resources.push(geometry, material);
      }

      let disposed = false;
      const stats = Object.freeze({beams: beams.length, cards: cards.length, drawCalls: group.children.length, triangles: beams.length * 12 + cards.length * 2, textures: 0, lights: 0, perFrameUploads: 0});
      return {
        group, stats,
        /** Halos thin out with the same fog as the room they are in. */
        update(fogDensity) { fog.value = fogDensity; },
        dispose() { if (disposed) return; disposed = true; resources.forEach(resource => resource.dispose()); group.clear(); },
      };
    },
  };
  return api;
}
