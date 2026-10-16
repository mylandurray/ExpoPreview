import { useEffect, useRef, useState } from 'react'
import {
  Copy, Trash2, RotateCcw, RotateCw, ImagePlus, X, Upload, ArrowLeftRight, Loader2, ClipboardList, SlidersHorizontal, Boxes,
} from 'lucide-react'
import { useStore, STAND_TYPES } from '../state/store'
import {
  getDef, itemWidth, surfaceSizes, fmtSize, fmtM, billOfMaterials, itemDisplayName,
} from '../catalog/items'
import { ACCEPTED_GRAPHICS, fileToGraphic, isGraphicFile } from '../utils/files'
import { ItemGlyph, NumberField, Segmented, Swatches, Switch } from './controls'

const FLOOR_COLOURS = ['#3a4150', '#1f2329', '#6b7280', '#c9ccd1', '#f2f2f0', '#2f4a7a', '#7a2f35']
const WALL_COLOURS = ['#f3f3f1', '#ffffff', '#d7dade', '#2b2f36', '#2f4a7a']
const BG_COLOURS = ['#e8ebef', '#ffffff', '#cfd6df', '#20242b', '#0d0f13']
const FINISH_COLOURS = ['#e4e7ec', '#ffffff', '#1f2329', '#0074c8', '#e5484d', '#f5a524', '#30a46c']

const HDRI_PRESETS = [
  ['warehouse', 'Warehouse'], ['lobby', 'Lobby'], ['studio', 'Studio'], ['city', 'City'],
  ['apartment', 'Apartment'], ['sunset', 'Sunset'], ['dawn', 'Dawn'], ['night', 'Night'], ['forest', 'Forest'],
]

