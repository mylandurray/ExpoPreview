import { create } from 'zustand'
import { getDef, rotatedExtents } from '../catalog/items'

// ─── Document ─────────────────────────────────────────────────────────────────
// Everything in `doc` is saved to file, autosaved and covered by undo/redo.
// UI state (selection, drags, preferences) lives alongside it but outside
// history.

export const STAND_TYPES = {
  island:    { label: 'Island',    walls: [] },
  peninsula: { label: 'Peninsula', walls: ['back'] },
  corner:    { label: 'Corner',    walls: ['back', 'left'] },
  inline:    { label: 'Inline',    walls: ['back', 'left', 'right'] },
}

export function newDoc() {
  return {
    version: 2,
    project: { name: 'Untitled stand', client: '', notes: '' },
    stand: {
      width: 6,
      depth: 4,
      type: 'island',
      wallHeight: 2.5,
      floorColor: '#3a4150',
      wallColor: '#f3f3f1',
    },
    scene: {
      background: 'colour', // 'colour' | 'hdri'
      backgroundColor: '#e8ebef',
      hdri: 'warehouse',
      hall: true,
      hallColor: '#d3d6db',
    },
    items: [],
    customItems: {},
  }
}

export const newId = () =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 10)

const HISTORY_LIMIT = 100
const MERGE_WINDOW_MS = 1200

// ─── Preferences (per browser) ────────────────────────────────────────────────
const PREFS_KEY = 'expopreview-studio:prefs'
const DEFAULT_PREFS = { snap: true, gridSize: 0.5, keepInside: true, showDims: true, theme: 'light' }

function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }
  } catch {
    return DEFAULT_PREFS
  }
}

function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* private mode */ }
}

// ─── Layout helpers ───────────────────────────────────────────────────────────
export function snapTo(v, step) {
  return Math.round(v / step) * step
}

// Snap (optionally) and keep the item's rotated footprint inside the stand.
export function constrainPosition(item, def, x, z, doc, prefs) {
  if (prefs.snap) {
    x = snapTo(x, prefs.gridSize)
    z = snapTo(z, prefs.gridSize)
  }
  if (prefs.keepInside) {
    const { width, depth } = doc.stand
    const e = rotatedExtents(item, def)
    x = clampRange(x, -width / 2 - e.minX, width / 2 - e.maxX)
    z = clampRange(z, -depth / 2 - e.minZ, depth / 2 - e.maxZ)
  }
  return { x: round3(x), z: round3(z) }
}

function clampRange(v, lo, hi) {
  if (lo > hi) return (lo + hi) / 2 // item larger than the stand: centre it
  return Math.min(hi, Math.max(lo, v))
}

const round3 = (v) => Math.round(v * 1000) / 1000

const mapItem = (doc, id, fn) => ({
  ...doc,
  items: doc.items.map((it) => (it.id === id ? fn(it) : it)),
})

