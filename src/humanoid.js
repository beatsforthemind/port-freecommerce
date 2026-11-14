import * as THREE from 'three';

/** Shared, deliberately restrained character language; factories own no caches. */
export const HUMAN_PALETTE = Object.freeze({
  coats: ['#526563','#8b705b','#7d8181','#a09278','#4d5968','#796268','#a87351','#536054'],
  trousers: ['#333e43','#43484a','#4c4e49','#384744'],
  skin: ['#c9a58e','#bb8b6b','#a57656','#82583f','#674534','#49332c','#bf957c'],
  hair: ['#1d1b1a','#2f241d','#46362a','#5f4a36','#6e452e','#63615d','#8f8c84','#7e6744'],
  trim: ['#b4ad96','#766f60','#363d3e','#8d9b8c'],
  // Close-fitting layers worn under a vest or an open jacket.
  under: ['#3a4449','#8e968d','#5b6059','#2f3639','#a39a86'],
  // Station issue: the amber of the deck markings, and the pale and teal of its signs.
  signal: ['#c48a3f','#b7bea6','#6f9a96'],
});

export const HUMAN_PROFILE = Object.freeze({
  height: 1.78, headY: 1.65, headScale: Object.freeze([.105,.13,.115]),
  torsoY: 1.17, torsoScale: Object.freeze([.49,.55,.29]),
  shoulderY: 1.38, hipY: .88,
});

/**
 * Skin a stack of rings (each a loop of [x, y, z], lowest first) and close both ends.
 * Vertices are shared and normals averaged, so a handful of rings reads as a rounded form.
 */
function skin(rings, colors) {
  const sides=rings[0].length,positions=[],indices=[];
  for(const ring of rings)for(const point of ring)positions.push(point[0],point[1],point[2]);
  for(let ring=0;ring<rings.length-1;ring++)for(let i=0;i<sides;i++) {
    const a=ring*sides+i,b=ring*sides+(i+1)%sides,c=a+sides,d=b+sides;
    indices.push(a,d,c,a,b,d);
  }
  for(const [ring,top] of [[0,false],[rings.length-1,true]])for(let i=1;i<sides-1;i++) {
    const first=ring*sides;
    if(top)indices.push(first,first+i,first+i+1);else indices.push(first,first+i+1,first+i);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  if(colors)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

// The head in units of its half-size: [height, half-width, centre depth, half-depth], chin to crown.
// The face slopes back gently from brow to chin, and the skull base tucks in toward the neck.
const HEAD_RINGS=[
  [-1,.24,.34,.2],[-.88,.43,.32,.38],[-.6,.63,.14,.6],[-.34,.71,.04,.74],[-.12,.75,0,.82],
  [.08,.78,-.02,.86],[.28,.81,-.04,.9],[.55,.8,-.06,.9],[.8,.71,-.08,.8],[.95,.47,-.08,.53],[1,.2,-.08,.22],
];
const HEAD_SIDES=12;
function headSection(y) {
  let i=1;
  while(i<HEAD_RINGS.length-1&&HEAD_RINGS[i][0]<y)i++;
  const a=HEAD_RINGS[i-1],b=HEAD_RINGS[i],t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0])));
  return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t];
}

/**
 * A bare head within ±1; scale by HUMAN_PROFILE.headScale. Column 0 faces forward (+z).
 * It has a brow, a nose, ears and a jaw, and no eyes or mouth: the sockets are a shallow,
 * slightly shaded recess, as a face reads in soft overhead light.
 */
export function createHumanHeadGeometry() {
  const rings=[],colors=[];
  for(const [y,width,centre,depth] of HEAD_RINGS) {
    const ring=[];
    for(let i=0;i<HEAD_SIDES;i++) {
      const angle=i*Math.PI*2/HEAD_SIDES,column=Math.min(i,HEAD_SIDES-i);
      let x=Math.sin(angle)*width,z=centre+Math.cos(angle)*depth,shade=1;
      if(column===0) {
        // Bridge, tip and base of the nose, and the faintest fullness at the mouth.
        z+=y===.08?.05:y===-.12?.2:y===-.34?.06:y===-.6?.02:y===.28?.04:0;
        if(y===-.34)shade=.9;
      } else if(column===1) {
        if(y===.08){z-=.1;shade=.72;}
        else if(y===.28)z+=.045;
        else if(y===-.12)z-=.015;
      } else if(column===2) {
        if(y===.08)shade=.9;
        else if(y===-.6)x*=.95;
      } else if(column===3) {
        // Ears: a soft swelling on the two side columns.
        if(y===.08||y===-.12){x*=1.12;z-=.05;shade=.94;}
        else if(y===-.6)x*=.94;
      }
      // The underside of the jaw sits in the collar's shade.
      if(y===-1)shade=.78;else if(y===-.88&&column>2)shade=.86;
      ring.push([x,y,z]);colors.push(shade,shade,shade);
    }
    rings.push(ring);
  }
  return skin(rings,colors);
}

