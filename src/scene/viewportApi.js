import { OrthographicCamera, PerspectiveCamera, Raycaster, Vector2 } from 'three'
import { applyWallCutaway, sceneBox, topOrthoFrame, viewPose } from './views'

// Filled in by <Bridge /> inside the Canvas.
export const viewport = { three: null }

// Renders each requested view at a fixed size and returns data URLs. Editing
// guides (grid, selection outlines) are hidden for the duration. 'current'
// uses the camera as the user has it framed.
export function renderViews(doc, views, { width, height, type = 'image/jpeg', quality = 0.92, fov = 35 }) {
  const t = viewport.three
  if (!t) throw new Error('The 3D view is not ready yet.')
  const { gl, scene, camera } = t

  const hidden = []
  scene.traverse((o) => {
    if (o.userData.helper && o.visible) {
      o.visible = false
      hidden.push(o)
    }
  })
  const prevSize = gl.getSize(new Vector2())
  const prevRatio = gl.getPixelRatio()
  const aspect = width / height
  const box = sceneBox(doc)

  try {
    gl.setPixelRatio(1)
    gl.setSize(width, height, false)
    return views.map((key) => {
      let cam
      if (key === 'current') {
        cam = camera.clone()
        cam.aspect = aspect
      } else if (key === 'top') {
        const f = topOrthoFrame(box, aspect)
        cam = new OrthographicCamera(-f.halfW, f.halfW, f.halfH, -f.halfH, 0.1, f.height + 10)
        cam.position.set(f.cx, f.height, f.cz)
        cam.up.set(0, 0, -1)
        cam.lookAt(f.cx, 0, f.cz)
      } else {
        cam = new PerspectiveCamera(fov, aspect, 0.05, 500)
        const pose = viewPose(key, box, aspect, fov)
        cam.position.copy(pose.position)
        cam.lookAt(pose.target)
      }
      cam.updateProjectionMatrix()
      cam.updateMatrixWorld()
      applyWallCutaway(scene, cam.position)
      gl.render(scene, cam)
      return gl.domElement.toDataURL(type, quality)
    })
  } finally {
    gl.setPixelRatio(prevRatio)
    gl.setSize(prevSize.x, prevSize.y, false)
    hidden.forEach((o) => { o.visible = true })
    applyWallCutaway(scene, camera.position)
    gl.render(scene, camera)
  }
}

// Which placed item (and which side of it) is under a screen point?
export function pickItem(clientX, clientY) {
  const t = viewport.three
  if (!t) return null
  const { gl, scene, camera } = t
  const r = gl.domElement.getBoundingClientRect()
  const ndc = new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
  const ray = new Raycaster()
  ray.setFromCamera(ndc, camera)
  for (const hit of ray.intersectObjects(scene.children, true)) {
    let o = hit.object
    let helper = false
    let hidden = false
    for (let a = o; a; a = a.parent) hidden ||= !a.visible
    if (hidden) continue
    while (o && !o.userData.itemId) {
      helper ||= !!o.userData.helper
      o = o.parent
    }
    if (helper || o?.userData.helper) continue
    // The nearest solid thing decides: floor or wall in front means no item.
    if (!o) return null
    const local = o.worldToLocal(hit.point.clone())
    return { id: o.userData.itemId, side: local.z >= 0 ? 'front' : 'back' }
  }
  return null
}

if (import.meta.env?.DEV) Object.assign(window, { __viewport: viewport, __pickItem: pickItem, __renderViews: renderViews })
