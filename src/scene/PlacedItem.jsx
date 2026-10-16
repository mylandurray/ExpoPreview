import { memo, useMemo } from 'react'
import { BoxGeometry, Plane, Vector3 } from 'three'
import { Line } from '@react-three/drei'
import { useStore } from '../state/store'
import { getDef, localOutline, localExtents } from '../catalog/items'
import ItemModel from './models'
import { dragState } from './dragState'

const FLOOR = new Plane(new Vector3(0, 1, 0), 0)
const hit = new Vector3()

function PlacedItem({ item }) {
  const customItems = useStore((s) => s.doc.customItems)
  const selected = useStore((s) => s.selectedId === item.id)
  const hovered = useStore((s) => s.hoverId === item.id)
  const def = getDef(item.type, customItems)

  const outline = useMemo(() => {
    if (!def) return null
    const pts = localOutline(item, def).map(([x, z]) => [x, 0.012, z])
    return [...pts, pts[0]]
  }, [def, item.w, item.type]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectionBox = useMemo(() => {
    if (!def || !selected) return null
    const ex = localExtents(item, def)
    return new BoxGeometry(ex.maxX - ex.minX + 0.04, def.h + 0.08, ex.maxZ - ex.minZ + 0.04)
  }, [def, selected, item.w, item.type]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!def) return null

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const s = useStore.getState()
    s.select(item.id)
    if (!e.ray.intersectPlane(FLOOR, hit)) return
    Object.assign(dragState, {
      offsetX: item.x - hit.x,
      offsetZ: item.z - hit.z,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    })
    s.setMoving(item.id)
  }

  const e = localExtents(item, def)

  return (
    <group
      position={[item.x, 0, item.z]}
      rotation={[0, ((item.rotation ?? 0) * Math.PI) / 180, 0]}
      userData={{ itemId: item.id }}
      onPointerDown={onPointerDown}
      // Stop the click reaching the floor behind, which would deselect.
      onClick={(ev) => ev.stopPropagation()}
      onPointerOver={(ev) => {
        ev.stopPropagation()
        useStore.getState().setHover(item.id)
        document.body.style.cursor = 'grab'
      }}
      onPointerOut={() => {
        if (useStore.getState().hoverId === item.id) useStore.getState().setHover(null)
        document.body.style.cursor = ''
      }}
      onContextMenu={(ev) => { ev.stopPropagation(); ev.nativeEvent.preventDefault(); useStore.getState().select(item.id) }}
    >
      <ItemModel item={item} def={def} />

      {(selected || hovered) && (
        <group userData={{ helper: true }}>
          <Line points={outline} color={selected ? '#0074c8' : '#7fb6e4'} lineWidth={selected ? 2.5 : 1.5} />
          {selected && (
            <lineSegments position={[(e.minX + e.maxX) / 2, def.h / 2 + 0.02, (e.minZ + e.maxZ) / 2]}>
              <edgesGeometry args={[selectionBox]} />
              <lineBasicMaterial color="#0074c8" transparent opacity={0.55} />
            </lineSegments>
          )}
        </group>
      )}
    </group>
  )
}

export default memo(PlacedItem)
