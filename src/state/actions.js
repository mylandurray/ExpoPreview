import { newDoc, useStore } from './store'
import { downloadBlob, readSceneFile, saveSceneFile, slugify } from './persistence'
import { renderViews } from '../scene/viewportApi'

// Actions shared by menus, overlays and keyboard shortcuts.

export const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

export function isDirty(state = useStore.getState()) {
  return JSON.stringify(state.doc) !== (state.cleanDoc ?? JSON.stringify(newDoc()))
}

export function saveCurrentDocument() {
  const s = useStore.getState()
  saveSceneFile(s.doc, true)
  s.markSaved(s.doc)
}

export async function replaceDocument(doc, clean = true) {
  let s = useStore.getState()
  if (s.replacement) return false
  if (isDirty(s)) {
    const choice = await new Promise((resolve) => s.setReplacement({ resolve }))
    useStore.getState().setReplacement(null)
    if (choice === 'cancel') return false
    if (choice === 'save') {
      try { saveCurrentDocument() } catch (err) {
        useStore.getState().toast(`Save failed: ${err.message}`, 'error')
        return false
      }
    }
  }
  s = useStore.getState()
  s.loadDoc(doc, clean)
  s.setView('hero')
  return true
}

export const newLayout = () => replaceDocument(newDoc())

export async function openSceneFile(file) {
  const s = useStore.getState()
  try {
    const doc = await readSceneFile(file)
    if (!doc.project.name || doc.project.name === 'Untitled stand') {
      doc.project.name = file.name.replace(/\.(exposcene|json)$/i, '')
    }
    if (!await replaceDocument(doc)) return
    s.setView('hero')
    s.toast(`Opened ${file.name}`, 'success')
  } catch (err) {
    console.error(err)
    s.toast(err.message || 'That file couldn’t be opened.', 'error')
  }
}

export function pickSceneFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.exposcene,.json'
  input.onchange = () => input.files[0] && openSceneFile(input.files[0])
  input.click()
}

export async function quickSnapshot() {
  const s = useStore.getState()
  try {
    const canvas = document.querySelector('.viewport canvas')
    const ratio = 2
    const [url] = renderViews(s.doc, ['current'], {
      width: Math.round(canvas.clientWidth * ratio),
      height: Math.round(canvas.clientHeight * ratio),
      type: 'image/png',
    })
    downloadBlob(await (await fetch(url)).blob(), `${slugify(s.doc.project.name)}-snapshot.png`)
    s.toast('Snapshot saved', 'success')
  } catch (err) {
    console.error(err)
    s.toast('Couldn’t save a snapshot.', 'error')
  }
}
