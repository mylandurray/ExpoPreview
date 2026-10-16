import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import { loadAutosave, readSceneFile, writeAutosave } from './state/persistence'
import { VIEWS } from './scene/views'
import { pickItem } from './scene/viewportApi'
import { getDef } from './catalog/items'
import { fileToGraphic, isGraphicFile } from './utils/files'
import Viewport from './scene/Viewport'
import TopBar from './ui/TopBar'
import { openSceneFile, pickSceneFile, saveCurrentDocument } from './state/actions'
import Catalogue from './ui/Catalogue'
import Inspector from './ui/Inspector'
import ExportDialog from './ui/ExportDialog'
import { EmptyState, Toasts, ViewBar } from './ui/Overlays'
import HelpDialog from './ui/Help'

function isTyping(e) {
  const t = e.target
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e) => {
      const s = useStore.getState()
      if (s.replacement) {
        if (e.key === 'Escape') s.replacement.resolve('cancel')
        return
      }
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === 's') { e.preventDefault(); saveCurrentDocument(); return }
      if (mod && key === 'o') { e.preventDefault(); pickSceneFile(); return }
      if (mod && key === 'e') { e.preventDefault(); s.setExportOpen(true); return }
      if (isTyping(e) || s.exportOpen) return
      if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); return }
      if (mod && key === 'y') { e.preventDefault(); s.redo(); return }

      if (e.key === 'Escape') {
        if (s.placing) s.endPlacing()
        else if (s.helpOpen) s.setHelpOpen(false)
        else s.select(null)
        return
      }
      if (e.key === '?') { s.helpOpen ? s.setHelpOpen(false) : s.setHelpOpen(true, 'shortcuts'); return }
      if (s.helpOpen) return
      if (!mod && /^[1-5]$/.test(e.key)) { s.setView(VIEWS[Number(e.key) - 1].key); return }

      const id = s.selectedId
      if (!id) return
      if (mod && key === 'd') { e.preventDefault(); s.duplicateItem(id); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); s.removeItem(id); return }
      if (key === 'r' && !mod) { s.rotateItem(id, e.shiftKey ? 45 : -45); return }
      const step = e.shiftKey ? 0.01 : s.prefs.snap ? s.prefs.gridSize : 0.1
      const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (arrows[e.key]) { e.preventDefault(); s.nudgeItem(id, ...arrows[e.key]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

// Restore the last session, then autosave (debounced) whenever the layout changes.
function useAutosave() {
  useEffect(() => {
    let timer
    let ready = false
    let cancelled = false
    const initialDoc = useStore.getState().doc
    loadAutosave().then(async (saved) => {
      if (saved?.items) {
        try {
          const doc = await readSceneFile(new File([JSON.stringify(saved)], 'autosave.json'))
          const s = useStore.getState()
          if (!cancelled && s.doc === initialDoc) {
            s.loadDoc(doc)
            s.setView('hero')
            if (doc.items.length) s.toast('Restored your last layout')
          }
        } catch { /* ignore a corrupt autosave */ }
      }
      if (cancelled) return
      ready = true
      if (useStore.getState().doc !== initialDoc) {
        timer = setTimeout(() => writeAutosave(useStore.getState().doc), 600)
      }
    })
    const unsub = useStore.subscribe((s, prev) => {
      if (!ready || s.doc === prev.doc) return
      clearTimeout(timer)
      timer = setTimeout(() => writeAutosave(useStore.getState().doc), 600)
    })
    return () => { cancelled = true; unsub(); clearTimeout(timer) }
  }, [])
}

// Files dropped on the viewport: artwork onto the item under the pointer, or
// a saved layout anywhere.
function useViewportDrop() {
  const [over, setOver] = useState(false)
  const handlers = {
    onDragOver: (e) => {
      if (![...e.dataTransfer.types].includes('Files')) return
      e.preventDefault()
      setOver(true)
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setOver(false)
    },
    onDrop: async (e) => {
      e.preventDefault()
      setOver(false)
      const file = e.dataTransfer.files[0]
      if (!file) return
      const s = useStore.getState()
      if (/\.(exposcene|json)$/i.test(file.name)) {
        return openSceneFile(file)
      }
      if (!isGraphicFile(file)) return s.toast('Drop an image or PDF onto an item to apply artwork.', 'error')
      const hit = pickItem(e.clientX, e.clientY)
      if (!hit) return s.toast('Drop artwork directly onto an item.', 'error')
      const item = s.doc.items.find((i) => i.id === hit.id)
      const def = item && getDef(item.type, s.doc.customItems)
      if (!def) return
      const surface = def.surfaces.find((x) => x.key === hit.side) ?? def.surfaces[0]
      try {
        s.setGraphic(item.id, surface.key, await fileToGraphic(file))
        s.select(item.id)
        s.toast(`Artwork added to ${def.label} (${surface.label.toLowerCase()})`, 'success')
      } catch (err) {
        console.error(err)
        s.toast('Couldn’t read that file.', 'error')
      }
    },
  }
  return [over, handlers]
}

export default function App() {
  const theme = useStore((s) => s.prefs.theme)
  const exportOpen = useStore((s) => s.exportOpen)
  const placing = useStore((s) => s.placing)
  const replacement = useStore((s) => s.replacement)
  const [dropOver, dropHandlers] = useViewportDrop()

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { document.body.style.cursor = placing ? 'grabbing' : '' }, [placing])
  useShortcuts()
  useAutosave()

  return (
    <div className="app">
      <TopBar />
      <Catalogue />
      <main className="viewport" {...dropHandlers}>
        <Viewport />
        <EmptyState />
        <ViewBar />
        {dropOver && <div className="drop-overlay"><span>Drop artwork onto an item</span></div>}
      </main>
      <Inspector />
      {exportOpen && <ExportDialog />}
      {replacement && <div className="modal-backdrop"><div className="popover" role="dialog" aria-modal="true" aria-labelledby="replace-title" onKeyDown={(e) => {
        if (e.key !== 'Tab') return
        const buttons = [...e.currentTarget.querySelectorAll('button')]
        const index = buttons.indexOf(document.activeElement)
        e.preventDefault()
        buttons[(index + (e.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus()
      }} style={{ position: 'relative', padding: 24, maxWidth: 480 }}>
        <h2 id="replace-title">Save changes before replacing this layout?</h2>
        <p>Save downloads a backup. The browser cannot confirm that you retained it. The previous layout also stays available through recovery until the next replacement.</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn" autoFocus onClick={() => replacement.resolve('cancel')}>Cancel</button>
          <button className="btn" onClick={() => replacement.resolve('discard')}>Discard</button>
          <button className="btn btn-primary" onClick={() => replacement.resolve('save')}>Save and replace</button>
        </div>
      </div></div>}
      <HelpDialog />
      <Toasts />
    </div>
  )
}
