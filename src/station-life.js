import * as THREE from 'three';

/** Analytic bounds for every transform in the machine vertex shader below. */
function shaderMotionBounds(geometry) {
  const bounds=new THREE.Box3(),point=new THREE.Vector3();
  const p=geometry.attributes.position,anchors=geometry.attributes.aAnchor,kinds=geometry.attributes.aKind;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),kind=kinds.getX(i);
    let x0=x,x1=x,y0=y,y1=y,z0=z,z1=z;
    if(kind<.5) { /* Static infrastructure. */ }
    else if(kind<1.5) {
      // mod(...,280)-155 covers [-155,125), independent of car phase.
      z0-=155;z1+=125;
    } else if(kind<2.5||kind>5.5) {
      if(kind>5.5) {
        // A rotating brush stays inside its full xz circle at every phase.
        const radius=Math.hypot(x,z);x0=z0=-radius;x1=z1=radius;
      }
      x0-=.22;x1+=.22;z0-=2.5;z1+=2.5;
    } else if(kind<3.5) {
      // A full xy circle conservatively contains the arm's limited ±.24 rad.
      const radius=Math.hypot(x,y);x0=y0=-radius;x1=y1=radius;
    } else if(kind<4.5) {y0-=.9;y1+=.9;}
    else {
      // The winch cable's signed y factor ranges from -6.9 to -5.1.
      y0=Math.min(-y*6.9,-y*5.1);y1=Math.max(-y*6.9,-y*5.1);
    }
    const ax=anchors.getX(i),ay=anchors.getY(i),az=anchors.getZ(i);
    bounds.expandByPoint(point.set(x0+ax,y0+ay,z0+az));
    bounds.expandByPoint(point.set(x1+ax,y1+ay,z1+az));
  }
  // Protect boundary visibility against shader float rounding and near planes.
  return bounds.expandByScalar(.05);
}

/**
 * Station work continues around the passengers. Three immutable geometry batches
 * carry all rails, cargo cars, cleaners, work arms and indicator lights.
 */
