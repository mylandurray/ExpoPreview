import { CheckCircle2, AlertCircle, Camera, Focus, MousePointerClick, BookOpen, Plus, SlidersHorizontal, X } from 'lucide-react'
import { useStore } from '../state/store'
import { VIEWS } from '../scene/views'
import { quickSnapshot } from '../state/actions'

export function ViewBar() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  return (
    <div className="float view-bar" role="toolbar" aria-label="Camera views">
      {VIEWS.map((v, i) => (
        <button key={v.key} className={view.name === v.key && view.nonce > 0 ? 'on' : ''} onClick={() => setView(v.key)} title={`${v.label} view (${i + 1})`}>
          {v.key === 'hero' && <Focus size={14} />}
          {v.label}
        </button>
      ))}
      <span className="sep" />
      <button onClick={quickSnapshot} title="Save the current view as an image">
        <Camera size={14} /> <span className="label-hide">Snapshot</span>
      </button>
    </div>
  )
}

export function EmptyState() {
  const empty = useStore((s) => s.doc.items.length === 0)
  const placing = useStore((s) => s.placing)
  if (!empty || placing) return null
  return (
    <div className="empty-state">
      <div className="float empty-card" style={{ position: 'relative' }}>
        <MousePointerClick size={22} style={{ color: 'var(--accent)', marginBottom: 6 }} />
        <h3>Start building the stand</h3>
        <p className="desktop-only">Drag items from the catalogue onto the floor, or click one to drop it in. Set the stand size on the right.</p>
        <p className="mobile-only">Tap <strong>Add items</strong> below and pick something, or drag it up onto the floor. Set the stand size under <strong>Stand</strong>.</p>
        <button className="btn btn-sm btn-ghost empty-help" onClick={() => useStore.getState().setHelpOpen(true, 'start')}>
          <BookOpen size={14} /> Read the getting-started guide
        </button>
      </div>
    </div>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.tone === 'success' && <CheckCircle2 size={16} />}
          {t.tone === 'error' && <AlertCircle size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  )
}

// Phones only (hidden by CSS on wider screens): toggles the catalogue and
// inspector as bottom sheets so the 3D view gets the whole screen.
export function MobileNav() {
  const panel = useStore((s) => s.mobilePanel)
  const selected = useStore((s) => s.selectedId != null)
  const setPanel = useStore((s) => s.setMobilePanel)
  const toggle = (name) => setPanel(panel === name ? null : name)
  return (
    <nav className="mobile-nav" aria-label="Panels">
      <button className={panel === 'catalogue' ? 'on' : ''} onClick={() => toggle('catalogue')} aria-expanded={panel === 'catalogue'}>
        {panel === 'catalogue' ? <X size={18} /> : <Plus size={18} />} Add items
      </button>
      <button className={panel === 'inspector' ? 'on' : ''} onClick={() => toggle('inspector')} aria-expanded={panel === 'inspector'}>
        {panel === 'inspector' ? <X size={18} /> : <SlidersHorizontal size={18} />} {selected ? 'Edit item' : 'Stand'}
      </button>
    </nav>
  )
}
