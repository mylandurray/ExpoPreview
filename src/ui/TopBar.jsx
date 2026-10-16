import { useEffect, useRef, useState } from 'react'
import {
  Undo2, Redo2, FolderOpen, Save, FilePlus2, ChevronDown, Moon, Sun, CircleHelp, Send, FileArchive,
} from 'lucide-react'
import { useStore } from '../state/store'
import { saveSceneFile } from '../state/persistence'
import { MOD, newLayout, pickSceneFile, saveCurrentDocument, replaceDocument } from '../state/actions'

function FileMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const run = (fn) => () => { setOpen(false); fn() }
  const doc = () => useStore.getState().doc

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-ghost" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        File <ChevronDown size={14} />
      </button>
      {open && (
        <div className="popover" role="menu" style={{ top: 40, left: 0 }}>
          <button className="menu-item" role="menuitem" onClick={run(newLayout)}>
            <FilePlus2 size={16} /> New layout
          </button>
          <button className="menu-item" role="menuitem" onClick={run(pickSceneFile)}>
            <FolderOpen size={16} /> Open… <span className="kbd">{MOD}+O</span>
          </button>
          <button className="menu-item" role="menuitem" disabled={!useStore.getState().recoveryDoc} onClick={run(() => {
            const recovery = useStore.getState().recoveryDoc
            if (recovery) replaceDocument(recovery, false)
          })}>Recover previous layout</button>
          <div className="menu-sep" />
          <button className="menu-item" role="menuitem" onClick={run(saveCurrentDocument)}>
            <Save size={16} /> Save layout <span className="kbd">{MOD}+S</span>
          </button>
          <button className="menu-item" role="menuitem" onClick={run(() => saveSceneFile(doc(), false))}>
            <FileArchive size={16} /> Save without artwork
          </button>
        </div>
      )}
    </div>
  )
}

export default function TopBar() {
  const name = useStore((s) => s.doc.project.name)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const theme = useStore((s) => s.prefs.theme)
  const s = useStore.getState()

  return (
    <header className="topbar">
      <div className="app-lockup">
        <span className="app-mark" aria-hidden="true" />
        <span className="app-name">ExpoPreview<small>Stand mockups</small></span>
      </div>
      <div className="topbar-divider" />
      <input
        className="project-name"
        value={name}
        size={Math.max(8, name.length)}
        onChange={(e) => s.setProject({ name: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Project name"
        spellCheck={false}
      />
      <FileMenu />
      <div className="topbar-group">
        <button className="icon-btn" onClick={s.undo} disabled={!canUndo} title={`Undo (${MOD}+Z)`} aria-label="Undo"><Undo2 size={17} /></button>
        <button className="icon-btn" onClick={s.redo} disabled={!canRedo} title={`Redo (${MOD}+Shift+Z)`} aria-label="Redo"><Redo2 size={17} /></button>
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-group">
        <button className="icon-btn" onClick={() => s.setHelpOpen(true)} title="Help & guide (?)" aria-label="Help and guide"><CircleHelp size={17} /></button>
        <button className="icon-btn" onClick={() => s.setPref('theme', theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
      <button className="btn btn-primary" onClick={() => s.setExportOpen(true)}>
        <Send size={15} /> Export mockup
      </button>
    </header>
  )
}