/**
 * Hair, a cap or a helmet shell that fits the head above: same units, same placement.
 * The hairline is swept a little to one side at the front, passes over the ears and drops
 * to the nape. It is left faceted, so it reads as cut hair against the smooth skin.
 * Scale it up a few per cent for fuller hair, more for a hood or a hard shell.
 */
export function createHumanHairGeometry() {
  const hairline=[.5,.4,.12,-.06,-.34,-.44,-.46,-.44,-.34,-.06,.16,.56];
  const positions=[0,1.055,-.08],indices=[];
  // Each row: how far down toward the hairline, how far the hair stands off the scalp, and its lift.
  const rows=[[.12,1.08,.035],[.4,1.09,.03],[.72,1.08,.015],[1,1.07,0],[1.02,.94,0]];
  for(const [t,swell,lift] of rows)for(let i=0;i<HEAD_SIDES;i++) {
    const angle=i*Math.PI*2/HEAD_SIDES,y=1-t*(1-hairline[i]),[width,centre,depth]=headSection(y);
    const back=Math.cos(angle)<0?1.02:1;
    positions.push(Math.sin(angle)*width*swell,y+lift,centre+Math.cos(angle)*depth*swell*back);
  }
  for(let i=0;i<HEAD_SIDES;i++)indices.push(0,1+i,1+(i+1)%HEAD_SIDES);
  for(let row=0;row<rows.length-1;row++)for(let i=0;i<HEAD_SIDES;i++) {
    const a=1+row*HEAD_SIDES+i,b=1+row*HEAD_SIDES+(i+1)%HEAD_SIDES,c=a+HEAD_SIDES,d=b+HEAD_SIDES;
    indices.push(a,c,d,a,d,b);
  }
  const source=new THREE.BufferGeometry();
  source.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  source.setIndex(indices);
  const geometry=source.toNonIndexed();source.dispose();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

/** Unit-height upper garment: flared hem, waist, chest, sloped shoulders and a neck opening. */
export function createHumanTorsoGeometry() {
  const sides=10,rings=[];
  for(const [y,width,depth,offset] of [[-.5,.36,.4,0],[-.47,.41,.47,0],[-.2,.385,.445,0],[.1,.47,.5,.012],[.3,.5,.47,.005],[.42,.455,.4,-.012],[.5,.24,.31,-.02]]) {
    const ring=[];
    for(let i=0;i<sides;i++) {
      // A rounded rectangle: fuller at the corners than an ellipse, as a ribcage is.
      const angle=(i+.5)*Math.PI*2/sides,s=Math.sin(angle),c=Math.cos(angle);
      ring.push([Math.sign(s)*Math.abs(s)**.77*width,y,Math.sign(c)*Math.abs(c)**.77*depth+offset]);
    }
    rings.push(ring);
  }
  return skin(rings);
}

/**
 * Unit-height limb, wider at the top, with both ends closed and eased. It also serves as a
 * neck, a collar, a hand, a boot upper, a belt and a strap, by scale alone.
 */
export function createHumanLimbGeometry() {
  const sides=6,rings=[];
  for(const [y,radius] of [[-.5,.26],[-.44,.39],[.42,.5],[.5,.33]]) {
    const ring=[];
    for(let i=0;i<sides;i++) {
      const angle=(i+.5)*Math.PI*2/sides;
      // Stretched so that the six-sided section fills the same width and depth.
      ring.push([Math.sin(angle)*radius,y,Math.cos(angle)*radius/Math.cos(Math.PI/sides)]);
    }
    rings.push(ring);
  }
  return skin(rings);
}