export function createStationLife() {
  const group = new THREE.Group();
  group.name = 'FreeCommerce / everyday mechanical rituals';
  const colliders = [{minX: 27.65, maxX: 29.75, minZ: 25.8, maxZ: 30.2}];
  const time = {value: 0};
  let effectTime = 0;
  let disposed = false;
  const resources = [];
  const track = r => { resources.push(r); return r; };
  const batches = [[], [], []];
  const object = new THREE.Object3D();
  const color = new THREE.Color();
  const palettes = {steel:'#5e7474',dark:'#22383b',cream:'#c5c1a4',rust:'#a96a43',sage:'#8f9f7d',gold:'#d0ae72',light:'#dbba83',red:'#a66e53'};

  function add(geometry, tint, anchor, kind = 0, phase = 0, batch = 0, rotation = [0,0,0]) {
    if (geometry.index) { const source = geometry; geometry = geometry.toNonIndexed(); source.dispose(); }
    object.rotation.set(...rotation); object.position.set(0,0,0); object.scale.set(1,1,1); object.updateMatrix();
    geometry.applyMatrix4(object.matrix);
    const p = geometry.attributes.position;
    const n = geometry.attributes.normal;
    const colors = new Float32Array(p.count * 3), anchors = new Float32Array(p.count * 3), kinds = new Float32Array(p.count), phases = new Float32Array(p.count);
    color.set(palettes[tint] || tint);
    for (let i = 0; i < p.count; i++) {
      const shade = batch === 2 ? 1 : .58 + .42 * Math.max(0, n.getX(i) * -.25 + n.getY(i) * .85 + n.getZ(i) * .45);
      colors[i*3] = color.r * shade; colors[i*3+1] = color.g * shade; colors[i*3+2] = color.b * shade;
      anchors.set(anchor, i*3); kinds[i] = kind; phases[i] = phase;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aAnchor', new THREE.BufferAttribute(anchors, 3));
    geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    batches[batch].push(geometry);
  }
  function box(tint, anchor, local, size, kind = 0, phase = 0, batch = 0, rotation) {
    const geometry = new THREE.BoxGeometry(...size);
    if (rotation) geometry.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2]);
    geometry.translate(...local);
    add(geometry, tint, anchor, kind, phase, batch);
  }
  function cylinder(tint, anchor, local, radius, height, kind = 0, phase = 0, batch = 0, rotation) {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 8, 1);
    if (rotation) geometry.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2]);
    geometry.translate(...local);
    add(geometry, tint, anchor, kind, phase, batch);
  }

  // A tram rail is hung from the high roof, well above both passenger galleries.
  for (const x of [-15.4, -12.6]) box('dark',[0,0,0],[x,26.2,-13],[.16,.3,238]);
  for (let z = -124; z <= 100; z += 16) {
    box('steel',[0,0,0],[-14,26.45,z],[3.8,.22,.32]);
    for (const x of [-15.4,-12.6]) {
      box('dark',[0,0,0],[x,30,z],[.075,7,.075]);
      box('gold',[0,0,0],[x,26.05,z],[.18,.045,.6],0,0,2);
    }
  }
  for (let car = 0; car < 3; car++) {
    const anchor = [-14,24.45,0], phase = car * -7.6;
    box(car ? 'rust':'cream',anchor,[0,0,0],[3.1,1.85,6.2],1,phase,1);
    box('dark',anchor,[0,-1.04,0],[3.35,.26,6.6],1,phase,1);
    box('steel',anchor,[0,.99,0],[3.3,.16,6.6],1,phase,1);
    box('dark',anchor,[0,1.34,0],[.75,.6,2.6],1,phase,1);
    for (const side of [-1,1]) {
      box('gold',anchor,[side*1.57,0,0],[.04,.2,5.7],1,phase,1);
      box('dark',anchor,[side*1.58,.42,0],[.04,.53,4.8],1,phase,1);
      for (let j = -1; j <= 1; j++) box('steel',anchor,[side*1.6,0,j*1.7],[.06,1.7,.09],1,phase,1);
      box('light',anchor,[side*1.47,-.5,3.12],[.14,.15,.04],1,phase,2);
    }
    if (car) {
      // A slung sealed specimen pallet advertises a job the passengers never see.
      box('dark',anchor,[0,-1.4,0],[2.3,.7,4.7],1,phase,1);
      for (const x of [-.9,.9]) box('cream',anchor,[x,-1.38,0],[.1,.85,4.75],1,phase,1);
      for (const z of [-1.7,1.7]) box('gold',anchor,[0,-1.8,z],[2.4,.08,.12],1,phase,1);
    } else {
      box('sage',anchor,[0,.15,3.15],[2.5,.85,.05],1,phase,1);
      for (const x of [-1.2,1.2]) box('light',anchor,[x,-.58,3.16],[.22,.2,.06],1,phase,2);
    }
  }

  // Local cleaning routes never cross the concourse spine or a passenger bench.
  const cleanerRoutes = [[28.2,0,-4],[-28.2,0,45],[7.3,0,-147]];
  cleanerRoutes.forEach((anchor, i) => {
    const phase = i * 1.73;
    cylinder('dark',anchor,[0,.18,0],.6,.25,2,phase,1);
    cylinder(i===1?'rust':'cream',anchor,[0,.42,0],.47,.35,2,phase,1);
    cylinder('steel',anchor,[0,.74,0],.12,.32,2,phase,1);
    box('dark',anchor,[0,.95,.12],[.54,.28,.3],2,phase,1);
    box('light',anchor,[0,.95,.28],[.36,.08,.03],2,phase,2);
    for (const side of [-1,1]) {
      cylinder('dark',anchor,[side*.46,.2,0],.18,.12,2,phase,1,[0,0,Math.PI/2]);
      cylinder('sage',anchor,[side*.61,.065,.27],.23,.055,6,phase,1);
    }
    box('gold',anchor,[0,.57,-.3],[.18,.04,.5],2,phase,1);
  });

  // One repair cell patiently reassembles the same service unit, tool by tool.
  const work = [28.7,0,28];
  box('dark',work,[0,.6,0],[1.8,1.2,3.9]);
  box('steel',work,[0,1.24,0],[2,.14,4.1]);
  for (const z of [-1.2,0,1.2]) {
    box('cream',work,[0,.6,z],[1.82,.08,.08]);
    box('gold',work,[-1.015,1.19,z],[.03,.07,.62],0,0,2);
  }
  cylinder('steel',work,[0,1.55,.65],.32,.58);
  box('dark',work,[0,1.64,.6],[.95,.25,.7]);
  box('sage',work,[-.08,1.82,.58],[.55,.09,.4]);
  for (const z of [-1.15,1.15]) {
    const pivot = [28.7,1.45,28+z];
    cylinder('dark',pivot,[0,0,0],.22,.3);
    box('rust',pivot,[-.3,.48,0],[.2,1.05,.25],3,z,1,[0,0,.5]);
    cylinder('steel',pivot,[-.54,.94,0],.2,.29,3,z,1,[Math.PI/2,0,0]);
    box('cream',pivot,[-.85,1.02,0],[.7,.15,.15],3,z,1);
    for (const side of [-1,1]) box('dark',pivot,[-1.17,.93,side*.12],[.15,.32,.07],3,z,1);
    box('light',pivot,[-1.22,1.02,0],[.04,.05,.08],3,z,2);
  }
  for (let i=0;i<7;i++) box('sage',work,[-.5+i*.16,1.37,-.42],[.075,.04,.38]);

  // Dock workers let an automated winch shoulder the awkward cargo.
  const dock=[-7.4,13.8,-171.5];
  box('steel',dock,[0,.2,0],[5.5,.6,1.1]);
  for(const x of [-2.3,2.3]) box('dark',dock,[x,1.5,0],[.12,2.8,.16]);
  cylinder('rust',dock,[0,-.35,0],.5,1.3,0,0,0,[Math.PI/2,0,0]);
  box('gold',dock,[0,-.54,.67],[1.6,.11,.04],0,0,2);
  const load=[-7.4,6.2,-171.5];
  box('rust',load,[0,0,0],[2.9,2.4,3.8],4,0,1);
  for(const x of [-1.15,1.15]) box('cream',load,[x,0,0],[.11,2.45,3.85],4,0,1);
  for(const z of [-1.35,1.35]) box('dark',load,[0,0,z],[2.95,2.47,.13],4,0,1);
  box('gold',load,[0,.1,1.92],[1.5,.18,.02],4,0,1);
  for(const x of [-.8,.8]) {
    const cableAnchor=[-7.4+x,13.4,-171.5];
    box('dark',cableAnchor,[0,.5,0],[.035,1,.035],5,0,1);
  }

  function combine(geometries) {
    const attributes = ['position','color','aAnchor','aKind','aPhase'];
    const result = new THREE.BufferGeometry();
    for(const name of attributes) {
      const itemSize = geometries[0].attributes[name].itemSize;
      let length=0; for(const g of geometries) length += g.attributes[name].array.length;
      const data=new Float32Array(length); let offset=0;
      for(const g of geometries) {data.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}
      result.setAttribute(name,new THREE.BufferAttribute(data,itemSize));
    }
    geometries.forEach(g=>g.dispose());
    return result;
  }
  const vertex = `
    uniform float uTime;
    attribute vec3 color; attribute vec3 aAnchor; attribute float aKind; attribute float aPhase;
    varying vec3 vColor; varying float vDistance;
    void main(){
      vec3 p=position;
      if(aKind<.5) { }
      else if(aKind<1.5) {p.z+=mod(uTime*2.6+aPhase+130.,280.)-155.;}
      else if(aKind<2.5 || aKind>5.5) {
        float t=uTime*.17+aPhase;
        if(aKind>5.5){float s=sin(uTime*2.5+aPhase),c=cos(uTime*2.5+aPhase);p.xz=mat2(c,-s,s,c)*p.xz;}
        p.x+=sin(t)*.22;
        p.z+=sin(t)*2.5;
      }
      else if(aKind<3.5) {
        float angle=sin(uTime*.5+aPhase)*.24;
        float c=cos(angle),s=sin(angle);p.xy=mat2(c,-s,s,c)*p.xy;
      }
      else if(aKind<4.5) {p.y+=sin(uTime*.22)*.9;}
      else {p.y=-p.y*(6.-sin(uTime*.22)*.9);}
      p+=aAnchor;
      vec4 mv=modelViewMatrix*vec4(p,1.);
      vDistance=length(mv.xyz);vColor=color;
      gl_Position=projectionMatrix*mv;
    }`;
  const materials = [];
  const renderBatches=[];
  const viewFrustum=new THREE.Frustum(),projectionView=new THREE.Matrix4(),worldBounds=new THREE.Box3();
  let visibleDrawCalls=0;
  let submittedTriangles=0;
  let triangleCount=0;
  for(let i=0;i<batches.length;i++) {
    const geometry=track(combine(batches[i]));
    triangleCount+=geometry.attributes.position.count/3;
    const material=track(new THREE.ShaderMaterial({
      uniforms:{uTime:time},
      vertexShader:vertex,
      fragmentShader:`
        varying vec3 vColor; varying float vDistance;
        void main(){
          vec3 c=mix(vColor,vec3(.0103,.023,.027),1.-exp(-.000016*vDistance*vDistance));
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    materials.push(material);
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name=['Cargo rail and repair infrastructure','Working station machines','Machine status lamps'][i];
    mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;group.add(mesh);
    const bounds=shaderMotionBounds(geometry);
    mesh.userData.motionBounds=bounds;
    renderBatches.push({mesh,bounds,triangles:geometry.attributes.position.count/3});
  }
  visibleDrawCalls=renderBatches.length;submittedTriangles=triangleCount;
  const events = [
    {x:-14,z:47,radius:28,caption:'PORT LOGISTICS / Another specimen pallet clears the passenger deck.'},
    {x:28.7,z:28,radius:8,caption:'REPAIR CELL / The same gripper has failed its inspection three times.'},
    {x:28.2,z:-4,radius:7,caption:'CLEANING UNIT / This patch of floor appears to be a personal project.'},
    {x:-28.2,z:45,radius:7,caption:'CLEANING UNIT / Please continue being somewhere else.'},
    {x:7.3,z:-147,radius:7,caption:'SERVICE TRAFFIC / One cleaner has right of way. The cleaner knows this.'},
    {x:-7.4,z:-168,radius:13,caption:'DOCK 07 / Cargo transfer progresses at a speed best described as deliberate.'},
    {x:0,z:-44,radius:20,caption:'PUBLIC FEED / Do not leave luggage, contracts, or cloned tissue unattended.'},
    {x:0,z:34,radius:24,caption:'PUBLIC FEED / Local time is available. Nobody agrees on what it means.'},
    {x:-58,z:30,radius:15,caption:'EXCHANGE NOTICE / Today’s specials were legal at their point of origin.'},
    {x:75,z:-20,radius:16,caption:'OBSERVATION / The planet does not recognize the station’s working hours.'},
  ];
  return {
    group,colliders,events,
    stats:Object.freeze({drawCalls:batches.length,triangles:triangleCount,textures:0,lights:0,cargoCars:3,cleaners:3,repairArms:2,winches:1,
      get visibleDrawCalls(){return visibleDrawCalls;},get submittedTriangles(){return submittedTriangles;}}),
    update(dt,_time,context){
      if(disposed)return;
      if(!context?.reducedMotion)effectTime+=Math.max(0,Math.min(dt,.05));
      time.value=effectTime;
      const camera=context?.camera;
      visibleDrawCalls=submittedTriangles=0;
      if(camera?.projectionMatrix&&camera?.matrixWorldInverse) {
        camera.updateMatrixWorld();group.updateWorldMatrix(true,false);
        projectionView.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
        viewFrustum.setFromProjectionMatrix(projectionView);
        for(const batch of renderBatches) {
          worldBounds.copy(batch.bounds).applyMatrix4(group.matrixWorld);
          batch.mesh.visible=viewFrustum.intersectsBox(worldBounds);
          if(batch.mesh.visible){visibleDrawCalls++;submittedTriangles+=batch.triangles;}
        }
      } else {
        for(const batch of renderBatches)batch.mesh.visible=true;
        visibleDrawCalls=renderBatches.length;submittedTriangles=triangleCount;
      }
    },
    dispose(){if(disposed)return;disposed=true;resources.forEach(r=>r.dispose());group.clear();},
  };
}
