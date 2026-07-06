import type { NormalizedReport } from '@robosystems/report-components'
import type { Store } from 'n3'
import { lazy, Suspense, useCallback, useState } from 'react'
import { Spinner } from './components/Spinner'
import { FileMode } from './modes/FileMode'
import { SecMode } from './modes/SecMode'

// Lazy: the chat drawer pulls in Comunica, the Anthropic SDK, and markdown
// (~2 MB). Load that chunk only when the user first opens the drawer, keeping
// the report-render path lean.
const ChatDrawer = lazy(() => import('./chat/ChatDrawer').then((m) => ({ default: m.ChatDrawer })))

type Mode = 'file' | 'sec'

export function App() {
  const [mode, setMode] = useState<Mode>('file')
  const [report, setReport] = useState<NormalizedReport | null>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  // Mounts the lazy drawer on first open, then keeps it mounted (state + layout).
  const [chatMounted, setChatMounted] = useState(false)

  const onLoaded = useCallback((r: NormalizedReport, s: Store, name: string) => {
    setReport(r)
    setStore(s)
    setFileName(name)
  }, [])
  const onReset = useCallback(() => {
    setReport(null)
    setStore(null)
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
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-pressed={chatOpen}
            onClick={() => {
              setChatMounted(true)
              setChatOpen((o) => !o)
            }}
          >
            Ask
          </button>
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

      <div className="app-body">
        <div className="app-content">
          <main className="app-main">
            {mode === 'file' ? (
              <FileMode report={report} fileName={fileName} onLoaded={onLoaded} onReset={onReset} />
            ) : (
              <SecMode />
            )}
          </main>
          <footer className="app-footer">© 2026 RFS LLC. All rights reserved.</footer>
        </div>
        {chatMounted ? (
          <Suspense
            fallback={
              <aside className="chat-drawer open">
                <div className="chat-inner">
                  <div className="loading-center">
                    <Spinner label="Loading…" />
                  </div>
                </div>
              </aside>
            }
          >
            <ChatDrawer
              open={chatOpen}
              onClose={() => setChatOpen(false)}
              mode={mode}
              report={report}
              store={store}
            />
          </Suspense>
        ) : null}
      </div>
    </div>
  )
}
