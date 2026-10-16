import {
  rectOutline, circleOutline, kidneyOutline, openPolygon, perimeter, rotatePoint, extents,
} from './shapes'

// ─── Stock catalogue ──────────────────────────────────────────────────────────
// Dimensions in metres. `color` is the default finish of the printable
// surfaces when no artwork is applied. `surfaces` lists the graphic faces the
// item accepts; `graphicSize` returns the visible print area for one face.
//
// Keys match v1 .exposcene files so old layouts load unchanged.

const FRONT = [{ key: 'front', label: 'Front' }]
const FRONT_BACK = [{ key: 'front', label: 'Front' }, { key: 'back', label: 'Back' }]

export const PIXLIP_INSET = 0.025 // frame profile width on each edge
export const PULLUP_CASSETTE = 0.19

export const CATALOG = {
  pixlip: {
    label: 'Pixlip Lightbox',
    category: 'Lightboxes',
    blurb: 'Backlit SEG frame, double-sided',
    w: 2, d: 0.2, h: 2.5,
    variants: [1, 2, 3, 4].map((w) => ({ label: `${w} m`, w })),
    color: '#ffffff',
    lit: true,
    zone: 'back',
    surfaces: FRONT_BACK,
    graphicSize: (def, w) => ({ w: w - PIXLIP_INSET * 2, h: def.h - PIXLIP_INSET * 2 }),
  },
  backdrop: {
    label: 'Backdrop',
    category: 'Walls & banners',
    blurb: 'Fabric wall, double-sided',
    w: 3, d: 0.1, h: 2.5,
    zone: 'back',
    color: '#e4e7ec',
    surfaces: FRONT_BACK,
    graphicSize: (def, w) => ({ w, h: def.h }),
  },
  pullup: {
    label: 'Pull-up Banner',
    category: 'Walls & banners',
    blurb: 'Roll-up cassette banner',
    w: 0.85, d: 0.1, h: 2,
    color: '#e4e7ec',
    surfaces: FRONT,
    graphicSize: (def, w) => ({ w, h: def.h - PULLUP_CASSETTE }),
  },
  counter: {
    label: 'Counter',
    category: 'Counters & tables',
    blurb: 'Branded front, white worktop',
    w: 1, d: 0.5, h: 1,
    color: '#e4e7ec',
    surfaces: FRONT,
    graphicSize: (def, w) => ({ w, h: def.h }),
  },
  'curved-counter': {
    label: 'Curved Counter',
    category: 'Counters & tables',
    blurb: 'Kidney shape, full wrap graphic',
    w: 0.8, d: 0.5, h: 1,
    color: '#e4e7ec',
    surfaces: FRONT,
    outline: (def) => kidneyOutline(def.w, def.d),
    graphicSize: (def) => ({ w: perimeter(kidneyOutline(def.w, def.d)), h: def.h }),
  },
  'cylindrical-table': {
    label: 'Branded Drum Table',
    category: 'Counters & tables',
    blurb: 'Poseur table, wrapped pillar',
    w: 0.6, d: 0.6, h: 1.1,
    color: '#e4e7ec',
    surfaces: FRONT,
    outline: (def) => circleOutline(def.w / 2),
    graphicSize: (def) => ({ w: 2 * Math.PI * drumPillarRadius(def), h: def.h }),
  },
}

export const CATEGORIES = ['Lightboxes', 'Walls & banners', 'Counters & tables']

export function drumPillarRadius(def) {
  return (def.w / 2) * 0.9
}

// Custom items are simple boxes with a printable front.
export function makeCustomDef({ label, w, d, h, color, lit }) {
  return { label, w, d, h, color, lit: !!lit, custom: true, category: 'Custom' }
}

export function getDef(type, customItems) {
  const def = CATALOG[type] ?? customItems?.[type]
  if (!def) return null
  if (def.custom) {
    return {
      ...def,
      blurb: 'Custom item',
      surfaces: FRONT,
      graphicSize: (d, w) => ({ w, h: d.h }),
    }
  }
  return def
}

export function itemWidth(item, def) {
  return item.w ?? def.w
}

// Local plan outline (open polygon) for an item.
export function localOutline(item, def) {
  const w = itemWidth(item, def)
  if (def.outline) return openPolygon(def.outline({ ...def, w }))
  return rectOutline(w, def.d)
}

export function worldOutline(item, def) {
  return localOutline(item, def).map((p) => {
    const [x, z] = rotatePoint(p, item.rotation ?? 0)
    return [x + item.x, z + item.z]
  })
}

// Axis-aligned plan extents of the rotated item relative to its origin.
export function rotatedExtents(item, def, rotation = item.rotation ?? 0) {
  return extents(localOutline(item, def).map((p) => rotatePoint(p, rotation)))
}

export function localExtents(item, def) {
  return extents(localOutline(item, def))
}

export function surfaceSizes(item, def) {
  const w = itemWidth(item, def)
  return def.surfaces.map((s) => ({ ...s, size: def.graphicSize(def, w) }))
}

export function itemDisplayName(item, def) {
  if (def.variants) return `${def.label} ${itemWidth(item, def)} m`
  return def.label
}

export const mm = (m) => Math.round(m * 1000)
export const fmtM = (m) => `${Number(m).toFixed(2).replace(/\.?0+$/, '')} m`
export const fmtSize = ({ w, h }) => `${mm(w)} × ${mm(h)} mm`

// ─── Bill of materials ────────────────────────────────────────────────────────
// Component counts for one Pixlip frame of width w (metres). The 1 m frame is
// the verified spec; larger widths scale per 1 m bay.
export function pixlipComponents(w) {
  const bays = Math.round(w)
  return [
    { label: 'Horizontal poles', qty: bays },
    { label: 'Vertical poles', qty: (bays - 1) * 2 },
    { label: 'Corner connectors', qty: 4 },
    { label: 'Straight connectors', qty: bays * 2 },
    { label: 'Side pieces', qty: 4 },
    { label: 'Light pieces', qty: bays * 2 },
    { label: 'Pole connectors', qty: bays - 1 },
    { label: 'Feet', qty: bays + 1 },
  ].filter((c) => c.qty > 0)
}

export function billOfMaterials(items, customItems) {
  const lines = new Map()
  const pixlips = new Map()
  for (const item of items) {
    const def = getDef(item.type, customItems)
    if (!def) continue
    const name = itemDisplayName(item, def)
    const line = lines.get(name) ?? { label: name, qty: 0, type: item.type }
    line.qty++
    lines.set(name, line)
    if (item.type === 'pixlip') {
      const w = itemWidth(item, def)
      pixlips.set(w, (pixlips.get(w) ?? 0) + 1)
    }
  }
  const frames = [...pixlips.entries()]
    .sort(([a], [b]) => a - b)
    .map(([w, count]) => ({
      w,
      count,
      components: pixlipComponents(w).map((c) => ({ ...c, total: c.qty * count })),
    }))
  return { lines: [...lines.values()], frames }
}
