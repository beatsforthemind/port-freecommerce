/** Shared floor geometry for walking, crowds, and the station plan. */
const BODY_PROBES = [[-.27,0],[.27,0],[0,-.27],[0,.27]];

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

export function createNavigation({surfaces, colliders}) {
  // Precompute coarse bounds once; polygon tests only run near that floor.
  const floors = surfaces.map(surface => {
    if (!surface.polygon) return surface;
    return {...surface, minX:Math.min(...surface.polygon.map(p=>p[0])), maxX:Math.max(...surface.polygon.map(p=>p[0])), minZ:Math.min(...surface.polygon.map(p=>p[1])), maxZ:Math.max(...surface.polygon.map(p=>p[1]))};
  });
  function heightAt(x, z, reference) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return NaN;
    let best = NaN, distance = Infinity;
    for (const surface of floors) {
      if (!containsPoint(surface, x, z)) continue;
      const height = surfaceHeight(surface, x, z);
      const delta = Number.isFinite(reference) ? Math.abs(height - reference) : height;
      if (delta < distance) {distance = delta; best = height;}
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
    for (const c of colliders) {
      const bottom = c.minY ?? 0, top = c.maxY ?? 3.2;
      if (height >= top - .05 || height + 1.7 <= bottom + .05) continue;
      if (x > c.minX - .28 && x < c.maxX + .28 && z > c.minZ - .28 && z < c.maxZ + .28) return false;
    }
    return true;
  }
  return {surfaces:floors, heightAt, canWalk, sectorAt};
}
