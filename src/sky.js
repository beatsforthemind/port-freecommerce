import * as THREE from 'three';

/** Where the system's star is. Everything outside the hull is lit from here. */
export const SUN_DIRECTION = Object.freeze(new THREE.Vector3(-.8, .65, .35).normalize());

// Offsets from the eye, not positions in the station. Pelagos keeps the size
// and bearing it has from the observation terrace; the moon keeps the place it
// holds in the north aperture and above the docks.
const PELAGOS = Object.freeze({offset: [102, 50.45, 0], radius: 45, ringInner: 54, ringOuter: 83});
const MOON = Object.freeze({offset: [-75, 135, -800], radius: 285});
/** Where Pelagos hangs: a broad, pale lamp on whatever faces east. */
export const PELAGOS_DIRECTION = Object.freeze(new THREE.Vector3(...PELAGOS.offset).normalize());

/**
 * One sky for the whole station: stars, the ringed giant Pelagos to the east
 * and its large moon to the north. The group follows the eye, so the bodies
 * sit at infinity: no parallax as you walk, and the same sky from every
 * window. They draw first and never touch depth, so the station always covers
 * them; the rings hide behind the planet by a ray test instead.
 */
export function createSky() {
  const group = new THREE.Group();
  group.name = 'Sky / stars, Pelagos and its moon';
  const resources = [];
  const track = value => { resources.push(value); return value; };
  const behind = {depthTest: false, depthWrite: false, fog: false};
  let seed = 4417;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const STARS = 2200, starPositions = new Float32Array(STARS * 3), starColors = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    const a = random() * Math.PI * 2, u = random() * 2 - 1, r = Math.sqrt(1 - u * u);
    starPositions.set([Math.cos(a) * r * 900, u * 900, Math.sin(a) * r * 900], i * 3);
    // Mostly faint, a few bright, with a slight spread between cool and warm.
    const level = .22 + Math.pow(random(), 3) * .78, warm = random();
    starColors.set([level * (.86 + warm * .14), level * .93, level * (1 - warm * .16)], i * 3);
  }
  const starGeometry = track(new THREE.BufferGeometry());
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const stars = new THREE.Points(starGeometry, track(new THREE.PointsMaterial({size: 1.7, sizeAttenuation: false, vertexColors: true, ...behind})));
  stars.name = 'Sky / stars'; stars.renderOrder = -30; stars.frustumCulled = false;
  group.add(stars);

  // The moon: broad maria, old soft basins and a dusting of small craters.
  // Detail is kept fine and low in contrast; at this size anything bolder
  // reads as a drawing of a moon rather than a surface.
  const canvas = document.createElement('canvas');
  const W = 1536, H = 768;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8b918b'; ctx.fillRect(0, 0, W, H);
  const wrapped = (x, draw) => { for (const shift of [-W, 0, W]) draw(x + shift); };
  for (let i = 0; i < 70; i++) {
    const x = random() * W, y = H * .1 + random() * H * .8, r = 50 + random() * 230, dark = random() > .35;
    wrapped(x, cx => {
      const patch = ctx.createRadialGradient(cx, y, r * .1, cx, y, r);
      patch.addColorStop(0, dark ? `rgba(52,60,60,${.1 + random() * .16})` : `rgba(196,202,192,${.05 + random() * .08})`);
      patch.addColorStop(1, dark ? 'rgba(52,60,60,0)' : 'rgba(196,202,192,0)');
      ctx.fillStyle = patch; ctx.fillRect(cx - r, y - r, r * 2, r * 2);
    });
  }
  for (let i = 0; i < 2600; i++) {
    // Mostly a pixel or two across; a rare crater reaches a dozen.
    const x = random() * W, y = 8 + random() * (H - 16), r = .8 + Math.pow(random(), 5) * 13, floor = .05 + random() * .09, rim = .07 + random() * .1;
    wrapped(x, cx => {
      if (cx < -20 || cx > W + 20) return;
      ctx.fillStyle = `rgba(44,52,52,${floor})`;
      ctx.beginPath(); ctx.arc(cx, y, r, 0, Math.PI * 2); ctx.fill();
      if (r < 2.2) return;
      // The sunward wall catches light, the far wall holds shadow.
      ctx.lineWidth = Math.max(.6, r * .11);
      ctx.strokeStyle = `rgba(206,212,200,${rim})`;
      ctx.beginPath(); ctx.arc(cx, y, r, Math.PI * .8, Math.PI * 1.7); ctx.stroke();
      ctx.strokeStyle = `rgba(30,38,38,${rim * .8})`;
      ctx.beginPath(); ctx.arc(cx, y, r, -Math.PI * .2, Math.PI * .7); ctx.stroke();
    });
  }
  for (let i = 0; i < 16000; i++) {
    ctx.fillStyle = `rgba(${random() > .5 ? '214,218,208' : '34,42,42'},${random() * .05})`;
    ctx.fillRect(random() * W, random() * H, 1 + random() * 2, 1 + random() * 2);
  }
  const moonMap = track(new THREE.CanvasTexture(canvas));
  moonMap.colorSpace = THREE.SRGBColorSpace; moonMap.wrapS = THREE.RepeatWrapping; moonMap.anisotropy = 4;
  const lit = {uSun: {value: SUN_DIRECTION}};
  const output = '#include <tonemapping_fragment>\n#include <colorspace_fragment>';
  const bodyVertex = 'varying vec3 vN;varying vec2 vUv;void main(){vN=normalize(mat3(modelMatrix)*normal);vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';

  const moon = new THREE.Mesh(track(new THREE.SphereGeometry(MOON.radius, 64, 40)), track(new THREE.ShaderMaterial({
    ...behind, uniforms: {...lit, uMap: {value: moonMap}},
    vertexShader: bodyVertex,
    fragmentShader: `uniform sampler2D uMap;uniform vec3 uSun;varying vec3 vN;varying vec2 vUv;
      void main(){
        vec3 n=normalize(vN);
        vec3 surface=texture2D(uMap,vUv).rgb*vec3(.7,.76,.75);
        float light=max(dot(n,uSun),0.);
        // A soft terminator, and a little of the giant's light on the night side.
        vec3 c=surface*(.035+pow(light,.75)*1.05)+vec3(.012,.02,.022)*(1.-light);
        gl_FragColor=vec4(c,1.);
        ${output}
      }`,
  })));
  moon.name = 'Sky / moon'; moon.position.set(...MOON.offset); moon.rotation.set(.18, 2.2, -.22); moon.renderOrder = -20;
  group.add(moon);

  const pelagos = new THREE.Mesh(track(new THREE.SphereGeometry(PELAGOS.radius, 48, 32)), track(new THREE.ShaderMaterial({
    ...behind, uniforms: lit,
    vertexShader: bodyVertex,
    fragmentShader: `uniform vec3 uSun;varying vec3 vN;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){float n=noise(vUv*vec2(17.,29.));float bands=sin(vUv.y*91.+n*5.+sin(vUv.x*22.)*.4)*.5+.5;float fine=sin(vUv.y*320.+n*3.)*.045;
      vec3 c=mix(vec3(.24,.34,.34),vec3(.65,.66,.53),bands*.65+n*.35)+fine;
      float lighting=max(dot(normalize(vN),uSun),0.);c*=.07+pow(lighting,.65)*1.05;
      float rim=pow(1.-abs(dot(normalize(vN),vec3(-1.,0.,0.))),3.);gl_FragColor=vec4(c+vec3(.09,.16,.17)*rim,1.);
      ${output}
      }`,
  })));
  pelagos.name = 'Sky / Pelagos'; pelagos.position.set(...PELAGOS.offset); pelagos.renderOrder = -19;
  // The cloud pattern is not periodic, so the sphere has a seam where it wraps.
  // The sky never turns relative to the eye: keep that seam on the far side.
  pelagos.rotation.y = Math.PI;
  group.add(pelagos);

  // The rings blend over the planet without a depth buffer: a fragment is
  // dropped when the sight line to it passes through the planet first.
  const rings = new THREE.Mesh(track(new THREE.RingGeometry(PELAGOS.ringInner, PELAGOS.ringOuter, 128, 3)), track(new THREE.ShaderMaterial({
    ...behind, side: THREE.DoubleSide,
    // Blended, but kept in the opaque pass so it draws before the station.
    transparent: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {uCentre: {value: new THREE.Vector3(...PELAGOS.offset)}, uRadius: {value: PELAGOS.radius}},
    vertexShader: 'varying vec3 vP;varying vec3 vEye;void main(){vP=position;vec4 world=modelMatrix*vec4(position,1.);vEye=world.xyz-cameraPosition;gl_Position=projectionMatrix*viewMatrix*world;}',
    fragmentShader: `uniform vec3 uCentre;uniform float uRadius;varying vec3 vP;varying vec3 vEye;
      void main(){
        float range=length(vEye);vec3 ray=vEye/range;
        float along=dot(uCentre,ray);float miss=dot(uCentre,uCentre)-along*along;
        if(along>0.&&miss<uRadius*uRadius&&along-sqrt(uRadius*uRadius-miss)<range)discard;
        float r=length(vP.xy);float a=(sin(r*4.8)*.12+.2)+(sin(r*.91)*.16);a*=smoothstep(54.,59.,r)*(1.-smoothstep(78.,83.,r));
        gl_FragColor=vec4(mix(vec3(.38,.41,.35),vec3(.7,.63,.44),sin(r*1.3)*.5+.5),pow(max(0.,a),.4545));
        ${output}
      }`,
  })));
  rings.name = 'Sky / rings of Pelagos'; rings.position.set(...PELAGOS.offset); rings.rotation.set(Math.PI / 2 - .28, .12, -.23); rings.renderOrder = -18;
  group.add(rings);

  let disposed = false;
  return {
    group,
    stats: Object.freeze({stars: STARS, bodies: 2, drawCalls: 4, textures: 1, parallax: 'none: bodies follow the eye'}),
    /** Keep the sky centred on the eye. This is placement, not animation. */
    follow(camera) { group.position.copy(camera.position); },
    dispose() { if (disposed) return; disposed = true; resources.forEach(resource => resource.dispose()); group.clear(); },
  };
}
