import * as THREE from 'three';
import { containsPoint, surfaceHeight } from './navigation.js';

/** The render layer for whatever stands wholly inside the concourse. */
export const CONCOURSE_LAYER = 1;

/**
 * The concourse's open interior: between its side walls, under its roof, and
 * through the thickness of its end bulkheads. The hull that encloses it is not
 * part of it. Anything wholly inside can be seen from a district only through
 * one of that district's openings.
 */
export const CONCOURSE_INTERIOR = Object.freeze(new THREE.Box3(new THREE.Vector3(-32, -5, -130.6), new THREE.Vector3(32, 34.5, 100.6)));

/**
 * Where each district looks into the concourse. The exchange and the gallery
 * are sealed rooms with one doorway each. The departure head is glazed all
 * round, so it faces the whole north bulkhead: the dock throat and the great
 * aperture above it.
 */
const OPENINGS = Object.freeze({
  market: [new THREE.Box3(new THREE.Vector3(-33, -.2, 17.9), new THREE.Vector3(-31.9, 6.6, 42.1))],
  observation: [new THREE.Box3(new THREE.Vector3(31.9, -.2, -28.4), new THREE.Vector3(33, 6.75, -11.6))],
  docks: [new THREE.Box3(new THREE.Vector3(-32, -.2, -131.1), new THREE.Vector3(32, 34.5, -128.9))],
});
// An eye is taken to be in a district only while it is at a walking height
// above one of that district's floors. Anywhere else, nothing is hidden.
const EYE_ABOVE_FLOOR = Object.freeze([.6, 3.4]);

/**
 * Decides each frame whether the inside of the concourse can be seen at all.
 * From a side district it can only be seen through that district's opening;
 * while no opening is in view, the hall and everything in it is skipped, and
 * so is the shadow pass that only the hall receives.
 *
 * The test is conservative. It hides the hall only for an eye standing on a
 * district floor whose openings are all outside the view; a doubtful case
 * draws everything.
 */
export function createSectorVisibility({scene, camera, layouts}) {
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), extent = new THREE.Box3();
  // An eye this close to the hall is treated as inside it.
  const threshold = CONCOURSE_INTERIOR.clone().expandByScalar(.6);
  // Instance bounds are single precision: a box that ends exactly on the limit may round past it.
  const roomy = CONCOURSE_INTERIOR.clone().expandByScalar(.002);
  const districts = layouts.filter(layout => OPENINGS[layout.id]).map(layout => ({id: layout.id, surfaces: layout.surfaces}));
  let enabled = true, seen = true, sorted = 0, triangles = 0;
  camera.layers.enable(CONCOURSE_LAYER);

  function districtUnder(eye) {
    for (const district of districts) for (const surface of district.surfaces) {
      if (!containsPoint(surface, eye.x, eye.z)) continue;
      const above = eye.y - surfaceHeight(surface, eye.x, eye.z);
      if (above > EYE_ABOVE_FLOOR[0] && above < EYE_ABOVE_FLOOR[1]) return district.id;
    }
    return null;
  }

  return {
    /**
     * Sort the finished scene: whatever lies wholly inside the concourse joins
     * its layer. Call once, after the reflection probes are captured, because
     * their cameras see only the default layer.
     *
     * Bounds are read as they stand, so this suits fixed objects and ones
     * that move only within the hall. An object can state its own answer with
     * `userData.concourseInterior`: true for something that roams the hall
     * without fixed bounds, false for something that may leave it.
     */
    classify() {
      scene.updateMatrixWorld(true);
      scene.traverse(object => {
        if (!object.isMesh && !object.isPoints && !object.isLine) return;
        const stated = object.userData.concourseInterior;
        if (stated === false) return;
        let inside = stated === true;
        if (!inside && object.frustumCulled) {
          const bounds = object.isInstancedMesh
            ? object.boundingBox || (object.computeBoundingBox(), object.boundingBox)
            : object.geometry.boundingBox || (object.geometry.computeBoundingBox(), object.geometry.boundingBox);
          inside = Boolean(bounds) && !bounds.isEmpty() && roomy.containsBox(extent.copy(bounds).applyMatrix4(object.matrixWorld));
        }
        if (!inside) return;
        object.layers.set(CONCOURSE_LAYER);
        sorted++;
        const count = object.geometry.index ? object.geometry.index.count : object.geometry.attributes.position?.count || 0;
        triangles += object.isMesh ? count / 3 * (object.isInstancedMesh ? object.count : 1) : 0;
      });
    },
    /** Call once the eye is placed for the frame. Returns whether the hall is drawn. */
    update() {
      seen = true;
      if (enabled && !threshold.containsPoint(camera.position)) {
        const district = districtUnder(camera.position);
        if (district) {
          camera.updateMatrixWorld();
          frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
          seen = OPENINGS[district].some(opening => frustum.intersectsBox(opening));
        }
      }
      if (seen) camera.layers.enable(CONCOURSE_LAYER); else camera.layers.disable(CONCOURSE_LAYER);
      return seen;
    },
    get concourseSeen() { return seen; },
    get enabled() { return enabled; },
    /** With this off, everything is always drawn. For comparison and diagnosis. */
    set enabled(value) { enabled = Boolean(value); },
    get stats() { return {concourseSeen: seen, sortedObjects: sorted, sortedTriangles: Math.round(triangles), districts: districts.length}; },
  };
}

/**
 * Split parts that are already placed in the world into those wholly inside
 * the concourse and the rest, so a batch that spans both can be two draws
 * that are culled apart.
 */
export function partitionByHall(geometries) {
  const hall = [], elsewhere = [];
  for (const geometry of geometries) {
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    (CONCOURSE_INTERIOR.containsBox(geometry.boundingBox) ? hall : elsewhere).push(geometry);
  }
  return {hall, elsewhere};
}
