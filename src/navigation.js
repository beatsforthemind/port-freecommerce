/** Shared floor geometry for walking, crowds, and the station plan. */
const BODY_PROBES = [[-.27,0],[.27,0],[0,-.27],[0,.27]];
// Floors and colliders are bucketed into four-metre cells. A query then tests
// the handful of shapes near a point instead of every shape in the station.
const CELL = 4;
const COLLIDER_REACH = .28;
const NONE = Object.freeze([]);
const cellKey = (cx, cz) => (cx + 4096) + (cz + 4096) * 8192;

export function containsPoint(surface, x, z) {
  if (surface.minX !== undefined && (x < surface.minX - 1e-6 || x > surface.maxX + 1e-6 || z < surface.minZ - 1e-6 || z > surface.maxZ + 1e-6)) return false;
  if (!surface.polygon) return true;
  let inside = false;
  const polygon = surface.polygon;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[j], [bx, bz] = polygon[i];
    const cross = (x - ax) * (bz - az) - (z - az) * (bx - ax);
    if (Math.abs(cross) < 1e-6 && x >= Math.min(ax,bx)-1e-6 && x <= Math.max(ax,bx)+1e-6 && z >= Math.min(az,bz)-1e-6 && z <= Math.max(az,bz)+1e-6) return true;
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

export function surfaceHeight(surface, x, z) {
  if (!surface.axis) return surface.height || 0;
  const along = surface.axis === 'x' ? x : z;
  const t = Math.max(0, Math.min(1, (along - surface.start) / (surface.end - surface.start)));
  return surface.from + (surface.to - surface.from) * t;
}

export function sectorAt(x, z) {
  if (z < -129.8) return 'docks';
  if (x > 31.8) return 'observation';
  if (x < -31.8) return 'market';
  return 'concourse';
}

function insert(cells, item, minX, maxX, minZ, maxZ) {
  const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL), z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
  for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
    const key = cellKey(cx, cz), list = cells.get(key);
    if (list) list.push(item); else cells.set(key, [item]);
  }
}

export function createNavigation({surfaces, colliders}) {
  // Precompute coarse bounds once; polygon tests only run near that floor.
  const floors = surfaces.map(surface => {
    if (!surface.polygon) return surface;
    return {...surface, minX:Math.min(...surface.polygon.map(p=>p[0])), maxX:Math.max(...surface.polygon.map(p=>p[0])), minZ:Math.min(...surface.polygon.map(p=>p[1])), maxZ:Math.max(...surface.polygon.map(p=>p[1]))};
  });
  // Cells keep floors in their authored order, so equal candidates resolve
  // exactly as a full scan would. Heights stay live: a lift floor is the same
  // object here as in its owner.
  const floorCells = new Map(), unbounded = [];
  for (const floor of floors) {
    if (floor.minX === undefined) unbounded.push(floor);
    else insert(floorCells, floor, floor.minX - .001, floor.maxX + .001, floor.minZ - .001, floor.maxZ + .001);
  }
  // Colliders are appended after construction (props, terminals, models), so
  // the index follows the live array. Only vertical extents ever change.
  let colliderCells = new Map(), indexed = 0;
  function indexColliders() {
    if (colliders.length < indexed) { colliderCells = new Map(); indexed = 0; }
    for (; indexed < colliders.length; indexed++) {
      const c = colliders[indexed];
      insert(colliderCells, c, c.minX - COLLIDER_REACH, c.maxX + COLLIDER_REACH, c.minZ - COLLIDER_REACH, c.maxZ + COLLIDER_REACH);
    }
  }
  function heightAt(x, z, reference) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return NaN;
    let best = NaN, distance = Infinity, bestPriority = 0;
    const referenced = Number.isFinite(reference);
    const local = floorCells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) || NONE;
    for (let pass = 0; pass < 2; pass++) {
      const list = pass ? unbounded : local;
      for (let i = 0; i < list.length; i++) {
        const surface = list[i];
        if (!containsPoint(surface, x, z)) continue;
        const height = surfaceHeight(surface, x, z);
        const delta = referenced ? Math.abs(height - reference) : height;
        // Transport inclines can overlap the public floor beneath them. Capture
        // only a continuous walking step; a high flight stays an underpass.
        const priority = referenced && delta <= .32 ? Math.max(0,surface.priority || 0) : 0;
        if (priority > bestPriority || (priority === bestPriority && delta < distance)) {
          distance = delta; best = height; bestPriority = priority;
        }
      }
    }
    return best;
  }
  function canWalk(x, z, feet) {
    const height = heightAt(x, z, feet);
    if (!Number.isFinite(height) || (Number.isFinite(feet) && Math.abs(height - feet) > .32)) return false;
    // A body must fit on the union of adjacent floors, including ramp joins.
    for (const [dx,dz] of BODY_PROBES) {
      const edge = heightAt(x + dx, z + dz, height);
      if (!Number.isFinite(edge) || Math.abs(edge - height) > .32) return false;
    }
    if (colliders.length !== indexed) indexColliders();
    const near = colliderCells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) || NONE;
    for (let i = 0; i < near.length; i++) {
      const c = near[i];
      if (x <= c.minX-.28 || x >= c.maxX+.28 || z <= c.minZ-.28 || z >= c.maxZ+.28) continue;
      const slopeHeight = c.sloped ? surfaceHeight(c,x,z) : 0;
      const bottom = c.sloped ? slopeHeight+c.minYOffset : c.minY ?? 0;
      const top = c.sloped ? slopeHeight+c.maxYOffset : c.maxY ?? 3.2;
      if (height >= top - .05 || height + 1.7 <= bottom + .05) continue;
      return false;
    }
    return true;
  }
  return {surfaces:floors, heightAt, canWalk, sectorAt};
}
