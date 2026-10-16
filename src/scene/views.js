import { Vector3 } from 'three'
import { getDef, worldOutline } from '../catalog/items'
import { STAND_TYPES } from '../state/store'

export const VIEWS = [
  { key: 'hero',  label: 'Perspective', dir: [-0.62, 0.5, 1] },
  { key: 'front', label: 'Front',       dir: [0, 0.16, 1] },
  { key: 'left',  label: 'Left',        dir: [-1, 0.28, 0.35] },
  { key: 'right', label: 'Right',       dir: [1, 0.28, 0.35] },
  { key: 'top',   label: 'Top',         dir: [0, 1, 0.015] },
]

export const VIEW_BY_KEY = Object.fromEntries(VIEWS.map((v) => [v.key, v]))

// Box around everything worth framing: the stand plus the tallest thing on it.
export function sceneBox(doc) {
  const { width, depth, type, wallHeight } = doc.stand
  let minX = -width / 2, maxX = width / 2, minZ = -depth / 2, maxZ = depth / 2
  let h = STAND_TYPES[type].walls.length ? wallHeight : 1
  for (const item of doc.items) {
    const def = getDef(item.type, doc.customItems)
    if (!def) continue
    h = Math.max(h, def.h)
    for (const [x, z] of worldOutline(item, def)) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
    }
  }
  return { minX, maxX, minZ, maxZ, minY: 0, maxY: h }
}

// Camera position that fits the whole box in frame from the given direction.
// For each corner, the camera must be far enough back that the corner falls
// inside both the vertical and horizontal field of view. The aim point is then
// shifted so the box sits centred in frame rather than centred on its middle,
// which matters for the angled views where the near corner looms large.
export function viewPose(viewKey, box, aspect, fovDeg, margin = 1.1) {
  const dir = new Vector3(...VIEW_BY_KEY[viewKey].dir).normalize()
  const target = new Vector3((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2)
  if (viewKey === 'top') target.y = 0

  const worldUp = new Vector3(0, 1, 0)
  const right = new Vector3().crossVectors(worldUp, dir).normalize()
  const up = new Vector3().crossVectors(dir, right).normalize()
  const tv = Math.tan((fovDeg * Math.PI) / 360)
  const th = tv * aspect

  const corners = []
  for (const x of [box.minX, box.maxX]) {
    for (const y of [box.minY, box.maxY]) {
      for (const z of [box.minZ, box.maxZ]) corners.push(new Vector3(x, y, z))
    }
  }
  const p = new Vector3()
  const fitDistance = () => {
    let dist = 0
    for (const c of corners) {
      p.copy(c).sub(target)
      const along = p.dot(dir)
      dist = Math.max(dist, along + Math.abs(p.dot(right)) * margin / th, along + Math.abs(p.dot(up)) * margin / tv)
    }
    return dist
  }

  let dist = fitDistance()
  for (let i = 0; i < 3; i++) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const c of corners) {
      p.copy(c).sub(target)
      const depth = dist - p.dot(dir)
      const sx = p.dot(right) / (depth * th)
      const sy = p.dot(up) / (depth * tv)
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx)
      minY = Math.min(minY, sy); maxY = Math.max(maxY, sy)
    }
    target
      .addScaledVector(right, ((minX + maxX) / 2) * dist * th)
      .addScaledVector(up, ((minY + maxY) / 2) * dist * tv)
    dist = fitDistance()
  }
  return { position: target.clone().addScaledVector(dir, dist), target }
}

// Straight-down orthographic framing for plan-style renders; front at the bottom.
export function topOrthoFrame(box, aspect, margin = 1.06) {
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const halfW = Math.max((box.maxX - box.minX) / 2, ((box.maxZ - box.minZ) / 2) * aspect) * margin
  return { cx, cz, halfW, halfH: halfW / aspect, height: box.maxY + 8 }
}

// Dollhouse cutaway: hide a shell wall when the camera is looking at it from
// outside, so side and rear views show the stand rather than a blank panel.
// Side walls stay up for front three-quarter views, where they read as context.
export function applyWallCutaway(scene, camPos) {
  scene.traverse((o) => {
    const w = o.userData.wall
    if (!w) return
    if (w.side === 'back') o.visible = camPos.z > w.edge
    else if (w.side === 'left') o.visible = !(camPos.x < w.edge && -camPos.x > camPos.z)
    else o.visible = !(camPos.x > w.edge && camPos.x > camPos.z)
  })
}
