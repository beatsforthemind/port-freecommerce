import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * A quiet pressure-shell conservatory. The small entrance opens into a fan,
 * then an unbroken, gently rising floor delivers visitors to the curved glass.
 * Navigation surfaces describe the very same clipped polygons as the deck.
 */
export function buildObservationDistrict({box, solid, footprint: registerFootprint, sign, mesh, decal, m}) {
  const pale = new THREE.MeshStandardMaterial({color: '#b7c3b8', roughness: .78, metalness: .22});
  const deck = new THREE.MeshStandardMaterial({color: '#4c6263', roughness: .82, metalness: .22});
  const vault = new THREE.MeshStandardMaterial({color: '#203238', roughness: .85, metalness: .32, side: THREE.DoubleSide});
  const custom = new Map();
  let triangles = 0;
  let boxCount = 0;
  let signCount = 0;
  let customDraws = 0;

  const b = (...args) => { box(...args); boxCount++; triangles += 12; };
  const s = (...args) => { solid(...args); boxCount++; triangles += 12; };
  const title = (...args) => { sign(...args); signCount++; triangles += 2; };
  function add(geometry, material) {
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    if (plain !== geometry) geometry.dispose();
    plain.deleteAttribute('uv');
    if (!custom.has(material)) custom.set(material, []);
    custom.get(material).push(plain);
  }
  function quad(points, material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    add(geometry, material);
  }
  function clip(poly, boundary, keepLess) {
    const result = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], next = poly[(i + 1) % poly.length];
      const insideA = keepLess ? a[0] <= boundary : a[0] >= boundary;
      const insideB = keepLess ? next[0] <= boundary : next[0] >= boundary;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const t = (boundary - a[0]) / (next[0] - a[0]);
        result.push([boundary, a[1] + (next[1] - a[1]) * t]);
      }
    }
    return result;
  }
  const height = x => x <= 64 ? 0 : x >= 80 ? 2.8 : (x - 64) / 16 * 2.8;
  function floor(poly) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(poly.flatMap(([x,z]) => [x, height(x), z]), 3));
    geometry.setIndex(THREE.ShapeUtils.triangulateShape(poly.map(([x,z]) => new THREE.Vector2(x,z)), []).flat());
    geometry.computeVertexNormals();
    if (geometry.attributes.normal.getY(0) < 0) {
      const index = geometry.index;
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i); index.setX(i, index.getX(i + 2)); index.setX(i + 2, a);
      }
      geometry.computeVertexNormals();
    }
    add(geometry, deck);
  }
  function tube(points, radius, material) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(curve, 12, radius, 6, false), material);
  }

  const arc = [];
  for (let i = 0; i <= 12; i++) {
    const angle = -Math.PI / 2 + i / 12 * Math.PI;
    arc.push([74 + Math.cos(angle) * 30, -20 + Math.sin(angle) * 28]);
  }
  const footprint = [[32,-28],[49,-38], ...arc, [49,-2],[32,-12]];
  const low = clip(footprint, 64, true);
  const incline = clip(clip(footprint, 64, false), 80, true);
  const upper = clip(footprint, 80, false);
  floor(low); floor(incline); floor(upper);
  // The structural fascia follows the irregular boundary instead of wrapping
  // the experience in another rectangular room.
  for (let i = 0; i < footprint.length - 1; i++) {
    const a = footprint[i], c = footprint[i + 1];
    quad([[a[0],-.45,a[1]], [c[0],-.45,c[1]], [c[0],height(c[0]),c[1]], [a[0],height(a[0]),a[1]]], m.wall);
  }

  // Compressed, acoustically sheltered vestibule; the view appears only after
  // the shell starts to flare, then the planet becomes the room's focal point.
  for (const z of [-28, -12]) {
    s(m.dark, 36.5, 3.3, z, 9, 6.6, .65);
    b(pale, 33.1, 3.1, z, .45, 6.2, .85);
    b(m.soft, 36.5, .24, z + (z < -20 ? .43 : -.43), 8.8, .08, .06);
  }
  b(m.dark, 36.5, 6.45, -20, 9, .4, 16.5);
  title('OBSERVATION  /  QUIET DECK', 35.1, 5.1, -20, 12.5, .85, -Math.PI / 2, '#c7d6c6', '#23383d');

  // The rear fan edges shelter reading alcoves. Low warm strips are embedded
  // in pale stonework while the broad vault remains intentionally unlit.
  const sideChains = [[[32,-28],[49,-38],[74,-48]], [[32,-12],[49,-2],[74,8]]];
  for (const chain of sideChains) {
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i], c = chain[i + 1];
      const dx = c[0] - a[0], dz = c[1] - a[1], length = Math.hypot(dx,dz);
      const x = (a[0] + c[0]) / 2, z = (a[1] + c[1]) / 2;
      const yaw = -Math.atan2(dz,dx);
      b(pale, x, height(x) + 1.3, z, length, .17, .78, yaw);
      b(m.soft, x, height(x) + .24, z, length, .06, .73, yaw);
    }
  }

  // Nine structural petals spread from one low point into the curved glazing.
  // Roof panels and ribs are each merged into a material batch, not separate
  // scene nodes for every strip of the vaulted ceiling.
  const rays = [];
  for (let i = 0; i <= 8; i++) {
    const angle = -Math.PI / 2 + i / 8 * Math.PI;
    const end = [74 + Math.cos(angle) * 30, 23.5 - Math.abs(Math.sin(angle)) * 4, -20 + Math.sin(angle) * 28];
    const side = Math.sin(angle);
    const path = [
      [32,6.6,-20 + 8 * side],
      [40.5,10.2,-20 + 13 * side],
      [49,15,-20 + 18 * side],
      [49 + (end[0] - 49) * .25,22 + Math.cos(angle) * 1.8,-20 + 20.5 * side],
      [49 + (end[0] - 49) * .5,25 + Math.cos(angle) * 2,-20 + 23 * side],
      [49 + (end[0] - 49) * .75,23.5 + Math.cos(angle) * 2,-20 + 25.5 * side],
      end,
    ];
    rays.push(path); tube(path.map(([x,y,z]) => [x,y - .35,z]), .22, pale);
  }
  for (let i = 0; i < rays.length - 1; i++) for (let j = 0; j < 6; j++) {
    quad([rays[i][j], rays[i][j + 1], rays[i + 1][j + 1], rays[i + 1][j]], vault);
  }
  for (const [side,edge] of [rays[0],rays[rays.length - 1]].entries()) {
    for (let j = 0; j < edge.length - 1; j++) {
      const a = edge[j], c = edge[j + 1];
      const panel = [[a[0],height(a[0]),a[2]],[c[0],height(c[0]),c[2]],c,a];
      quad(side ? panel.reverse() : panel,m.wall);
    }
  }

  // Panoramic curved glass, slender vertical frames, and low perimeter ledges.
  for (let i = 0; i < arc.length - 1; i++) {
    const a = arc[i], c = arc[i + 1];
    const angleA = -Math.PI / 2 + i / 12 * Math.PI;
    const angleC = -Math.PI / 2 + (i + 1) / 12 * Math.PI;
    const topA = 23.5 - Math.abs(Math.sin(angleA)) * 4;
    const topC = 23.5 - Math.abs(Math.sin(angleC)) * 4;
    quad([[a[0],height(a[0]) + 1.05,a[1]], [c[0],height(c[0]) + 1.05,c[1]], [c[0],topC,c[1]], [a[0],topA,a[1]]], m.glass);
    const dx = c[0] - a[0], dz = c[1] - a[1], length = Math.hypot(dx,dz);
    const x = (a[0] + c[0]) / 2, z = (a[1] + c[1]) / 2, yaw = -Math.atan2(dz,dx);
    quad([[a[0],height(a[0]),a[1]],[c[0],height(c[0]),c[1]],[c[0],height(c[0]) + 1,c[1]],[a[0],height(a[0]) + 1,a[1]]],m.dark);
    tube([[a[0],height(a[0]) + 1.05,a[1]],[x,height(x) + 1.05,z],[c[0],height(c[0]) + 1.05,c[1]]],.09,pale);
    tube([[a[0],height(a[0]) + 1.14,a[1]],[x,height(x) + 1.14,z],[c[0],height(c[0]) + 1.14,c[1]]],.025,m.soft);
    b(pale, a[0], (height(a[0]) + topA) / 2, a[1], .3, topA - height(a[0]), .3);
    tube([[a[0],topA,a[1]], [x,(topA + topC) / 2,z], [c[0],topC,c[1]]], .18, pale);
  }
  const last = arc[arc.length - 1];
  b(pale, last[0], (19.5 + height(last[0])) / 2, last[1], .3, 19.5 - height(last[0]), .3);

  // Floor joints trace the rise toward the window. The central ramp is broad
  // and unobstructed, with no step edges or inaccessible decorative staircases.
  for (const x of [44, 56, 64, 72, 80, 88]) {
    const zHalf = x < 49 ? 10.5 : x < 64 ? 17.5 : 22;
    b(pale, x, height(x) + .018, -20, .045, .025, zHalf * 2);
  }
  for (const z of [-26, -14]) {
    tube([[42,.035,z],[62,.035,z],[72,1.435,z],[82,2.835,z],[95,2.835,z]], .025, m.soft);
  }

  function seat(x,z,w,d,y) {
    // Keep the existing solid footprint while fitting an adult seated pose.
    b(m.dark, x,y + .2,z,w,.4,d);
    registerFootprint(x,y + .38,z,w,.76,d);
    b(pale, x,y + .43,z,w,.06,d);
    b(m.sage, x,y + .49,z,w - .16,.12,d - .16);
    b(pale, x - w / 2 + .1,y + .92,z,.16,.75,d);
    b(m.dark, x,y + .15,z,w - .2,.09,d + .1);
  }
  seat(47,-33,5.7,1.7,0);
  seat(46,-6.5,5.7,1.7,0);
  seat(84.7,-39,1.8,6.4,2.8);
  seat(84.7,-1,1.8,6.4,2.8);
  for (const [x,z] of [[47,-35.1],[46,-4.4],[82.8,-39],[82.8,-1]]) {
    const y = height(x);
    b(pale,x,y + 2.5,z,.19,5,.75);
    b(m.soft,x + .13,y + 2.5,z,.025,3.6,.45);
  }
  title('NOTHING REQUIRED OF YOU HERE', 45, 3.5, -35.2, 8.3, .56, .5317, '#bacab8', '#294046');
  title('PELAGOS  /  UPPER CLOUDS', 86, 6.3, -44.8, 10, .75, -.38, '#c6d3c3', '#263d42');

  // Optical stations offer a smaller scale of discovery below the vast view.
  for (const z of [-32,-8]) {
    s(m.dark,94,3.35,z,1.25,1.1,1.5);
    b(pale,94,4.15,z,.24,.85,.24);
    b(m.dark,94.5,4.55,z,1.45,.42,.7);
    b(m.soft,95.25,4.55,z,.04,.28,.48);
    b(pale,94.5,4.78,z,1.5,.07,.77);
    decal(5,93.35,4.1,z,1.1,.65,-Math.PI / 2);
  }
  // An orbital compass belongs on the level viewing terrace, beyond the ramp.
  const compass = new THREE.RingGeometry(4.9,4.97,64);
  compass.rotateX(-Math.PI / 2); compass.translate(89,2.825,-20); add(compass,pale);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    b(pale,89 + Math.sin(a) * 4.65,2.83,-20 + Math.cos(a) * 4.65,.04,.025,.34,a);
  }

  // The gas giant is retained from the original station, at the same position.
  // Fewer tessellation bands keep the new architecture within the former view's
  // geometry budget while preserving the planet silhouette and band shader.
  const planetMaterial = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vN;varying vec2 vUv;void main(){vN=normalize(normal);vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vN;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){float n=noise(vUv*vec2(17.,29.));float bands=sin(vUv.y*91.+n*5.+sin(vUv.x*22.)*.4)*.5+.5;float fine=sin(vUv.y*320.+n*3.)*.045;
      vec3 c=mix(vec3(.24,.34,.34),vec3(.65,.66,.53),bands*.65+n*.35)+fine;
      float lighting=max(dot(normalize(vN),normalize(vec3(-.8,.65,.35))),0.);c*=.07+pow(lighting,.65)*1.05;
      float rim=pow(1.-abs(dot(normalize(vN),vec3(-1.,0.,0.))),3.);gl_FragColor=vec4(c+vec3(.09,.16,.17)*rim,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const planetGeometry = new THREE.SphereGeometry(45,48,32);
  triangles += planetGeometry.index.count / 3;
  const planet = mesh(planetGeometry,planetMaterial,188,55,-20);
  const ringsMaterial = new THREE.ShaderMaterial({
    transparent:true,side:THREE.DoubleSide,depthWrite:false,
    vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 vP;void main(){float r=length(vP.xy);float a=(sin(r*4.8)*.12+.2)+(sin(r*.91)*.16);a*=smoothstep(54.,59.,r)*(1.-smoothstep(78.,83.,r));gl_FragColor=vec4(mix(vec3(.38,.41,.35),vec3(.7,.63,.44),sin(r*1.3)*.5+.5),max(0.,a));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const rings = new THREE.RingGeometry(54,83,128,3);
  triangles += rings.index.count / 3;
  mesh(rings,ringsMaterial,188,55,-20,[Math.PI / 2 - .28,.12,-.23]);
  const stars = new Float32Array(700 * 3);
  let seed = 72;
  const random = () => {seed = seed * 16807 % 2147483647;return (seed - 1) / 2147483646;};
  for (let i = 0; i < 700; i++) {
    stars[i * 3] = 42 + random() * 220;
    stars[i * 3 + 1] = -155 + random() * 320;
    stars[i * 3 + 2] = -300 + random() * 580;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position',new THREE.BufferAttribute(stars,3));
  planet.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#c9d7d0',size:.65,sizeAttenuation:true,fog:false})));

  for (const [material,pieces] of custom) {
    const geometry = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    if (!geometry) throw new Error('Unable to batch observatory shell geometry.');
    geometry.computeBoundingSphere();
    const object = mesh(geometry,material,0,0,0);
    object.name = 'Observation conservatory / merged architecture';
    customDraws++;
  }

  // The navigation lip overlaps the concourse by one metre; visible floor
  // begins at x32 where the existing concourse's floor ends.
  const entryLow = [...low,[31,-12],[31,-28]];
  return {
    id:'observation',
    surfaces:[
      {polygon:entryLow,height:0},
      {polygon:incline,minX:64,maxX:80,minZ:-48,maxZ:8,axis:'x',start:64,end:80,from:0,to:2.8},
      {polygon:upper,height:2.8},
    ],
    spawn:{position:[75,3.675,-20],yaw:-Math.PI / 2},
    landmarks:[
      {x:94,z:-32,y:2.8,radius:3.1,code:'PFC—029A / OPTICAL ARRAY',title:'A weather report from another scale.',text:['The pale bands are ammonia cloud decks. The darker lanes are gaps into layers below. Nothing about the pattern is permanent.','A storm has crossed the visible hemisphere since the last arrival cycle. At this distance, it looks almost restful.']},
      {x:49,z:-31,y:0,radius:3.1,code:'PFC—029B / QUIET DECK',title:'Permission to stop.',text:['This gallery was built for waiting without a queue. Seats are public. No purchase, ticket, or explanation is required.','The long ramp rises to the panoramic terrace. The way back remains open.']},
    ],
    routes:[
      [[38,-20],[46,-24],[58,-23],[62,-20],[58,-17],[49,-19],[38,-20]],
      [[82,-25],[87,-28],[92,-25],[95,-20],[92,-15],[87,-12],[82,-15],[82,-25]],
      [[42,-25],[60,-25],[76,-26],[86,-28],[94,-24],[96,-20],[94,-16],[86,-12],[76,-14],[60,-20],[42,-25]],
    ],
    stats:{triangles,points:700,boxCount,customDrawCalls:customDraws + 3,signDrawCalls:signCount,newTextures:signCount,lights:0,maximumRise:2.8,footprint:'faceted fan with a curved panoramic edge'},
  };
}
