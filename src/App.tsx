import { useState } from 'react'
import { FileMode } from './modes/FileMode'
import { SecMode } from './modes/SecMode'

type Mode = 'file' | 'sec'

export function App() {
  const [mode, setMode] = useState<Mode>('file')

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <img className="brand-logo" src="/images/logos/robosystems.png" alt="RoboSystems" />
          <div>
            <div className="brand-name">Holon Viewer</div>
            <div className="brand-tag">financial-report renderer for holon.trig</div>
          </div>
        </div>
        <nav className="mode-switch" role="tablist" aria-label="Source mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'file'}
            onClick={() => setMode('file')}
          >
            File
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sec'}
            onClick={() => setMode('sec')}
          >
            SEC
          </button>
        </nav>
      </header>

      <main className="app-main">{mode === 'file' ? <FileMode /> : <SecMode />}</main>

      <footer className="app-footer">
        Static, client-side. A holon report renders only its scene · boundary · projection — never
        the underlying ledger.
      </footer>
    </div>
  )
}
