import { CheckCircle2, AlertCircle, Camera, Focus, MousePointerClick, BookOpen } from 'lucide-react'
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
        <Camera size={14} /> Snapshot
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
        <p>Drag items from the catalogue onto the floor, or click one to drop it in. Set the stand size on the right.</p>
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