// ─── Stand icons for the stand-type picker ───────────────────────────────────
function StandTypeIcon({ walls }) {
  return (
    <svg width="34" height="24" viewBox="0 0 34 24" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="24" height="16" rx="1.5" fill="currentColor" opacity="0.14" />
      {walls.includes('back') && <path d="M4 3.5h26" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
      {walls.includes('left') && <path d="M4 3.5v17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
      {walls.includes('right') && <path d="M30 3.5v17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
    </svg>
  )
}

// ─── Stand & scene settings (nothing selected) ────────────────────────────────
function StandPanel() {
  const stand = useStore((s) => s.doc.stand)
  const scene = useStore((s) => s.doc.scene)
  const prefs = useStore((s) => s.prefs)
  const setStand = useStore((s) => s.setStand)
  const setScene = useStore((s) => s.setScene)
  const setPref = useStore((s) => s.setPref)
  const hasWalls = STAND_TYPES[stand.type].walls.length > 0

  return (
    <>
      <div className="section">
        <div className="section-title">Stand</div>
        <div className="stack">
          <div className="grid-2">
            <NumberField label="Width" value={stand.width} min={1} max={40} step={0.5} onChange={(v) => setStand({ width: v }, 'stand:w')} />
            <NumberField label="Depth" value={stand.depth} min={1} max={40} step={0.5} onChange={(v) => setStand({ depth: v }, 'stand:d')} />
          </div>
          <div className="hint">{(stand.width * stand.depth).toFixed(1)} m² floor space</div>
          <div className="field">
            <span>Stand type</span>
            <Segmented
              tall
              ariaLabel="Stand type"
              value={stand.type}
              onChange={(v) => setStand({ type: v })}
              options={Object.entries(STAND_TYPES).map(([k, t]) => ({
                value: k, label: t.label, icon: <StandTypeIcon walls={t.walls} />,
                title: t.walls.length ? `${t.label}: walls at ${t.walls.join(', ')}` : 'Island: open on all sides',
              }))}
            />
          </div>
          {hasWalls && (
            <NumberField label="Wall height" value={stand.wallHeight} min={1} max={6} step={0.1} onChange={(v) => setStand({ wallHeight: v }, 'stand:wh')} />
          )}
          <div className="field">
            <span>Floor</span>
            <Swatches value={stand.floorColor} presets={FLOOR_COLOURS} onChange={(c) => setStand({ floorColor: c }, 'stand:floor')} label="Floor colour" />
          </div>
          {hasWalls && (
            <div className="field">
              <span>Walls</span>
              <Swatches value={stand.wallColor} presets={WALL_COLOURS} onChange={(c) => setStand({ wallColor: c }, 'stand:wall')} label="Wall colour" />
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Surroundings</div>
        <div className="stack">
          <Segmented
            ariaLabel="Background"
            value={scene.background}
            onChange={(v) => setScene({ background: v })}
            options={[{ value: 'colour', label: 'Studio' }, { value: 'hdri', label: 'Environment' }]}
          />
          {scene.background === 'colour' ? (
            <div className="field">
              <span>Backdrop</span>
              <Swatches value={scene.backgroundColor} presets={BG_COLOURS} onChange={(c) => setScene({ backgroundColor: c }, 'scene:bg')} label="Background colour" />
            </div>
          ) : (
            <label className="field">
              <span>Environment</span>
              <select className="select" value={scene.hdri} onChange={(e) => setScene({ hdri: e.target.value })}>
                {HDRI_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span className="hint">Photographic backdrops load from the internet.</span>
            </label>
          )}
          <Switch label="Hall floor" checked={scene.hall} onChange={(v) => setScene({ hall: v })} />
          {scene.hall && (
            <div className="field">
              <span>Hall floor colour</span>
              <Swatches value={scene.hallColor} presets={['#d3d6db', '#b9bdc4', '#8d929a', '#e9e6e0', '#3a3d42']} onChange={(c) => setScene({ hallColor: c }, 'scene:hall')} label="Hall floor colour" />
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Editing</div>
        <div className="stack">
          <Switch label="Snap to grid" checked={prefs.snap} onChange={(v) => setPref('snap', v)} />
          {prefs.snap && (
            <Segmented
              ariaLabel="Grid size"
              value={prefs.gridSize}
              onChange={(v) => setPref('gridSize', v)}
              options={[0.1, 0.25, 0.5, 1].map((g) => ({ value: g, label: `${g * 100} cm` }))}
            />
          )}
          <Switch label="Keep items on the stand" hint="Stops items being dragged past the edge." checked={prefs.keepInside} onChange={(v) => setPref('keepInside', v)} />
          <Switch label="Show dimensions" checked={prefs.showDims} onChange={(v) => setPref('showDims', v)} />
        </div>
      </div>
    </>
  )
}

// ─── Graphic upload slot ──────────────────────────────────────────────────────
function GraphicSlot({ itemId, surface, url }) {
  const setGraphic = useStore((s) => s.setGraphic)
  const input = useRef()
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  const apply = async (file) => {
    if (!isGraphicFile(file)) {
      useStore.getState().toast('Use an image (PNG, JPG, WebP) or a PDF.', 'error')
      return
    }
    setBusy(true)
    try {
      setGraphic(itemId, surface.key, await fileToGraphic(file))
    } catch (err) {
      console.error(err)
      useStore.getState().toast('Couldn’t read that file.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`graphic-slot${url ? ' filled' : ''}${over ? ' drop' : ''}`}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); apply(e.dataTransfer.files[0]) }}
    >
      <button type="button" className="graphic-thumb" onClick={() => input.current.click()} title={url ? 'Replace artwork' : 'Upload artwork'}>
        {busy ? <Loader2 size={20} className="spin" /> : url ? <img src={url} alt={`${surface.label} artwork`} /> : <ImagePlus size={22} />}
      </button>
      <div className="graphic-info">
        <strong>{surface.label}</strong>
        <span className="hint">{fmtSize(surface.size)}</span>
        <div className="graphic-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => input.current.click()}>
            <Upload size={13} /> {url ? 'Replace' : 'Upload'}
          </button>
          {url && (
            <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => setGraphic(itemId, surface.key, null)} title="Remove artwork">
              <X size={13} /> Remove
            </button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept={ACCEPTED_GRAPHICS} hidden onChange={(e) => { apply(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}

// ─── Selected item ────────────────────────────────────────────────────────────
function ItemPanel({ item }) {
  const customItems = useStore((s) => s.doc.customItems)
  const updateItem = useStore((s) => s.updateItem)
  const rotateItem = useStore((s) => s.rotateItem)
  const def = getDef(item.type, customItems)
  if (!def) return null
  const w = itemWidth(item, def)
  const surfaces = surfaceSizes(item, def)
  const rotation = Math.round(item.rotation ?? 0)

  return (
    <>
      <div className="section">
        <div className="item-head">
          <div className="cat-thumb"><ItemGlyph type={def.custom ? 'custom' : item.type} size={28} /></div>
          <div>
            <div className="item-title">{itemDisplayName(item, def)}</div>
            <div className="item-dims">{fmtM(w)} × {fmtM(def.d)} × {fmtM(def.h)}</div>
          </div>
        </div>
      </div>

      {def.variants && (
        <div className="section">
          <div className="section-title">Frame width</div>
          <Segmented
            ariaLabel="Frame width"
            value={w}
            onChange={(v) => updateItem(item.id, { w: v })}
            options={def.variants.map((v) => ({ value: v.w, label: v.label }))}
          />
        </div>
      )}

      <div className="section">
        <div className="section-title">Position</div>
        <div className="stack">
          <div className="grid-2">
            <NumberField label="Across (X)" value={item.x} min={-50} max={50} step={0.05} onChange={(v) => updateItem(item.id, { x: v }, 'pos:' + item.id)} />
            <NumberField label="Depth (Z)" value={item.z} min={-50} max={50} step={0.05} onChange={(v) => updateItem(item.id, { z: v }, 'pos:' + item.id)} />
          </div>
          <div className="field">
            <span>Rotation</span>
            <div className="rotate-row">
              <button type="button" className="icon-btn icon-btn-sm" title="Rotate 45° anticlockwise (Shift+R)" onClick={() => rotateItem(item.id, 45)}><RotateCcw size={15} /></button>
              <input type="range" min={0} max={345} step={15} value={rotation - (rotation % 15)} aria-label="Rotation"
                onChange={(e) => updateItem(item.id, { rotation: Number(e.target.value) }, 'rot:' + item.id)} />
              <button type="button" className="icon-btn icon-btn-sm" title="Rotate 45° clockwise (R)" onClick={() => rotateItem(item.id, -45)}><RotateCw size={15} /></button>
              <span className="rotate-value">{rotation}°</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          Artwork
          {surfaces.length > 1 && item.graphics?.front && !item.graphics?.back && (
            <button type="button" className="btn btn-sm btn-ghost" style={{ textTransform: 'none', letterSpacing: 0 }}
              onClick={() => useStore.getState().setGraphic(item.id, 'back', item.graphics.front)}>
              <ArrowLeftRight size={13} /> Use front on back
            </button>
          )}
        </div>
        <div className="stack">
          {surfaces.map((s) => <GraphicSlot key={s.key} itemId={item.id} surface={s} url={item.graphics?.[s.key]} />)}
          <div className="hint">Images or PDF (first page). Artwork is cropped to fill; sizes are the visible print area. You can also drop files straight onto the item in the view.</div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">{def.lit ? 'Fabric colour' : 'Finish'}</div>
        <Swatches value={item.color ?? def.color} presets={FINISH_COLOURS}
          onChange={(c) => updateItem(item.id, { color: c }, 'color:' + item.id)} label="Finish colour" />
        <div className="hint" style={{ marginTop: 8 }}>Shown on printable surfaces without artwork.</div>
      </div>

      <div className="section">
        <div className="grid-2">
          <button type="button" className="btn" onClick={() => useStore.getState().duplicateItem(item.id)}><Copy size={15} /> Duplicate</button>
          <button type="button" className="btn btn-danger" onClick={() => useStore.getState().removeItem(item.id)}><Trash2 size={15} /> Delete</button>
        </div>
      </div>
    </>
  )
}

// ─── Bill of materials ────────────────────────────────────────────────────────
export function BomPanel() {
  const items = useStore((s) => s.doc.items)
  const customItems = useStore((s) => s.doc.customItems)
  const { lines, frames } = billOfMaterials(items, customItems)

  if (!lines.length) {
    return (
      <div className="empty-note">
        <Boxes size={28} />
        <div>Nothing on the stand yet.</div>
        <div className="hint">Items you place are counted here.</div>
      </div>
    )
  }

  const artwork = items.reduce((acc, it) => {
    const def = getDef(it.type, customItems)
    if (!def) return acc
    for (const s of def.surfaces) {
      acc.total++
      if (it.graphics?.[s.key]) acc.done++
    }
    return acc
  }, { total: 0, done: 0 })

  return (
    <>
      <div className="section">
        <div className="section-title">Items <span className="badge">{items.length}</span></div>
        {lines.map((l) => (
          <div className="bom-row" key={l.label}>
            <span>{l.label}</span>
            <span className="bom-qty">× {l.qty}</span>
          </div>
        ))}
      </div>
      <div className="section">
        <div className="section-title">Artwork</div>
        <div className="bom-row">
          <span className="bom-sub">Surfaces with artwork</span>
          <span className="bom-qty">{artwork.done} / {artwork.total}</span>
        </div>
      </div>
      {frames.map((f) => (
        <div className="section" key={f.w}>
          <div className="section-title">Pixlip {f.w} m frame{f.count > 1 ? ` × ${f.count}` : ''}</div>
          {f.components.map((c) => (
            <div className="bom-row" key={c.label}>
              <span className="bom-sub">{c.label}</span>
              <span className="bom-qty">{c.total}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

export default function Inspector() {
  const selectedId = useStore((s) => s.selectedId)
  const item = useStore((s) => s.doc.items.find((i) => i.id === s.selectedId))
  const count = useStore((s) => s.doc.items.length)
  const [tab, setTab] = useState('design')
  useEffect(() => { if (selectedId) setTab('design') }, [selectedId])

  return (
    <aside className="inspector">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'design'} className={`tab${tab === 'design' ? ' on' : ''}`} onClick={() => setTab('design')}>
          <SlidersHorizontal size={14} /> {selectedId ? 'Item' : 'Stand'}
        </button>
        <button role="tab" aria-selected={tab === 'bom'} className={`tab${tab === 'bom' ? ' on' : ''}`} onClick={() => setTab('bom')}>
          <ClipboardList size={14} /> Materials <span className="badge">{count}</span>
        </button>
      </div>
      <div className="scroll">
        {tab === 'bom' ? <BomPanel /> : item ? <ItemPanel key={item.id} item={item} /> : <StandPanel />}
      </div>
    </aside>
  )
}
