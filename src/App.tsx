import type { NormalizedReport } from '@robosystems/report-components'
import type { Store } from 'n3'
import { lazy, Suspense, useCallback, useState } from 'react'
import type { SecReportContext } from './ai/reportContext'
import { KeysDrawer } from './chat/KeysDrawer'
import { BotIcon, GearIcon, GitHubIcon } from './components/icons'
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
  const [keysOpen, setKeysOpen] = useState(false)
  // The SEC filing currently on screen (published by SecMode), so the chat can
  // key its summary/pin on it. Null in file mode and when browsing.
  const [secContext, setSecContext] = useState<SecReportContext | null>(null)

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

  // The two right-side drawers share one slot, so opening one closes the other.
  const toggleChat = useCallback(() => {
    setChatMounted(true)
    setChatOpen((o) => !o)
    setKeysOpen(false)
  }, [])
  const toggleKeys = useCallback(() => {
    setKeysOpen((o) => !o)
    setChatOpen(false)
  }, [])
  const openSettings = useCallback(() => {
    setKeysOpen(true)
    setChatOpen(false)
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
            className="btn btn-secondary icon-btn"
            aria-pressed={chatOpen}
            aria-label="Ask"
            title="Ask"
            onClick={toggleChat}
          >
            <BotIcon />
          </button>
          <button
            type="button"
            className="btn btn-secondary icon-btn"
            aria-pressed={keysOpen}
            aria-label="Settings"
            title="Settings"
            onClick={toggleKeys}
          >
            <GearIcon />
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
              Graph
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
              <SecMode onOpenSettings={openSettings} onReportContext={setSecContext} />
            )}
          </main>
          <footer className="app-footer">
            <span>© 2026 RFS LLC. All rights reserved.</span>
            <a
              className="app-footer-link"
              href="https://github.com/RoboFinSystems/robosystems-holon-viewer"
              target="_blank"
              rel="noreferrer noopener"
            >
              <GitHubIcon />
              GitHub
            </a>
          </footer>
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
              secContext={mode === 'sec' ? secContext : null}
              onOpenSettings={openSettings}
            />
          </Suspense>
        ) : null}
        <KeysDrawer open={keysOpen} onClose={() => setKeysOpen(false)} />
      </div>
    </div>
  )
}
