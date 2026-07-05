import type { NormalizedReport } from '@robosystems/report-components'
import { useCallback, useState } from 'react'
import { FileMode } from './modes/FileMode'
import { SecMode } from './modes/SecMode'

type Mode = 'file' | 'sec'

export function App() {
  const [mode, setMode] = useState<Mode>('file')
  const [report, setReport] = useState<NormalizedReport | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const onLoaded = useCallback((r: NormalizedReport, name: string) => {
    setReport(r)
    setFileName(name)
  }, [])
  const onReset = useCallback(() => {
    setReport(null)
    setFileName(null)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <img className="brand-logo" src="/images/logos/robosystems.png" alt="RoboSystems" />
          <div className="brand-name">RoboSystems Holon Viewer</div>
        </div>

        <div className="header-right">
          {mode === 'file' && report ? (
            <div className="header-loaded">
              <span className="header-loaded-text">
                Loaded <strong>{fileName}</strong>
                {report.reportId ? <span className="hint"> · {report.reportId}</span> : null}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>
                Load another
              </button>
            </div>
          ) : null}

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
        </div>
      </header>

      <main className="app-main">
        {mode === 'file' ? <FileMode report={report} onLoaded={onLoaded} /> : <SecMode />}
      </main>

      <footer className="app-footer">
        Static, client-side. A holon report renders only its scene · boundary · projection — never
        the underlying ledger.
      </footer>
    </div>
  )
}