// ─── Store ────────────────────────────────────────────────────────────────────
export const useStore = create((set, get) => {
  let lastCommit = { key: null, at: 0 }

  const commit = (recipe, mergeKey = null) => {
    const now = Date.now()
    const merge = mergeKey && lastCommit.key === mergeKey && now - lastCommit.at < MERGE_WINDOW_MS
    lastCommit = { key: mergeKey, at: now }
    set((s) => {
      const next = recipe(s.doc)
      if (next === s.doc) return {}
      return merge
        ? { doc: next }
        : { doc: next, past: [...s.past, s.doc].slice(-HISTORY_LIMIT), future: [] }
    })
  }

  const prefs = loadPrefs()

  return {
    doc: newDoc(),
    cleanDoc: null,
    recoveryDoc: null,
    replacement: null,
    past: [],
    future: [],

    prefs,
    selectedId: null,
    hoverId: null,
    placing: null,   // { type, w } while dragging from the catalogue
    ghost: null,     // { x, z } ghost position while placing
    moving: null,    // id of the item being dragged in the viewport
    view: { name: 'hero', nonce: 0 },
    exportOpen: false,
    helpOpen: false,
    mobilePanel: null, // 'catalogue' | 'inspector' — which bottom sheet is open on phones
    helpTopic: 'start',
    toasts: [],

    // ── History ──
    commit,
    // Snapshot before a live edit (e.g. dragging); follow with `mutate`.
    checkpoint: () => {
      lastCommit = { key: null, at: 0 }
      set((s) => ({ past: [...s.past, s.doc].slice(-HISTORY_LIMIT), future: [] }))
    },
    mutate: (recipe) => set((s) => ({ doc: recipe(s.doc) })),
    undo: () => set((s) => {
      if (!s.past.length) return {}
      lastCommit = { key: null, at: 0 }
      const doc = s.past[s.past.length - 1]
      return { doc, past: s.past.slice(0, -1), future: [s.doc, ...s.future], ...keepSelection(doc, s.selectedId) }
    }),
    redo: () => set((s) => {
      if (!s.future.length) return {}
      lastCommit = { key: null, at: 0 }
      const doc = s.future[0]
      return { doc, past: [...s.past, s.doc], future: s.future.slice(1), ...keepSelection(doc, s.selectedId) }
    }),

    loadDoc: (doc, clean = true) => {
      lastCommit = { key: null, at: 0 }
      set((s) => ({ doc, cleanDoc: clean ? JSON.stringify(doc) : '__recovered__', recoveryDoc: s.doc, past: [], future: [], selectedId: null, hoverId: null, placing: null, ghost: null, moving: null, exportOpen: false }))
    },
    markSaved: (doc) => set({ cleanDoc: JSON.stringify(doc) }),
    setReplacement: (replacement) => set({ replacement }),

    // ── Preferences ──
    setPref: (key, value) => {
      const next = { ...get().prefs, [key]: value }
      savePrefs(next)
      set({ prefs: next })
    },

    // ── Project / stand / scene ──
    setProject: (patch) => commit((d) => ({ ...d, project: { ...d.project, ...patch } }), 'project:' + Object.keys(patch)),
    setStand: (patch, mergeKey) => commit((d) => ({ ...d, stand: { ...d.stand, ...patch } }), mergeKey),
    setScene: (patch, mergeKey) => commit((d) => ({ ...d, scene: { ...d.scene, ...patch } }), mergeKey),

    // ── Items ──
    addItem: (type, w, x, z) => {
      const { doc, prefs } = get()
      const def = getDef(type, doc.customItems)
      if (!def) return
      const item = { id: newId(), type, w: def.variants ? w ?? def.w : null, x: 0, z: 0, rotation: 0, color: null, graphics: {} }
      Object.assign(item, constrainPosition(item, def, x, z, doc, prefs))
      commit((d) => ({ ...d, items: [...d.items, item] }))
      set({ selectedId: item.id })
      return item.id
    },

    // Click-to-add: walls and lightboxes go along the back, everything else
    // fills in from the front, working outwards from the centre line.
    addItemAuto: (type, w) => {
      const { doc, prefs } = get()
      const def = getDef(type, doc.customItems)
      if (!def) return
      const probe = { type, w: def.variants ? w ?? def.w : null, rotation: 0 }
      const e = rotatedExtents(probe, def)
      const { width, depth } = doc.stand
      const taken = doc.items.map((it) => {
        const d = getDef(it.type, doc.customItems)
        const x = d ? rotatedExtents(it, d) : { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
        return { minX: it.x + x.minX, maxX: it.x + x.maxX, minZ: it.z + x.minZ, maxZ: it.z + x.maxZ }
      })
      const gap = 0.1
      const free = (x, z) => taken.every((t) =>
        x + e.maxX + gap <= t.minX || x + e.minX - gap >= t.maxX || z + e.maxZ + gap <= t.minZ || z + e.minZ - gap >= t.maxZ)

      const step = prefs.snap ? Math.max(prefs.gridSize, 0.25) : 0.25
      const back = def.zone === 'back'
      const zStart = back ? -depth / 2 - e.minZ : depth / 2 - e.maxZ - 0.5
      for (let row = 0; row * step <= depth; row++) {
        const z = zStart + (back ? row : -row) * step
        for (let i = 0; i * step <= width / 2 + 0.01; i++) {
          for (const x of i ? [i * step, -i * step] : [0]) {
            const pos = constrainPosition(probe, def, x, z, doc, prefs)
            if (free(pos.x, pos.z)) return get().addItem(type, w, pos.x, pos.z)
          }
        }
      }
      return get().addItem(type, w, 0, 0)
    },

    updateItem: (id, patch, mergeKey) => {
      const { prefs } = get()
      commit((d) => mapItem(d, id, (it) => {
        const next = { ...it, ...patch }
        const def = getDef(next.type, d.customItems)
        // Resizing or rotating can push a footprint out of bounds; re-constrain.
        if (('w' in patch || 'rotation' in patch) && prefs.keepInside) {
          Object.assign(next, constrainPosition(next, def, next.x, next.z, d, { ...prefs, snap: false }))
        }
        return next
      }), mergeKey)
    },

    rotateItem: (id, delta) => {
      const item = get().doc.items.find((i) => i.id === id)
      if (!item) return
      get().updateItem(id, { rotation: (((item.rotation ?? 0) + delta) % 360 + 360) % 360 })
    },

    nudgeItem: (id, dx, dz) => {
      const { doc, prefs } = get()
      const item = doc.items.find((i) => i.id === id)
      if (!item) return
      const def = getDef(item.type, doc.customItems)
      const pos = constrainPosition(item, def, item.x + dx, item.z + dz, doc, { ...prefs, snap: false })
      commit((d) => mapItem(d, id, (it) => ({ ...it, ...pos })), 'nudge:' + id)
    },

    setGraphic: (id, surface, url) =>
      commit((d) => mapItem(d, id, (it) => ({ ...it, graphics: { ...it.graphics, [surface]: url } }))),

    removeItem: (id) => {
      commit((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }))
      set((s) => ({ selectedId: s.selectedId === id ? null : s.selectedId }))
    },

    duplicateItem: (id) => {
      const { doc, prefs } = get()
      const src = doc.items.find((i) => i.id === id)
      if (!src) return
      const def = getDef(src.type, doc.customItems)
      const e = rotatedExtents(src, def)
      const copy = { ...src, id: newId(), graphics: { ...src.graphics } }
      Object.assign(copy, constrainPosition(copy, def, src.x + (e.maxX - e.minX) + 0.1, src.z, doc, { ...prefs, snap: false }))
      commit((d) => ({ ...d, items: [...d.items, copy] }))
      set({ selectedId: copy.id })
    },

    // ── Custom items ──
    addCustomItem: (def) => {
      const key = 'custom_' + newId()
      commit((d) => ({ ...d, customItems: { ...d.customItems, [key]: def } }))
      return key
    },
    removeCustomItem: (key) => {
      commit((d) => {
        const { [key]: _removed, ...rest } = d.customItems
        return { ...d, customItems: rest, items: d.items.filter((it) => it.type !== key) }
      })
      set((s) => ({ selectedId: s.doc.items.some((i) => i.id === s.selectedId) ? s.selectedId : null }))
    },

    // ── Interaction ──
    select: (id) => set({ selectedId: id }),
    setHover: (id) => set({ hoverId: id }),
    startPlacing: (type, w) => set({ placing: { type, w }, ghost: null, selectedId: null }),
    setGhost: (ghost) => set({ ghost }),
    endPlacing: () => set({ placing: null, ghost: null }),
    setMoving: (id) => set({ moving: id }),
    setView: (name) => set((s) => ({ view: { name, nonce: s.view.nonce + 1 } })),
    setExportOpen: (exportOpen) => set({ exportOpen }),
    setMobilePanel: (mobilePanel) => set({ mobilePanel }),
    setHelpOpen: (helpOpen, topic) => set((s) => ({ helpOpen, helpTopic: topic ?? s.helpTopic })),

    toast: (message, tone = 'info') => {
      const id = newId()
      set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200)
    },
  }
})

function keepSelection(doc, selectedId) {
  return { selectedId: doc.items.some((i) => i.id === selectedId) ? selectedId : null }
}


// Handy for poking at state from the browser console during development.
if (import.meta.env?.DEV) window.__store = useStore
