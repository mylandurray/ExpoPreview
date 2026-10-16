import { useMemo } from 'react'
import { Color } from 'three'
import { useFrame } from '@react-three/fiber'
import { Grid, Html, Line } from '@react-three/drei'
import { useStore, STAND_TYPES } from '../state/store'
import { fmtM } from '../catalog/items'
import { applyWallCutaway } from './views'

const CARPET = 0.02
const WALL_T = 0.05
const POST = 0.035

// Clicking empty floor (without orbiting) clears the selection.
const deselect = (e) => {
  if (e.delta > 4) return
  useStore.getState().select(null)
}

function ShellWall({ side, edge, length, height, color, position, rotation }) {
  const posts = []
  const bays = Math.max(1, Math.round(length))
  for (let i = 0; i <= bays; i++) posts.push(-length / 2 + (length * i) / bays)
  return (
    <group position={position} rotation={rotation} userData={{ wall: { side, edge } }}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, height, WALL_T]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {posts.map((x) => (
        <mesh key={x} position={[x, height / 2, 0]} castShadow>
          <boxGeometry args={[POST, height, WALL_T + 0.02]} />
          <meshStandardMaterial color="#c3c7cd" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, height - 0.02, 0]}>
        <boxGeometry args={[length + POST, 0.04, WALL_T + 0.02]} />
        <meshStandardMaterial color="#c3c7cd" metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  )
}

function DimLabel({ position, children }) {
  return (
    <Html position={position} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className="dim-label">{children}</div>
    </Html>
  )
}

export default function Stand() {
  const stand = useStore((s) => s.doc.stand)
  const scene = useStore((s) => s.doc.scene)
  const prefs = useStore((s) => s.prefs)
  const { width: W, depth: D, wallHeight, wallColor, floorColor } = stand
  const walls = STAND_TYPES[stand.type]?.walls ?? []

  useFrame(({ scene: root, camera }) => applyWallCutaway(root, camera.position))

  // Grid lines a few shades lighter than the carpet so they guide without shouting.
  const gridColor = useMemo(() => {
    const c = new Color(floorColor)
    const hsl = {}
    c.getHSL(hsl)
    return new Color().setHSL(hsl.h, hsl.s * 0.6, hsl.l > 0.6 ? hsl.l - 0.12 : hsl.l + 0.14).getStyle()
  }, [floorColor])

  const edge = [[-W / 2, 0.004, -D / 2], [W / 2, 0.004, -D / 2], [W / 2, 0.004, D / 2], [-W / 2, 0.004, D / 2], [-W / 2, 0.004, -D / 2]]

  return (
    <group>
      {/* Hall floor */}
      {scene.hall && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -CARPET, 0]} receiveShadow onClick={deselect}>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color={scene.hallColor} roughness={0.95} />
        </mesh>
      )}

      {/* Carpet — top surface sits at y = 0 */}
      <mesh position={[0, -CARPET / 2, 0]} receiveShadow onClick={deselect}>
        <boxGeometry args={[W, CARPET, D]} />
        <meshStandardMaterial color={floorColor} roughness={1} />
      </mesh>

      {walls.includes('back') && (
        <ShellWall side="back" edge={-D / 2} length={W + (walls.includes('left') ? WALL_T : 0) + (walls.includes('right') ? WALL_T : 0)}
          height={wallHeight} color={wallColor}
          position={[((walls.includes('right') ? 1 : 0) - (walls.includes('left') ? 1 : 0)) * WALL_T / 2, 0, -D / 2 - WALL_T / 2]} />
      )}
      {walls.includes('left') && (
        <ShellWall side="left" edge={-W / 2} length={D} height={wallHeight} color={wallColor}
          position={[-W / 2 - WALL_T / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      )}
      {walls.includes('right') && (
        <ShellWall side="right" edge={W / 2} length={D} height={wallHeight} color={wallColor}
          position={[W / 2 + WALL_T / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
      )}

      {/* Editing guides — hidden from exports */}
      <group userData={{ helper: true }}>
        <Grid
          args={[W, D]}
          position={[0, 0.002, 0]}
          cellSize={prefs.gridSize}
          cellThickness={0.6}
          cellColor={gridColor}
          sectionSize={1}
          sectionThickness={1}
          sectionColor={gridColor}
          fadeDistance={80}
          fadeStrength={0}
          followCamera={false}
          infiniteGrid={false}
          side={2}
        />
        <Line points={edge} color="#0074c8" lineWidth={1.5} dashed dashSize={0.2} gapSize={0.12} />
        {prefs.showDims && (
          <>
            <DimLabel position={[0, 0, D / 2 + 0.35]}>{fmtM(W)}</DimLabel>
            <DimLabel position={[W / 2 + 0.45, 0, 0]}>{fmtM(D)}</DimLabel>
            <DimLabel position={[0, 0.01, D / 2 + 0.85]}><span className="dim-aisle">Front · aisle</span></DimLabel>
          </>
        )}
      </group>
    </group>
  )
}
