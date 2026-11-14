import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Shop fittings and stock, in any colour, merged into two static meshes: one
 * lit, one self-lit. Shop fit-outs are plain painted and laminated surfaces;
 * built from the hull's stencilled panel batches they read as cargo containers.
 * The lit mesh carries a share of its own colour as light, as goods under a
 * shop's lamps do, so a display is readable under a dim balcony.
 */
export function createShopKit(name) {
  const lit=[],glowing=[];
  const object=new THREE.Object3D(),tint=new THREE.Color();
  let disposed=false;

  function place(list,geometry,color,x,y,z,rx=0,ry=0,rz=0) {
    if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}
    for(const name of Object.keys(geometry.attributes))if(name!=='position'&&name!=='normal')geometry.deleteAttribute(name);
    const count=geometry.attributes.position.count,colors=new Float32Array(count*3);
    tint.set(color);
    for(let i=0;i<count;i++){colors[i*3]=tint.r;colors[i*3+1]=tint.g;colors[i*3+2]=tint.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    object.position.set(x,y,z);object.rotation.set(rx,ry,rz);object.updateMatrix();
    geometry.applyMatrix4(object.matrix);list.push(geometry);
  }
  const kit={
    /** A box centred on (x, y, z). `w` runs along x, `h` up, `d` along z. */
    box(color,x,y,z,w,h,d,{rx=0,ry=0,rz=0,light=false}={}) {
      place(light?glowing:lit,new THREE.BoxGeometry(w,h,d),color,x,y,z,rx,ry,rz);
    },
    /** An upright can, jar or post standing on `y`. `top` narrows or widens its upper end. */
    can(color,x,y,z,radius,height,{top=radius,sides=6,rx=0,rz=0,light=false}={}) {
      place(light?glowing:lit,new THREE.CylinderGeometry(top,radius,height,sides,1,false),color,x,y+height/2,z,rx,0,rz);
    },
    ball(color,x,y,z,radius,{light=false}={}) {
      place(light?glowing:lit,new THREE.IcosahedronGeometry(radius,0),color,x,y,z);
    },
    cone(color,x,y,z,radius,height,{sides=4,rx=0,ry=0,rz=0}={}) {
      place(lit,new THREE.ConeGeometry(radius,height,sides),color,x,y+height/2,z,rx,ry,rz);
    },
    ring(color,x,y,z,radius,tube,{rx=0,ry=0,rz=0}={}) {
      place(lit,new THREE.TorusGeometry(radius,tube,4,10),color,x,y,z,rx,ry,rz);
    },
    /** Any other shape; the geometry is consumed. */
    shape(color,geometry,x,y,z,{rx=0,ry=0,rz=0,light=false}={}) {
      place(light?glowing:lit,geometry,color,x,y,z,rx,ry,rz);
    },
    /** Merge everything placed so far into the group. Call once. */
    build(group) {
      const meshes=[];
      for(const [list,material,label] of [
        [lit,litMaterial(),'fittings and stock'],
        [glowing,new THREE.MeshBasicMaterial({vertexColors:true}),'lamps and lit panels'],
      ]) {
        if(!list.length){material.dispose();continue;}
        const geometry=mergeGeometries(list);list.forEach(piece=>piece.dispose());list.length=0;
        const mesh=new THREE.Mesh(geometry,material);
        mesh.name=`${name} / ${label}`;mesh.matrixAutoUpdate=false;mesh.receiveShadow=true;
        group.add(mesh);meshes.push(mesh);
      }
      const triangles=meshes.reduce((sum,mesh)=>sum+mesh.geometry.attributes.position.count/3,0);
      return {meshes,drawCalls:meshes.length,triangles,
        // A standalone preview disposes these itself; in the station the normal traversal owns them.
        dispose(){if(disposed)return;disposed=true;for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}}};
    },
  };
  return kit;
}

function litMaterial() {
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:.04});
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.22;');
  };
  material.customProgramCacheKey=()=>'pfc-shop-fittings-v1';
  return material;
}

/** A small repeatable generator, so every visit finds the same shelves. */
export function shopRandom(seed) {
  let state=(seed*2654435761)>>>0||1;
  return ()=>{state^=state<<13;state>>>=0;state^=state>>>17;state^=state<<5;state>>>=0;return state/4294967296;};
}
