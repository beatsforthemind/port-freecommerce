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
      // Freight shuttles remain inside their two physical end berths.
      z0-=108;z1+=78;
    } else if(kind<2.5||(kind>5.5&&kind<6.5)) {
      if(kind>5.5) {
        // A rotating brush stays inside its full xz circle at every phase.
        const radius=Math.hypot(x,z);x0=z0=-radius;x1=z1=radius;
      }
      x0-=.22;x1+=.22;z0-=2.5;z1+=2.5;
    } else if(kind<3.5) {
      // A full xy circle conservatively contains the arm's limited ±.24 rad.
      const radius=Math.hypot(x,y);x0=y0=-radius;x1=y1=radius;
    } else if(kind<4.5) {y0-=.9;y1+=.9;}
    else if(kind<5.5) {
      // The winch cable's signed y factor ranges from -6.9 to -5.1.
      y0=Math.min(-y*6.9,-y*5.1);y1=Math.max(-y*6.9,-y*5.1);
    } else if(kind<8.5) {
      z0-=108;z1+=78;
      // Both express door leaves slide longitudinally inside a fixed recess.
      if(kind>7.5) {z0-=.72;z1+=.72;}
    } else if(kind>9.5) {
      // The service cage floor travels from gallery17.625 to berth23.36.
      y1+=5.735;
    }
    // Kind 9 is a stationary berth signal; only its vertex colour changes.
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
  // Start mid-service so both lines are visible from the arrival camera.
  const time = {value: 32};
  let effectTime = 32;
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
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 6, 1);
    if (rotation) geometry.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2]);
    geometry.translate(...local);
    add(geometry, tint, anchor, kind, phase, batch);
  }

  // Two independent suspended lines keep opposing services physically separate.
  // Roof ties follow the 32 m structural bays; continuous edge strips replace
  // dozens of tiny lamps. All transport stays over 22 m above the public deck.
  for (const lane of [-14,14]) {
    for(const x of [lane-1.4,lane+1.4]) box('dark',[0,0,0],[x,26.2,-15],[.16,.3,230]);
    box('gold',[0,0,0],[lane,26.03,-15],[.12,.035,230],0,0,2);
    for (let z=-112;z<=80;z+=32) {
      box('steel',[0,0,0],[lane,26.45,z],[3.8,.22,.32]);
      box('dark',[0,0,0],[lane,30.3,z],[.1,7.6,.1]);
    }
    const side=Math.sign(lane);
    for(const [z,endpoint] of [[-108,-1],[78,1]]) {
      const berth=[lane+side*3.15,23.25,z];
      box('steel',berth,[0,0,0],[2.8,.22,22.6]);
      if(lane>0) {
        // Leave a real opening onto the service-lift landing.
        for(const dz of [-6.4,6.4]) box('dark',berth,[side*1.3,.68,dz],[.09,1.15,9.8]);
      } else box('dark',berth,[side*1.3,.68,0],[.09,1.15,22.6]);
      for(const dz of [-8,8]) box('dark',berth,[side*1.3,5.45,dz],[.075,10.8,.075]);
      box('light',[lane,24.45,z],[side*2.1,.16,0],[.22,.45,1.5],9,endpoint,2);
    }
  }

  // Three freight wagons share one shuttle cycle. Their fixed spacing never
  // wraps through the pressure hull or separates when the leading car stops.
  for (let car=0;car<3;car++) {
    const anchor=[-14,24.45,0],offset=(car-1)*7.8;
    const local=(x,y,z)=>[x,y,z+offset];
    box(car===1?'cream':'rust',anchor,local(0,0,0),[3.1,1.85,6.2],1,0,1);
    box('dark',anchor,local(0,-1.04,0),[3.35,.26,6.6],1,0,1);
    box('steel',anchor,local(0,.99,0),[3.3,.16,6.6],1,0,1);
    box('dark',anchor,local(0,1.34,0),[.75,.6,2.6],1,0,1);
    for(const side of [-1,1]) {
      box('gold',anchor,local(side*1.57,0,0),[.04,.2,5.7],1,0,1);
      box('dark',anchor,local(side*1.58,.42,0),[.04,.53,4.8],1,0,1);
      for(const z of [-1.7,1.7]) box('steel',anchor,local(side*1.6,0,z),[.06,1.7,.09],1,0,1);
    }
    if(car!==1) {
      box('dark',anchor,local(0,-1.4,0),[2.3,.7,4.7],1,0,1);
      for(const x of [-.9,.9]) box('cream',anchor,local(x,-1.38,0),[.1,.85,4.75],1,0,1);
      for(const z of [-1.7,1.7]) box('gold',anchor,local(0,-1.8,z),[2.4,.08,.12],1,0,1);
    } else {
      box('sage',anchor,local(0,.15,3.15),[2.5,.85,.05],1,0,1);
      for(const z of [-3.32,3.32]) box('light',anchor,local(0,-.58,z),[2.15,.12,.035],1,0,2);
    }
  }

  for(const z of [-3.9,3.9]) box('dark',[-14,24.45,0],[0,-.95,z],[.8,.22,1.4],1,0,1);

  // A paired, bidirectional express cabin works the opposite line. Its doors
  // open only at rest; opaque inset glazing needs no transparency sorting.
  for(const offset of [-3.9,3.9]) {
    const anchor=[14,24.45,0],phase=60;
    const local=(x,y,z)=>[x,y,z+offset];
    box('cream',anchor,local(0,0,0),[3.1,1.85,7.3],7,phase,1);
    box('dark',anchor,local(0,-1.04,0),[3.35,.26,7.6],7,phase,1);
    box('steel',anchor,local(0,.99,0),[3.3,.16,7.6],7,phase,1);
    box('dark',anchor,local(0,1.34,0),[.75,.6,2.6],7,phase,1);
    for(const side of [-1,1]) {
      box('dark',anchor,local(side*1.57,.25,0),[.045,.9,6.35],7,phase,1);
      for(const direction of [-1,1]) box('sage',anchor,local(side*1.6,-.15,direction*.43),[.06,1.55,.79],side>0?8:7,side>0?direction:phase,1);
      box('light',anchor,local(side*1.61,.82,0),[.045,.075,4.4],7,phase,2);
    }
    for(const z of [-3.68,3.68]) box('light',anchor,local(0,-.58,z),[2.2,.12,.035],7,phase,2);
  }

  box('dark',[14,24.45,0],[0,-.95,0],[.8,.22,.9],7,60,1);

  // Service cages connect each express berth to the existing 17.625 m
  // nonpublic gallery. Their guides reach below the lowest cage floor; landing
  // bridges stop at the cage edge so no floor clips through the moving cabin.
  for(const [z,phase] of [[-108,60],[78,0]]) {
    box('steel',[20.19,23.25,z],[0,0,0],[3.28,.22,2.7]);
    for(const dz of [-1.3,1.3]) box('dark',[20.19,23.25,z],[0,1.05,dz],[3.28,.08,.08]);
    for(const dz of [-1.5,1.5]) box('dark',[24.22,21.45,z],[0,0,dz],[.12,7.65,.12]);
    box('steel',[24.22,25.25,z],[0,0,0],[.22,.18,3.15]);
    const cage=[23,17.535,z];
    box('steel',cage,[0,0,0],[2.3,.18,2.7],10,phase,1);
    box('rust',cage,[1.2,.85,0],[.08,1.6,2.7],10,phase,1);
    for(const dz of [-1.3,1.3]) box('cream',cage,[0,1.05,dz],[2.3,.08,.08],10,phase,1);
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
    // A complete out-and-back cycle contains two eight-second berth dwells.
    // smoothstep gives zero velocity at every dwell boundary and at wrapping.
    float serviceProgress(float clock){
      float t=mod(clock,120.);
      if(t<8.)return 0.;
      if(t<60.)return smoothstep(8.,60.,t);
      if(t<68.)return 1.;
      return 1.-smoothstep(68.,120.,t);
    }
    float doorOpening(float clock){
      float t=mod(clock,120.);
      float dwell=t<8.?t:(t>=60.&&t<68.?t-60.:-10.);
      return smoothstep(0.,1.2,dwell)*(1.-smoothstep(6.6,7.8,dwell));
    }
    float liftProgress(float clock){
      float t=mod(clock,120.);
      if(t<8.)return 1.;
      if(t<24.)return 1.-smoothstep(8.,24.,t);
      if(t<104.)return 0.;
      return smoothstep(104.,120.,t);
    }
    void main(){
      vec3 p=position;
      float signal=1.;
      if(aKind<.5) { }
      else if(aKind<1.5) {p.z+=mix(-108.,78.,serviceProgress(uTime+aPhase));}
      else if(aKind<2.5 || (aKind>5.5&&aKind<6.5)) {
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
      else if(aKind<5.5) {p.y=-p.y*(6.-sin(uTime*.22)*.9);}
      else if(aKind<8.5) {
        float clock=uTime+60.;
        p.z+=mix(-108.,78.,serviceProgress(clock));
        if(aKind>7.5)p.z+=aPhase*.72*doorOpening(clock);
      }
      else if(aKind<9.5) {
        float clock=uTime+(aAnchor.x>0.?60.:0.);
        float progress=serviceProgress(clock);
        float occupied=aPhase<0.?1.-step(.0001,progress):step(.9999,progress);
        signal=.12+occupied*(.35+.53*doorOpening(clock));
      }
      else {p.y+=5.735*liftProgress(uTime+aPhase);}
      p+=aAnchor;
      vec4 mv=modelViewMatrix*vec4(p,1.);
      vDistance=length(mv.xyz);vColor=color*signal;
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
    {x:-14,z:47,radius:28,caption:'PORT LOGISTICS / Three freight wagons share the north service line. Nothing travels faster than its clearance.'},
    {x:22,z:76,radius:20,caption:'SERVICE GALLERY / The lift is reserved for station staff, sealed parcels, and disputes too large for the stairs.'},
    {x:14,z:76,radius:25,caption:'EXPRESS LINE / The berth confirms alignment before the doors open. Most passengers have stopped checking the clock.'},
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
    stats:Object.freeze({drawCalls:batches.length,triangles:triangleCount,textures:0,lights:0,cargoCars:3,expressCabins:2,serviceBerths:4,serviceLifts:2,slidingDoorLeaves:4,serviceCycleSeconds:120,cleaners:3,repairArms:2,winches:1,
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
