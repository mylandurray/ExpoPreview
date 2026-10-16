import { newDoc, newId } from './store'
import { CATALOG, getDef, makeCustomDef } from '../catalog/items'

// ─── .exposcene files ─────────────────────────────────────────────────────────

export function slugify(name) {
  return (name || 'stand').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'stand'
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function saveSceneFile(doc, includeGraphics = true) {
  const payload = {
    ...doc,
    version: 2,
    savedAt: new Date().toISOString(),
    items: includeGraphics ? doc.items : doc.items.map((it) => ({ ...it, graphics: {} })),
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  downloadBlob(blob, `${slugify(doc.project.name)}.exposcene`)
}

export const IMPORT_LIMITS = { fileBytes: 64 * 1024 * 1024, items: 500, customItems: 100, text: 10000, graphicChars: 16 * 1024 * 1024 }
const fail = (field) => { throw new Error(`Invalid ExpoPreview layout: ${field}.`) }
const object = (v, field) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(field)
  return v
}
const text = (v, field, limit = IMPORT_LIMITS.text) => {
  if (typeof v !== 'string' || v.length > limit) fail(field)
}
const number = (v, field, min, max) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(field)
}
const colour = (v, field) => { if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) fail(field) }
const oneOf = (v, values, field) => { if (!values.includes(v)) fail(field) }

export async function readSceneFile(file) {
  if (file.size > IMPORT_LIMITS.fileBytes) fail('file exceeds 64 MiB')
  let data
  try { data = JSON.parse(await file.text()) } catch { fail('malformed JSON') }
  return parseDocument(data)
}

export function parseDocument(data) {
  object(data, 'document')
  if (data.version === 1) return validateDocument(migrateV1(data))
  if (data.version !== 2) fail('unsupported version (expected 1 or 2)')
  const base = newDoc()
  for (const key of ['project', 'stand', 'scene', 'customItems']) {
    if (key in data) object(data[key], key)
  }
  if ('items' in data && !Array.isArray(data.items)) fail('items must be an array')
  const doc = {
    version: 2,
    project: { ...base.project, ...data.project },
    stand: { ...base.stand, ...data.stand },
    scene: { ...base.scene, ...data.scene },
    items: (data.items ?? []).map((it) => ({ color: null, graphics: {}, rotation: 0, w: null, ...object(it, 'item') })),
    customItems: data.customItems ?? {},
  }
  return validateDocument(doc)
}

export function validateDocument(doc) {
  for (const key of ['project', 'stand', 'scene', 'customItems']) object(doc[key], key)
  for (const key of ['name', 'client', 'notes']) text(doc.project[key], `project.${key}`)
  for (const key of ['width', 'depth']) number(doc.stand[key], `stand.${key}`, 1, 40)
  number(doc.stand.wallHeight, 'wall height', 1, 6)
  oneOf(doc.stand.type, ['island', 'peninsula', 'corner', 'inline'], 'stand type')
  for (const key of ['floorColor', 'wallColor']) colour(doc.stand[key], key)
  oneOf(doc.scene.background, ['colour', 'hdri'], 'background')
  oneOf(doc.scene.hdri, ['apartment', 'city', 'dawn', 'forest', 'lobby', 'night', 'park', 'studio', 'sunset', 'warehouse'], 'environment')
  if (typeof doc.scene.hall !== 'boolean') fail('hall')
  for (const key of ['backgroundColor', 'hallColor']) colour(doc.scene[key], key)
  if (Object.keys(doc.customItems).length > IMPORT_LIMITS.customItems) fail('too many custom definitions')
  for (const [key, def] of Object.entries(doc.customItems)) {
    if (!/^custom_[a-zA-Z0-9_-]+$/.test(key) || Object.hasOwn(CATALOG, key)) fail('custom key')
    object(def, 'custom definition')
    text(def.label, 'custom label', 200)
    for (const dim of ['w', 'd', 'h']) number(def[dim], `custom ${dim}`, 0.01, 40)
    colour(def.color, 'custom colour')
    if (def.custom !== true || typeof def.lit !== 'boolean') fail('custom flags')
  }
  if (!Array.isArray(doc.items) || doc.items.length > IMPORT_LIMITS.items) fail('items (maximum 500)')
  const ids = new Set()
  let artwork = 0
  for (const item of doc.items) {
    object(item, 'item')
    text(item.id, 'item ID', 100)
    if (!item.id || ids.has(item.id)) fail('duplicate or empty item ID')
    ids.add(item.id)
    text(item.type, 'item type', 100)
    if (!Object.hasOwn(CATALOG, item.type) && !Object.hasOwn(doc.customItems, item.type)) fail('unknown item type')
    const def = getDef(item.type, doc.customItems)
    if (def.variants) {
      if (item.w !== null && !def.variants.some((v) => v.w === item.w)) fail('unsupported width variant')
    } else if (item.w !== null) fail('unexpected item width')
    for (const axis of ['x', 'z']) number(item[axis], axis, -100, 100)
    number(item.rotation, 'rotation', -36000, 36000)
    if (item.color !== null) colour(item.color, 'item colour')
    object(item.graphics, 'graphics')
    for (const [side, value] of Object.entries(item.graphics)) {
      if (value === null) continue
      if (!def.surfaces.some((s) => s.key === side)) fail('graphic surface')
      text(value, 'artwork', IMPORT_LIMITS.graphicChars)
      if (!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(value)) fail('artwork must be an embedded PNG, JPEG or WebP')
      artwork += value.length
    }
  }
  if (artwork > IMPORT_LIMITS.fileBytes) fail('total artwork exceeds 64 MiB')
  return doc
}

// v1 viewed the stand from −Z with items rotated 180° to face the camera.
// v2 puts the aisle at +Z, so rotate the whole layout half a turn. The curved
// counter's model was also turned round in v2, so its rotation is unchanged.
function numberV1(value) { number(value, 'v1 coordinate', -36000, 36000); return value }

function migrateV1(data) {
  const s = object(data.scene, 'v1 scene')
  if ('placedItems' in s && !Array.isArray(s.placedItems)) fail('v1 placed items')
  if ('customItems' in s) object(s.customItems, 'v1 custom items')
  const doc = newDoc()
  doc.stand.width = s.standWidth === undefined ? doc.stand.width : s.standWidth
  doc.stand.depth = s.standDepth === undefined ? doc.stand.depth : s.standDepth
  doc.customItems = Object.fromEntries(
    Object.entries(s.customItems ?? {}).map(([key, def]) => [
      key,
      makeCustomDef({ ...def, lit: def.emissive && def.emissive !== '#000000' }),
    ])
  )
  doc.items = (s.placedItems ?? []).map((it) => ({
    id: newId(),
    type: it.type,
    w: it.w ?? null,
    x: it.x === undefined ? 0 : -numberV1(it.x),
    z: it.z === undefined ? 0 : -numberV1(it.z),
    rotation: ((((it.rotation === undefined ? 0 : numberV1(it.rotation)) + (it.type === 'curved-counter' ? 0 : 180)) % 360) + 360) % 360,
    color: null,
    graphics: { front: it.textureFront ?? null, back: it.textureBack ?? null },
  }))
  return doc
}

// ─── Autosave (IndexedDB — graphics are too big for localStorage) ─────────────

const DB_NAME = 'expopreview-studio'
const STORE = 'kv'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(req?.result)
    t.onerror = () => reject(t.error)
  })
}

export const loadAutosave = () => tx('readonly', (s) => s.get('autosave')).catch(() => null)
export const writeAutosave = (doc) => tx('readwrite', (s) => s.put(doc, 'autosave')).catch(() => {})
