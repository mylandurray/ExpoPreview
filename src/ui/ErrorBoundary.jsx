import { Component } from 'react'
import { useStore, newDoc } from '../state/store'
import { saveSceneFile } from '../state/persistence'

export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return <main style={{ padding: 32 }}>
      <h1>The editor couldn’t display this layout</h1>
      <p>Your document is still available to download. Recover the previous layout or restart the editor.</p>
      <button onClick={() => saveSceneFile(useStore.getState().doc)}>Download layout</button>
      <button onClick={() => {
        const s = useStore.getState()
        s.loadDoc(s.recoveryDoc ?? newDoc(), false)
        this.setState({ error: null })
      }}>Recover previous layout</button>
    </main>
  }
}
