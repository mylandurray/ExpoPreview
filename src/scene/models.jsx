import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { useGraphicTexture } from './useGraphicTexture'
import {
  PIXLIP_INSET, PULLUP_CASSETTE, drumPillarRadius, itemWidth,
} from '../catalog/items'
import { kidneyOutline, circleOutline, openPolygon, perimeter } from '../catalog/shapes'

// Every model is built in item-local space: floor at y = 0, centred on the
// origin, printable front facing +Z. `ghost` renders a translucent preview
// (used while placing) and skips texture loading.

const ALU = '#c3c7cd'
const DARK = '#2a2d33'
const WORKTOP = '#f7f7f5'

function ghostProps(ghost) {
  return ghost ? { transparent: true, opacity: 0.45, depthWrite: false } : {}
}

function Part({ args, position, rotation, color, metalness = 0, roughness = 0.7, ghost, rounded, radius = 0.01 }) {
  const mat = <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} {...ghostProps(ghost)} />
  if (rounded) {
    return (
      <RoundedBox args={args} radius={radius} smoothness={3} position={position} rotation={rotation} castShadow={!ghost} receiveShadow={!ghost}>
        {mat}
      </RoundedBox>
    )
  }
  return (
    <mesh position={position} rotation={rotation} castShadow={!ghost} receiveShadow={!ghost}>
      <boxGeometry args={args} />
      {mat}
    </mesh>
  )
}

// A printable face. `lit` surfaces (lightbox fabric) are unlit/unshaded so the
// artwork reads at its true colours as if backlit.
function GraphicPlane({ url, w, h, position, rotation, color, lit, ghost }) {
  const tex = useGraphicTexture(ghost ? null : url, w, h)
  const tint = tex ? '#ffffff' : color
  return (
    <mesh position={position} rotation={rotation} receiveShadow={!lit && !ghost}>
      <planeGeometry args={[w, h]} />
      {lit ? (
        <meshBasicMaterial key={tex ? 'tex' : 'flat'} map={tex} color={tint} toneMapped={false} {...ghostProps(ghost)} />
      ) : (
        <meshStandardMaterial key={tex ? 'tex' : 'flat'} map={tex} color={tint} roughness={0.85} {...ghostProps(ghost)} />
      )}
    </mesh>
  )
}

// ─── Pixlip SEG lightbox ──────────────────────────────────────────────────────
function PixlipModel({ def, w, color, graphics, ghost }) {
  const { h, d } = def
  const t = PIXLIP_INSET
  const pw = w - t * 2
  const ph = h - t * 2
  const feetX = w / 2 - 0.12
  return (
    <group>
      <Part args={[w, t, d]} position={[0, h - t / 2, 0]} color={ALU} metalness={0.8} roughness={0.3} ghost={ghost} />
      <Part args={[w, t, d]} position={[0, t / 2, 0]} color={ALU} metalness={0.8} roughness={0.3} ghost={ghost} />
      <Part args={[t, h - t * 2, d]} position={[-w / 2 + t / 2, h / 2, 0]} color={ALU} metalness={0.8} roughness={0.3} ghost={ghost} />
      <Part args={[t, h - t * 2, d]} position={[w / 2 - t / 2, h / 2, 0]} color={ALU} metalness={0.8} roughness={0.3} ghost={ghost} />
      {/* Light box interior — casts the shadow the fabric faces can't */}
      {!ghost && (
        <mesh position={[0, h / 2, 0]} castShadow>
          <boxGeometry args={[pw, ph, d - 0.02]} />
          <meshBasicMaterial color="#f8f8f8" />
        </mesh>
      )}
      <GraphicPlane lit url={graphics.front} w={pw} h={ph} position={[0, h / 2, d / 2 - 0.004]} color={color} ghost={ghost} />
      <GraphicPlane lit url={graphics.back} w={pw} h={ph} position={[0, h / 2, -d / 2 + 0.004]} rotation={[0, Math.PI, 0]} color={color} ghost={ghost} />
      {[-feetX, feetX].map((x) => (
        <Part key={x} args={[0.06, 0.015, 0.45]} position={[x, 0.0075, 0]} color={ALU} metalness={0.8} roughness={0.35} ghost={ghost} />
      ))}
    </group>
  )
}

