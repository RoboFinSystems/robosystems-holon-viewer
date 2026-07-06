import type { NormalizedReport } from '@robosystems/report-components'
import type { Store } from 'n3'
import { useCallback, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AnthropicProvider } from '../ai/anthropic'
import { cypherBackend } from '../ai/backends/cypher'
import { sparqlBackend } from '../ai/backends/sparql'
import { type ChatBackend, runToolLoop } from '../ai/loop'
import type { AIMessage } from '../ai/provider'
import { Spinner } from '../components/Spinner'
import { usePersistentApiKey } from '../hooks/usePersistentApiKey'

interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
  error?: boolean
  /** The query the loop generated for this answer (assistant turns). */
  query?: string
  /** 'SPARQL' | 'Cypher' — labels the query reveal. */
  queryLabel?: string
}

interface ChatDrawerProps {
  open: boolean
  onClose: () => void
  /** Current source mode — picks SPARQL (file) vs Cypher (SEC). */
  mode: 'file' | 'sec'
  /** File mode: the loaded report + its queryable RDF store. */
  report: NormalizedReport | null
  store: Store | null
}

/**
 * Mode-agnostic chat drawer — a right-side panel that pushes the content aside.
 * BYO Anthropic key (persisted, `llm` slot). It picks a `ChatBackend` by mode:
 * File → SPARQL over the in-memory RDF; SEC → read-only Cypher over the live
 * graph via the RoboSystems MCP HTTP surface (using the persisted `sec` key).
 * The agentic loop is the same either way.
 */
export function ChatDrawer({ open, onClose, mode, report, store }: ChatDrawerProps) {
  const llm = usePersistentApiKey('llm')
  const sec = usePersistentApiKey('sec')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [keyDraft, setKeyDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const provider = useMemo(() => (llm.key ? new AnthropicProvider(llm.key) : null), [llm.key])

  const backend = useMemo<ChatBackend | null>(() => {
    if (mode === 'sec') return sec.key ? cypherBackend(sec.key, 'sec') : null
    return report && store ? sparqlBackend(report, store) : null
  }, [mode, sec.key, report, store])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || busy || !provider || !backend) return
    const history: AIMessage[] = turns.map((t) => ({ role: t.role, content: t.text }))
    setDraft('')
    setTurns((prev) => [...prev, { role: 'user', text }])
    setBusy(true)
    try {
      const res = await runToolLoop(provider, backend, history, text)
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.text || '(no answer returned)',
          query: res.query,
          queryLabel: backend.queryLabel,
        },
      ])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setTurns((prev) => [...prev, { role: 'assistant', text: `Error: ${msg}`, error: true }])
    } finally {
      setBusy(false)
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    }
  }, [draft, busy, provider, backend, turns])

  const title = mode === 'sec' ? 'Ask the SEC graph' : 'Ask about this report'

  return (
    <aside className={open ? 'chat-drawer open' : 'chat-drawer'} inert={!open}>
      <div className="chat-inner">
        <div className="chat-header">
          <div className="chat-title">
            <strong>{title}</strong>
            {mode === 'file' && report?.reportId ? (
              <span className="hint"> · {report.reportId}</span>
            ) : null}
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close chat">
            ×
          </button>
        </div>

        <div className="chat-messages" ref={scrollRef}>
          {turns.length === 0 ? (
            <p className="hint chat-empty">
              {mode === 'sec'
                ? 'Ask about any public company in the SEC graph — e.g. “What was NVIDIA’s revenue in fiscal 2024?”'
                : 'Ask a question about the numbers in this report — e.g. “What is total assets?”'}
            </p>
          ) : (
            turns.map((turn, i) => {
              const cls = `chat-msg chat-msg-${turn.role}${turn.error ? ' chat-msg-error' : ''}`
              return turn.role === 'assistant' && !turn.error ? (
                <div key={i} className={`${cls} chat-md`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.text}</ReactMarkdown>
                  {turn.query ? (
                    <details className="chat-sparql">
                      <summary>{turn.queryLabel ?? 'Query'}</summary>
                      <pre>{turn.query}</pre>
                    </details>
                  ) : null}
                </div>
              ) : (
                <div key={i} className={cls}>
                  {turn.text}
                </div>
              )
            })
          )}
          {busy ? (
            <div className="chat-msg chat-msg-assistant chat-thinking">
              <Spinner label="Querying…" />
            </div>
          ) : null}
        </div>

        {!llm.isStored ? (
          <form
            className="chat-connect"
            onSubmit={(e) => {
              e.preventDefault()
              const v = keyDraft.trim()
              if (v) {
                llm.setKey(v)
                setKeyDraft('')
              }
            }}
          >
            <label className="field">
              <span>Anthropic API key</span>
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="sk-ant-…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button type="submit" className="btn btn-sm" disabled={!keyDraft.trim()}>
              Save key &amp; start
            </button>
            <p className="hint">
              Stored only in this browser; sent directly to Anthropic when you chat — never to this
              app.
            </p>
          </form>
        ) : !backend ? (
          <p className="hint chat-connect">
            {mode === 'sec' ? (
              <>
                Connect to the SEC graph in the <strong>SEC</strong> tab first.
              </>
            ) : (
              <>
                Open a <code>holon.jsonld</code> in <strong>File</strong> mode, then ask about it.
              </>
            )}
          </p>
        ) : (
          <>
            <form
              className="chat-input"
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask…"
                disabled={busy}
              />
              <button type="submit" className="btn btn-sm" disabled={busy || !draft.trim()}>
                Send
              </button>
            </form>
            <p className="hint chat-footnote">
              Queries with {backend.queryLabel}; using your saved Anthropic key.{' '}
              <button type="button" className="chat-link" onClick={llm.clear}>
                Forget key
              </button>
            </p>
          </>
        )}
      </div>
    </aside>
  )
}
