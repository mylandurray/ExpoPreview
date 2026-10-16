import { useRef, useState } from 'react'
import { Plus, Trash2, Package } from 'lucide-react'
import { useStore } from '../state/store'
import { CATALOG, CATEGORIES, fmtM, makeCustomDef } from '../catalog/items'
import { ItemGlyph, NumberField, Swatches, Switch } from './controls'

// Press on a card or size chip and drag into the viewport to place it; a plain
// click drops it at the next free spot on the stand instead.
function useDragSource(type, w) {
  const start = useRef(null)
  return {
    onPointerDown: (e) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      start.current = { x: e.clientX, y: e.clientY }
      useStore.getState().startPlacing(type, w)
    },
    onClick: (e) => {
      e.stopPropagation()
      const s = start.current
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 5) return
      useStore.getState().addItemAuto(type, w)
    },
  }
}

function VariantChip({ type, variant, active }) {
  const drag = useDragSource(type, variant.w)
  return (
    <button type="button" className={`chip${active ? ' on' : ''}`} {...drag} title={`Drag or click to add a ${variant.label} frame`}>
      {variant.label}
    </button>
  )
}

function CatalogueCard({ type, def, onRemove }) {
  const placing = useStore((s) => s.placing)
  const drag = useDragSource(type, def.variants ? def.w : null)
  const active = placing?.type === type
  const dims = def.variants
    ? `${def.variants[0].w}–${def.variants.at(-1).w} × ${def.d} × ${def.h} m`
    : `${def.w} × ${def.d} × ${def.h} m`

  return (
    <div className={`cat-card${active ? ' dragging' : ''}`} {...(def.variants ? {} : drag)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && useStore.getState().addItemAuto(type, def.variants ? def.w : null)}
      title={def.variants ? undefined : 'Drag onto the stand, or click to add'}>
      <div className="cat-thumb" {...(def.variants ? drag : {})} style={{ cursor: 'grab' }}>
        <ItemGlyph type={def.custom ? 'custom' : type} />
      </div>
      <div className="cat-body">
        <div className="cat-name">{def.label}</div>
        <div className="cat-meta">{def.blurb ?? dims}</div>
        {def.variants ? (
          <div className="cat-variants">
            {def.variants.map((v) => (
              <VariantChip key={v.w} type={type} variant={v} active={active && placing.w === v.w} />
            ))}
          </div>
        ) : (
          <div className="cat-meta">{dims}</div>
        )}
      </div>
      {onRemove && (
        <button type="button" className="icon-btn icon-btn-sm remove" title="Remove custom item"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemove() }}>
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}

const CUSTOM_COLOURS = ['#e4e7ec', '#ffffff', '#1f2329', '#0074c8', '#e5484d', '#f5a524', '#30a46c']

function CustomItemDialog({ onClose }) {
  const addCustomItem = useStore((s) => s.addCustomItem)
  const [form, setForm] = useState({ label: '', w: 1, d: 0.5, h: 1, color: '#e4e7ec', lit: false })
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.label.trim()) return
    addCustomItem(makeCustomDef({ ...form, label: form.label.trim() }))
    useStore.getState().toast(`Added “${form.label.trim()}” to the catalogue`, 'success')
    onClose()
  }

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal modal-sm" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <h2>New custom item</h2>
            <p>A simple box with a printable front — saved with this layout.</p>
          </div>
        </div>
        <div className="modal-body stack">
          <label className="field">
            <span>Name</span>
            <input className="input" autoFocus placeholder="e.g. Brochure stand" value={form.label}
              onChange={(e) => set('label')(e.target.value)} />
          </label>
          <div className="grid-3">
            <NumberField label="Width" value={form.w} min={0.05} max={20} onChange={set('w')} />
            <NumberField label="Depth" value={form.d} min={0.05} max={20} onChange={set('d')} />
            <NumberField label="Height" value={form.h} min={0.05} max={8} onChange={set('h')} />
          </div>
          <div className="field">
            <span>Colour</span>
            <Swatches value={form.color} presets={CUSTOM_COLOURS} onChange={set('color')} label="Item colour" />
          </div>
          <Switch label="Backlit" hint="Renders evenly lit, like a lightbox." checked={form.lit} onChange={set('lit')} />
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!form.label.trim()}>Add item</button>
        </div>
      </form>
    </div>
  )
}

export default function Catalogue() {
  const customItems = useStore((s) => s.doc.customItems)
  const itemCount = useStore((s) => s.doc.items.length)
  const stand = useStore((s) => s.doc.stand)
  const [creating, setCreating] = useState(false)

  const removeCustom = (key, def) => {
    const used = useStore.getState().doc.items.filter((i) => i.type === key).length
    if (used && !window.confirm(`Remove “${def.label}”? ${used} placed on the stand will be removed too.`)) return
    useStore.getState().removeCustomItem(key)
  }

  return (
    <aside className="sidebar">
      <div className="panel-head">
        <span className="panel-title">Catalogue</span>
        <span className="hint">Drag or click to add</span>
      </div>
      <div className="scroll">
        {CATEGORIES.map((cat) => (
          <div className="cat-group" key={cat}>
            <div className="cat-group-title">{cat}</div>
            {Object.entries(CATALOG).filter(([, d]) => d.category === cat).map(([key, def]) => (
              <CatalogueCard key={key} type={key} def={def} />
            ))}
          </div>
        ))}
        <div className="cat-group">
          <div className="cat-group-title">Custom</div>
          {Object.entries(customItems).map(([key, def]) => (
            <CatalogueCard key={key} type={key} def={def} onRemove={() => removeCustom(key, def)} />
          ))}
          <button type="button" className="btn btn-ghost btn-block" style={{ justifyContent: 'flex-start', marginTop: 4 }} onClick={() => setCreating(true)}>
            <Plus size={16} /> New custom item
          </button>
        </div>
      </div>
      <div className="sidebar-foot">
        <Package size={14} />
        {itemCount} {itemCount === 1 ? 'item' : 'items'} on a {fmtM(stand.width)} × {fmtM(stand.depth)} stand
      </div>
      {creating && <CustomItemDialog onClose={() => setCreating(false)} />}
    </aside>
  )
}