// ─── Backdrop wall ────────────────────────────────────────────────────────────
function BackdropModel({ def, w, color, graphics, ghost }) {
  const { h, d } = def
  const z = d / 2 + 0.002
  return (
    <group>
      <Part args={[w, h, d]} position={[0, h / 2, 0]} color="#d9dce0" roughness={0.9} ghost={ghost} />
      <GraphicPlane url={graphics.front} w={w} h={h} position={[0, h / 2, z]} color={color} ghost={ghost} />
      <GraphicPlane url={graphics.back} w={w} h={h} position={[0, h / 2, -z]} rotation={[0, Math.PI, 0]} color={color} ghost={ghost} />
      {[-w / 2 + 0.05, w / 2 - 0.05].map((x) => (
        <Part key={x} args={[0.05, 0.02, 0.5]} position={[x, 0.01, 0]} color={ALU} metalness={0.8} roughness={0.35} ghost={ghost} />
      ))}
    </group>
  )
}

// ─── Pull-up banner ───────────────────────────────────────────────────────────
function PullupModel({ def, w, color, graphics, ghost }) {
  const cassette = PULLUP_CASSETTE
  const ph = def.h - cassette
  return (
    <group>
      <Part rounded radius={0.03} args={[w + 0.07, cassette, 0.13]} position={[0, cassette / 2, 0]} color={ALU} metalness={0.75} roughness={0.35} ghost={ghost} />
      <Part args={[w + 0.02, 0.012, 0.3]} position={[0, 0.006, 0]} color={DARK} roughness={0.6} ghost={ghost} />
      <Part args={[w, ph, 0.004]} position={[0, cassette + ph / 2, 0]} color="#f2f2f2" roughness={0.8} ghost={ghost} />
      <GraphicPlane url={graphics.front} w={w} h={ph} position={[0, cassette + ph / 2, 0.003]} color={color} ghost={ghost} />
      <Part args={[w, 0.02, 0.02]} position={[0, def.h - 0.01, 0]} color={ALU} metalness={0.8} roughness={0.3} ghost={ghost} />
      <mesh position={[0, cassette + ph / 2, -0.03]} castShadow={!ghost}>
        <cylinderGeometry args={[0.008, 0.008, ph, 12]} />
        <meshStandardMaterial color={ALU} metalness={0.8} roughness={0.3} {...ghostProps(ghost)} />
      </mesh>
    </group>
  )
}

// ─── Straight counter ─────────────────────────────────────────────────────────
function CounterModel({ def, w, color, graphics, ghost }) {
  const { h, d } = def
  const top = 0.03
  return (
    <group>
      <Part args={[w, h, d]} position={[0, h / 2, 0]} color={color} roughness={0.7} ghost={ghost} />
      <Part rounded radius={0.01} args={[w + 0.04, top, d + 0.04]} position={[0, h + top / 2, 0]} color={WORKTOP} roughness={0.25} ghost={ghost} />
      <GraphicPlane url={graphics.front} w={w} h={h} position={[0, h / 2, d / 2 + 0.002]} color={color} ghost={ghost} />
    </group>
  )
}

// ─── Wrapped solids (curved counter, drum table) ─────────────────────────────
// Side wall with arc-length UVs so artwork wraps without stretching.
function useWrapGeometry(closedPts, h) {
  return useMemo(() => {
    const open = openPolygon(closedPts)
    let area = 0
    for (let i = 0; i < open.length; i++) {
      const [x0, z0] = open[i]
      const [x1, z1] = open[(i + 1) % open.length]
      area += x0 * z1 - x1 * z0
    }
    const ccw = area > 0

    const total = perimeter(closedPts)
    const pos = [], uv = [], norm = [], idx = []
    let run = 0
    let mirrored = null
    for (let i = 0; i < closedPts.length - 1; i++) {
      const [x0, z0] = closedPts[i]
      const [x1, z1] = closedPts[i + 1]
      const dx = x1 - x0, dz = z1 - z0
      const len = Math.hypot(dx, dz) || 1e-6
      // Outward normal in plan.
      const nx = (ccw ? dz : -dz) / len
      const nz = (ccw ? -dx : dx) / len
      // Viewed from outside, u must increase to the viewer's right.
      if (mirrored === null) mirrored = dx * nz - dz * nx < 0
      const u0 = run / total
      run += len
      const u1 = run / total
      const [a, b] = mirrored ? [1 - u0, 1 - u1] : [u0, u1]
      const v = pos.length / 3
      pos.push(x0, 0, z0, x1, 0, z1, x0, h, z0, x1, h, z1)
      uv.push(a, 0, b, 0, a, 1, b, 1)
      for (let k = 0; k < 4; k++) norm.push(nx, 0, nz)
      // Triangle (b0, b1, t0) faces (−dz, 0, dx); flip if that's inward.
      if (-dz * nx + dx * nz > 0) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
      else idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3))
    g.setIndex(idx)
    g.computeBoundingSphere()
    return { geometry: g, perimeter: total }
  }, [closedPts, h])
}

