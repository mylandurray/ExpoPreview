import { Component, Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { NeutralToneMapping, Plane, Raycaster, Vector2, Vector3 } from 'three'
import { useStore, constrainPosition } from '../state/store'
import { getDef } from '../catalog/items'
import Stand from './Stand'
import PlacedItem from './PlacedItem'
import ItemModel from './models'
import { sceneBox, viewPose } from './views'
import { dragState } from './dragState'
import { viewport } from './viewportApi'

const FOV = 40

// ─── Lighting ─────────────────────────────────────────────────────────────────
// A procedural studio environment (no network needed) gives soft reflections
// and fill; one directional key light casts the shadows.
function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#5d626b']} />
      <Lightformer intensity={2.2} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[14, 14, 1]} />
      <Lightformer intensity={1.2} position={[0, 3, 12]} scale={[16, 5, 1]} />
      <Lightformer intensity={0.9} position={[-10, 3, 2]} scale={[8, 5, 1]} />
      <Lightformer intensity={0.9} position={[10, 3, 2]} scale={[8, 5, 1]} />
      <Lightformer intensity={0.4} position={[0, 3, -12]} scale={[16, 5, 1]} />
    </Environment>
  )
}

class EnvironmentBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { useStore.getState().toast('Couldn’t load that environment — using the studio backdrop.', 'error') }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function Lighting() {
  const stand = useStore((s) => s.doc.stand)
  const scene = useStore((s) => s.doc.scene)
  const span = Math.max(stand.width, stand.depth)
  const s = span * 0.8 + 3
  const hdri = scene.background === 'hdri'
  return (
    <>
      {!hdri && <color attach="background" args={[scene.backgroundColor]} />}
      {!hdri && scene.hall && <fog attach="fog" args={[scene.backgroundColor, 14 + span * 2.5, 45 + span * 5]} />}
      <hemisphereLight args={['#ffffff', '#cfd3d9', 0.35]} />
      <directionalLight
        position={[span * 0.45 + 3, 11, span * 0.55 + 6]}
        intensity={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
      >
        <orthographicCamera attach="shadow-camera" args={[-s, s, s, -s, 0.5, 60]} />
      </directionalLight>
      {hdri ? (
        <EnvironmentBoundary key={scene.hdri} fallback={<StudioEnvironment />}>
          <Suspense fallback={<StudioEnvironment />}>
            <Environment preset={scene.hdri} background backgroundBlurriness={0.04} />
          </Suspense>
        </EnvironmentBoundary>
      ) : (
        <StudioEnvironment />
      )}
    </>
  )
}

// ─── Camera presets ───────────────────────────────────────────────────────────
// Glides the camera to the requested view; any user orbit interrupts it.
function CameraRig() {
  const view = useStore((s) => s.view)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const size = useThree((s) => s.size)
  const anim = useRef(null)

  useEffect(() => {
    if (!controls) return
    const doc = useStore.getState().doc
    const pose = viewPose(view.name, sceneBox(doc), size.width / size.height, FOV)
    const from = { position: camera.position.clone(), target: controls.target.clone() }
    if (view.nonce === 0) {
      camera.position.copy(pose.position)
      controls.target.copy(pose.target)
      controls.update()
      return
    }
    anim.current = { from, to: pose, t: 0 }
    const stop = () => { anim.current = null }
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [view, controls]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const a = anim.current
    if (!a || !controls) return
    a.t = Math.min(1, a.t + dt / 0.7)
    const k = 1 - Math.pow(1 - a.t, 3)
    camera.position.lerpVectors(a.from.position, a.to.position, k)
    controls.target.lerpVectors(a.from.target, a.to.target, k)
    controls.update()
    if (a.t >= 1) anim.current = null
  })
  return null
}

// ─── Drag handling ────────────────────────────────────────────────────────────
// Placing from the catalogue and moving placed items both project the pointer
// onto the floor plane. Listening on window keeps drags smooth even when the
// pointer passes over HTML overlays.
function DragController() {
  const placing = useStore((s) => s.placing)
  const moving = useStore((s) => s.moving)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    if (!placing && !moving) return
    const ray = new Raycaster()
    const floor = new Plane(new Vector3(0, 1, 0), 0)
    const ndc = new Vector2()
    const hit = new Vector3()

    const floorPoint = (e) => {
      const r = gl.domElement.getBoundingClientRect()
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return ray.ray.intersectPlane(floor, hit) ? { x: hit.x, z: hit.z, inside } : null
    }

    const onMove = (e) => {
      const s = useStore.getState()
      const p = floorPoint(e)
      if (s.placing) {
        if (!p || !p.inside) return s.setGhost(null)
        const def = getDef(s.placing.type, s.doc.customItems)
        const probe = { type: s.placing.type, w: s.placing.w, rotation: 0 }
        s.setGhost(constrainPosition(probe, def, p.x, p.z, s.doc, s.prefs))
      } else if (s.moving && p) {
        if (!dragState.moved) {
          if (Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY) < 4) return
          dragState.moved = true
          s.checkpoint()
        }
        const item = s.doc.items.find((i) => i.id === s.moving)
        if (!item) return
        const def = getDef(item.type, s.doc.customItems)
        const pos = constrainPosition(item, def, p.x + dragState.offsetX, p.z + dragState.offsetZ, s.doc, s.prefs)
        if (pos.x !== item.x || pos.z !== item.z) {
          s.mutate((d) => ({ ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, ...pos } : i)) }))
        }
      }
    }

    const onUp = () => {
      const s = useStore.getState()
      if (s.placing) {
        if (s.ghost) s.addItem(s.placing.type, s.placing.w, s.ghost.x, s.ghost.z)
        s.endPlacing()
      }
      if (s.moving) s.setMoving(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [placing, moving, camera, gl])

  return null
}

function Ghost() {
  const placing = useStore((s) => s.placing)
  const ghost = useStore((s) => s.ghost)
  const customItems = useStore((s) => s.doc.customItems)
  if (!placing || !ghost) return null
  const def = getDef(placing.type, customItems)
  if (!def) return null
  return (
    <group position={[ghost.x, 0, ghost.z]}>
      <ItemModel item={{ type: placing.type, w: placing.w }} def={def} ghost />
    </group>
  )
}

// Exposes the renderer to UI code (exports, file drops onto items).
function Bridge() {
  const three = useThree()
  useEffect(() => {
    viewport.three = three
  })
  return null
}

function Items() {
  const items = useStore((s) => s.doc.items)
  return items.map((item) => <PlacedItem key={item.id} item={item} />)
}

function Controls() {
  const placing = useStore((s) => s.placing)
  const moving = useStore((s) => s.moving)
  return (
    <OrbitControls
      makeDefault
      enabled={!placing && !moving}
      enableDamping
      dampingFactor={0.12}
      maxPolarAngle={Math.PI / 2 - 0.04}
      minDistance={1.2}
      maxDistance={80}
    />
  )
}

export default function Viewport() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: NeutralToneMapping }}
      camera={{ position: [-6, 6, 10], fov: FOV, near: 0.05, far: 500 }}
      onPointerMissed={(e) => e.button === 0 && useStore.getState().select(null)}
    >
      <Lighting />
      <Stand />
      <Items />
      <Ghost />
      <Controls />
      <CameraRig />
      <DragController />
      <Bridge />
    </Canvas>
  )
}
