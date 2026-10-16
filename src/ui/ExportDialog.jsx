import { useEffect, useRef, useState } from 'react'
import { Check, FileDown, ImageDown, Loader2, X, ImagePlus } from 'lucide-react'
import { useStore } from '../state/store'
import { VIEWS } from '../scene/views'
import { renderViews } from '../scene/viewportApi'
import { downloadBlob, slugify } from '../state/persistence'
import { fileToGraphic } from '../utils/files'
import { Segmented, Switch } from './controls'

const PICKS = [{ key: 'current', label: 'Your view' }, ...VIEWS]
const QUALITY = { standard: [2400, 1600], high: [3600, 2400] }

// Company name and logo are remembered per browser for the next export.
const BRAND_KEY = 'expopreview-studio:branding'
function loadBranding() {
  try { return JSON.parse(localStorage.getItem(BRAND_KEY) || '{}') } catch { return {} }
}
function saveBranding(b) {
  try { localStorage.setItem(BRAND_KEY, JSON.stringify(b)) } catch { /* storage full or blocked */ }
}

export default function ExportDialog() {
  const doc = useStore((s) => s.doc)
  const setProject = useStore((s) => s.setProject)
  const close = () => useStore.getState().setExportOpen(false)

  const [previews, setPreviews] = useState({})
  const [picked, setPicked] = useState(['hero', 'front', 'top'])
  const [format, setFormat] = useState('pdf')
  const [paper, setPaper] = useState('a4')
  const [quality, setQuality] = useState('standard')
  const [include, setInclude] = useState({ plan: true, artwork: true, components: false })
  const [branding, setBranding] = useState(loadBranding)
  const [busy, setBusy] = useState(false)
  const logoInput = useRef()

  // Render small previews once the dialog has painted.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const urls = renderViews(useStore.getState().doc, PICKS.map((p) => p.key), { width: 600, height: 400, quality: 0.8 })
        setPreviews(Object.fromEntries(PICKS.map((p, i) => [p.key, urls[i]])))
      } catch (err) {
        console.error(err)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy])

  const updateBranding = (patch) => {
    const next = { ...branding, ...patch }
    setBranding(next)
    saveBranding(next)
  }

  const toggle = (key) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : PICKS.map((x) => x.key).filter((k) => k === key || p.includes(k))))

  const ordered = PICKS.filter((p) => picked.includes(p.key))
  const cover = ordered[0]

  const run = async () => {
    if (!ordered.length) return
    setBusy(true)
    // Let the spinner paint before the heavy synchronous render.
    await new Promise((r) => setTimeout(r, 30))
    try {
      const [w, h] = QUALITY[quality]
      const name = slugify(doc.project.name)
      if (format === 'png') {
        const urls = renderViews(doc, ordered.map((p) => p.key), { width: w, height: h, type: 'image/png' })
        for (const [i, url] of urls.entries()) {
          const blob = await (await fetch(url)).blob()
          downloadBlob(blob, `${name}-${ordered[i].key}.png`)
          await new Promise((r) => setTimeout(r, 250))
        }
        useStore.getState().toast(`Saved ${urls.length} image${urls.length > 1 ? 's' : ''}`, 'success')
      } else {
        const urls = renderViews(doc, ordered.map((p) => p.key), { width: w, height: h, quality: 0.9 })
        const views = ordered.map((p, i) => ({ label: p.key === 'current' ? 'Perspective' : `${p.label} view`, url: urls[i], w, h }))
        const { buildMockupPdf } = await import('../export/pdf')
        const pdf = await buildMockupPdf({ doc, views, options: { paper, ...include }, branding })
        downloadBlob(pdf.output('blob'), `${name}-mockup.pdf`)
        useStore.getState().toast('Mockup PDF saved', 'success')
      }
      close()
    } catch (err) {
      console.error(err)
      useStore.getState().toast('Export failed — try the standard quality setting.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && !busy && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="modal-head">
          <div>
            <h2 id="export-title">Export client mockup</h2>
            <p>Rendered views of the stand, ready to send. Editing guides are left out.</p>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close" disabled={busy}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="export-grid">
            <div>
              <div className="export-hero">
                {cover && previews[cover.key]
                  ? <img src={previews[cover.key]} alt="Cover view preview" />
                  : cover ? <Loader2 className="spin" /> : <span>Pick at least one view</span>}
              </div>
              <div className="view-picks" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
                {PICKS.map((p) => {
                  const on = picked.includes(p.key)
                  return (
                    <button key={p.key} type="button" className={`view-pick ${on ? 'on' : 'off'}`} onClick={() => toggle(p.key)} aria-pressed={on}>
                      {previews[p.key] ? <img src={previews[p.key]} alt="" /> : <div style={{ aspectRatio: '3 / 2' }} />}
                      <span>{p.label}</span>
                      <div className="tick">{on && <Check size={12} strokeWidth={3} />}</div>
                    </button>
                  )
                })}
              </div>
              <div className="hint" style={{ marginTop: 8 }}>
                {format === 'pdf'
                  ? 'The first selected view is the cover image; each other view gets its own page.'
                  : 'Each selected view downloads as a separate PNG.'}
              </div>
            </div>

            <div className="stack" style={{ gap: 14 }}>
              <Segmented ariaLabel="Format" value={format} onChange={setFormat} options={[
                { value: 'pdf', label: 'PDF presentation', icon: <FileDown size={14} /> },
                { value: 'png', label: 'PNG images', icon: <ImageDown size={14} /> },
              ]} />

              <label className="field">
                <span>Project</span>
                <input className="input" value={doc.project.name} onChange={(e) => setProject({ name: e.target.value })} />
              </label>
              <label className="field">
                <span>Client</span>
                <input className="input" placeholder="Client or exhibitor name" value={doc.project.client} onChange={(e) => setProject({ client: e.target.value })} />
              </label>

              {format === 'pdf' && (
                <>
                  <div className="field">
                    <span>Your company</span>
                    <div className="logo-slot">
                      <button type="button" className="logo-preview" onClick={() => logoInput.current.click()} title="Upload logo">
                        {branding.logo ? <img src={branding.logo} alt="Logo" /> : <ImagePlus size={16} />}
                      </button>
                      <input className="input" placeholder="Company name" value={branding.company ?? ''} onChange={(e) => updateBranding({ company: e.target.value })} />
                      {branding.logo && (
                        <button type="button" className="icon-btn icon-btn-sm" title="Remove logo" onClick={() => updateBranding({ logo: null })}><X size={14} /></button>
                      )}
                    </div>
                    <input ref={logoInput} type="file" accept="image/*" hidden onChange={async (e) => {
                      const f = e.target.files[0]
                      e.target.value = ''
                      if (f) updateBranding({ logo: await fileToGraphic(f, 800) })
                    }} />
                  </div>
                  <label className="field">
                    <span>Notes for the client</span>
                    <textarea className="textarea" rows={3} placeholder="Optional — shown on the cover page" value={doc.project.notes} onChange={(e) => setProject({ notes: e.target.value })} />
                  </label>
                  <div className="grid-2">
                    <div className="field">
                      <span>Paper</span>
                      <Segmented ariaLabel="Paper" value={paper} onChange={setPaper} options={[{ value: 'a4', label: 'A4' }, { value: 'a3', label: 'A3' }]} />
                    </div>
                    <div className="field">
                      <span>Render quality</span>
                      <Segmented ariaLabel="Quality" value={quality} onChange={setQuality} options={[{ value: 'standard', label: 'Standard' }, { value: 'high', label: 'High' }]} />
                    </div>
                  </div>
                  <div className="stack" style={{ gap: 8 }}>
                    <Switch label="Floor plan" hint="Dimensioned top-down plan with a numbered key" checked={include.plan} onChange={(v) => setInclude((i) => ({ ...i, plan: v }))} />
                    <Switch label="Artwork checklist" hint="Print sizes per surface and what's been supplied" checked={include.artwork} onChange={(v) => setInclude((i) => ({ ...i, artwork: v }))} />
                    <Switch label="Bill of materials" hint="Frame components — usually for internal use" checked={include.components} onChange={(v) => setInclude((i) => ({ ...i, components: v }))} />
                  </div>
                </>
              )}

              {format === 'png' && (
                <div className="field">
                  <span>Resolution</span>
                  <Segmented ariaLabel="Quality" value={quality} onChange={setQuality} options={[
                    { value: 'standard', label: '2400 × 1600' }, { value: 'high', label: '3600 × 2400' },
                  ]} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <span className="hint">{ordered.length} view{ordered.length === 1 ? '' : 's'} selected</span>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={run} disabled={busy || !ordered.length}>
            {busy ? <Loader2 size={16} className="spin" /> : format === 'pdf' ? <FileDown size={16} /> : <ImageDown size={16} />}
            {busy ? 'Rendering…' : format === 'pdf' ? 'Export PDF' : 'Download images'}
          </button>
        </div>
      </div>
    </div>
  )
}