function capShape(closedPts, scale = 1) {
  // Shape lives in XY; rotating it −90° about X maps shape y → world −z.
  return new THREE.Shape(openPolygon(closedPts).map(([x, z]) => new THREE.Vector2(x * scale, -z * scale)))
}

function WrappedSide({ pts, h, url, color, ghost }) {
  const { geometry, perimeter: len } = useWrapGeometry(pts, h)
  const tex = useGraphicTexture(ghost ? null : url, len, h)
  return (
    <mesh geometry={geometry} castShadow={!ghost} receiveShadow={!ghost}>
      <meshStandardMaterial key={tex ? 'tex' : 'flat'} map={tex} color={tex ? '#ffffff' : color} roughness={0.8} {...ghostProps(ghost)} />
    </mesh>
  )
}

function CurvedCounterModel({ def, color, graphics, ghost }) {
  const pts = useMemo(() => kidneyOutline(def.w, def.d), [def.w, def.d])
  const top = useMemo(() => capShape(pts, 1.05), [pts])
  const base = useMemo(() => capShape(pts, 0.98), [pts])
  return (
    <group>
      <WrappedSide pts={pts} h={def.h} url={graphics.front} color={color} ghost={ghost} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, def.h, 0]} castShadow={!ghost} receiveShadow={!ghost}>
        <extrudeGeometry args={[top, { depth: 0.03, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 }]} />
        <meshStandardMaterial color={WORKTOP} roughness={0.25} {...ghostProps(ghost)} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <shapeGeometry args={[base]} />
        <meshStandardMaterial color={DARK} {...ghostProps(ghost)} />
      </mesh>
    </group>
  )
}

function DrumTableModel({ def, color, graphics, ghost }) {
  const r = drumPillarRadius(def)
  const pts = useMemo(() => circleOutline(r), [r])
  const cap = 0.03
  return (
    <group>
      <WrappedSide pts={pts} h={def.h} url={graphics.front} color={color} ghost={ghost} />
      <mesh position={[0, def.h + cap / 2, 0]} castShadow={!ghost} receiveShadow={!ghost}>
        <cylinderGeometry args={[def.w / 2, def.w / 2, cap, 64]} />
        <meshStandardMaterial color={WORKTOP} roughness={0.25} {...ghostProps(ghost)} />
      </mesh>
      <mesh position={[0, cap / 2, 0]} castShadow={!ghost} receiveShadow={!ghost}>
        <cylinderGeometry args={[def.w / 2, def.w / 2, cap, 64]} />
        <meshStandardMaterial color={DARK} roughness={0.8} {...ghostProps(ghost)} />
      </mesh>
    </group>
  )
}

// ─── Custom items ─────────────────────────────────────────────────────────────
function CustomModel({ def, w, color, graphics, ghost }) {
  const { h, d } = def
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow={!ghost} receiveShadow={!ghost}>
        <boxGeometry args={[w, h, d]} />
        {def.lit
          ? <meshBasicMaterial color={color} toneMapped={false} {...ghostProps(ghost)} />
          : <meshStandardMaterial color={color} roughness={0.7} {...ghostProps(ghost)} />}
      </mesh>
      <GraphicPlane lit={def.lit} url={graphics.front} w={w} h={h} position={[0, h / 2, d / 2 + 0.002]} color={color} ghost={ghost} />
    </group>
  )
}

const MODELS = {
  pixlip: PixlipModel,
  backdrop: BackdropModel,
  pullup: PullupModel,
  counter: CounterModel,
  'curved-counter': CurvedCounterModel,
  'cylindrical-table': DrumTableModel,
}

const NO_GRAPHICS = {}

export default function ItemModel({ item, def, ghost = false }) {
  const Model = MODELS[item.type] ?? CustomModel
  return (
    <Model
      def={def}
      w={itemWidth(item, def)}
      color={item.color ?? def.color}
      graphics={item.graphics ?? NO_GRAPHICS}
      ghost={ghost}
    />
  )
}
