import { Shape } from 'three'

// Plan outlines are arrays of [x, z] in item-local metres: x to the right,
// +z towards the front (the aisle). Closed outlines repeat the first point at
// the end so they can be used directly for wrap-around graphics.

export function rectOutline(w, d) {
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
}

// Starts and ends at the back (−z) so a wrapped graphic's seam is hidden and
// the centre of the artwork lands on the front face.
export function circleOutline(r, segments = 72) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push([Math.sin(a) * r, -Math.cos(a) * r])
  }
  return pts
}

// Kidney-bean reception counter: convex face towards the front, concave
// staff side at the back. Starts and ends in the middle of the concave side.
export function kidneyOutline(w, d, segments = 128) {
  const hw = w / 2
  const hd = d / 2
  const s = new Shape()
  s.moveTo(0, -hd * 0.4)
  s.bezierCurveTo(hw * 1.2, -hd, hw * 1.2, hd * 1.2, 0, hd)
  s.bezierCurveTo(-hw * 1.2, hd * 1.2, -hw * 1.2, -hd, 0, -hd * 0.4)
  return s.getPoints(segments).map((p) => [p.x, p.y])
}

export function openPolygon(pts) {
  const [fx, fz] = pts[0]
  const [lx, lz] = pts[pts.length - 1]
  return fx === lx && fz === lz ? pts.slice(0, -1) : pts
}

export function perimeter(closedPts) {
  let total = 0
  for (let i = 1; i < closedPts.length; i++) {
    total += Math.hypot(closedPts[i][0] - closedPts[i - 1][0], closedPts[i][1] - closedPts[i - 1][1])
  }
  return total
}

export function rotatePoint([x, z], deg) {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  // Matches a three.js rotation of `a` radians about +Y.
  return [x * c + z * s, -x * s + z * c]
}

export function extents(pts) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  return { minX, maxX, minZ, maxZ }
}
