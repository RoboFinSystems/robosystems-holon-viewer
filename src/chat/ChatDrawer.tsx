import type { NormalizedReport } from '@robosystems/report-components'
import type { Store } from 'n3'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AnthropicProvider } from '../ai/anthropic'
import { cypherBackend } from '../ai/backends/cypher'
import { sparqlBackend } from '../ai/backends/sparql'
import { type ChatBackend, runToolLoop } from '../ai/loop'
import type { AIMessage } from '../ai/provider'
import { type SecReportContext, SUMMARY_PROMPT, secContextNote } from '../ai/reportContext'
import { stripMarkdown } from '../ai/tts'
import { Spinner } from '../components/Spinner'
import { usePersistentApiKey } from '../hooks/usePersistentApiKey'
import { useTts } from '../hooks/useTts'

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
  /** SEC mode: the filing on screen (or null), so the chat can key on it. */
  secContext: SecReportContext | null
  /** Open the Keys drawer — where the Anthropic (and other) keys are entered. */
  onOpenSettings: () => void
}

const SUMMARY_DISPLAY = 'Give me a business summary of this report.'

/**
 * Mode-agnostic chat drawer — a right-side panel that pushes the content aside.
 * It picks a `ChatBackend` by mode: File → SPARQL over the in-memory RDF; SEC →
 * read-only Cypher over the live graph. Keys are entered in the Keys drawer.
 *
 * Two report-aware extras: a one-click business **Summary** on the empty state
 * (keyed on the report in context — always injected for SEC), and, in SEC mode,
 * a **Pin report** toggle that anchors ordinary questions on the open filing.
 * With an ElevenLabs key set, answers can be read aloud (and the summary auto-
 * plays).
 */
export function ChatDrawer({
  open,
  onClose,
  mode,
  report,
  store,
  secContext,
  onOpenSettings,
}: ChatDrawerProps) {
  const llm = usePersistentApiKey('llm')
  const sec = usePersistentApiKey('sec')
  const tts = useTts()
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Thinking')
  const [pinned, setPinned] = useState(false)
  // Which assistant turn is currently being read aloud (null = none).
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const provider = useMemo(() => (llm.key ? new AnthropicProvider(llm.key) : null), [llm.key])

  const backend = useMemo<ChatBackend | null>(() => {
    if (mode === 'sec') return sec.key ? cypherBackend(sec.key, 'sec') : null
    return report && store ? sparqlBackend(report, store) : null
  }, [mode, sec.key, report, store])

  // A report is "in context" when the summary makes sense: a loaded file, or an
  // open SEC filing.
  const hasReportContext = mode === 'sec' ? Boolean(secContext) : Boolean(report)

  // Playback ends (or errors) → drop the per-message speaking highlight.
  useEffect(() => {
    if (!tts.speaking) setSpeakingIdx(null)
  }, [tts.speaking])

  const runQuestion = useCallback(
    async (question: string, opts: { summary?: boolean; display?: string } = {}) => {
      if (busy || !provider || !backend) return
      const { summary = false, display = question } = opts
      const history: AIMessage[] = turns.map((t) => ({ role: t.role, content: t.text }))
      // Anchor on the open SEC filing for the summary always, or for ordinary
      // questions only when the user has pinned it.
      const useContext = mode === 'sec' && secContext && (pinned || summary)
      const contextNote = useContext ? secContextNote(secContext) : undefined
      const assistantIdx = turns.length + 1

      setTurns((prev) => [...prev, { role: 'user', text: display }])
      setStatus('Thinking')
      setBusy(true)
      try {
        const res = await runToolLoop(provider, backend, history, question, {
          contextNote,
          onProgress: setStatus,
        })
        const text = res.text || '(no answer returned)'
        setTurns((prev) => [
          ...prev,
          { role: 'assistant', text, query: res.query, queryLabel: backend.queryLabel },
        ])
        if (summary && tts.available) {
          setSpeakingIdx(assistantIdx)
          void tts.speak(stripMarkdown(text))
        }
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
    },
    [busy, provider, backend, turns, mode, secContext, pinned, tts]
  )

  const send = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    void runQuestion(text)
  }, [draft, runQuestion])

  const readAloud = useCallback(
    (idx: number, text: string) => {
      if (speakingIdx === idx && tts.speaking) {
        tts.stop()
        setSpeakingIdx(null)
        return
      }
      setSpeakingIdx(idx)
      void tts.speak(stripMarkdown(text))
    },
    [speakingIdx, tts]
  )

  const title = mode === 'sec' ? 'Ask the SEC graph' : 'Ask about this report'
  const canChat = Boolean(provider && backend)
  const showPin = mode === 'sec' && Boolean(secContext) && canChat

  // Empty-state copy + tap-to-run example questions, tailored to the mode (and,
  // in SEC mode, to the filing on screen).
  const who = secContext?.ticker ?? secContext?.entityName ?? ''
  const emptyLead =
    mode === 'sec'
      ? secContext
        ? `Ask anything about ${who}, or explore the wider SEC graph — answers come straight from the filing data.`
        : 'Ask about any public company in the SEC EDGAR graph. Answers are pulled straight from the filings — never guessed.'
      : 'Ask about this report and get answers pulled straight from its own figures — never guessed. Start with a question, or get a quick summary.'
  const examples =
    mode === 'sec'
      ? secContext
        ? [
            `What was ${who}'s revenue?`,
            `Summarize ${who}'s financials`,
            `Biggest year-over-year changes?`,
          ]
        : [
            'What was NVIDIA’s revenue in fiscal 2024?',
            'Compare Apple and Microsoft’s net income',
            'Which companies have the highest total assets?',
          ]
      : ['What is total assets?', 'What was net income?', 'How does this year compare to last?']

  return (
    <aside className={open ? 'chat-drawer open' : 'chat-drawer'} inert={!open}>
      <div className="chat-inner">
        <div className="chat-header">
          <div className="chat-title">
            <strong>{title}</strong>
          </div>
          <button type="button" className="chat-close" onClick={onClose} aria-label="Close chat">
            ×
          </button>
        </div>

        <div className="chat-messages" ref={scrollRef}>
          {turns.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon" aria-hidden="true">
                💬
              </div>
              <p className="chat-empty-lead">{emptyLead}</p>
              {canChat ? (
                <>
                  <p className="chat-examples-label">Try asking</p>
                  <div className="chat-examples">
                    {examples.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className="chat-example"
                        disabled={busy}
                        onClick={() => void runQuestion(q)}
                      >
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                  {hasReportContext ? (
                    <button
                      type="button"
                      className="btn chat-summary"
                      disabled={busy}
                      onClick={() =>
                        void runQuestion(SUMMARY_PROMPT, {
                          summary: true,
                          display: SUMMARY_DISPLAY,
                        })
                      }
                    >
                      ✨ Summarize this report{tts.available ? ' (spoken)' : ''}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
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
                  {tts.available ? (
                    <button
                      type="button"
                      className="chat-readaloud"
                      onClick={() => readAloud(i, turn.text)}
                    >
                      {speakingIdx === i && tts.speaking ? '⏹ Stop' : '🔊 Read aloud'}
                    </button>
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
              <Spinner label={`${status}…`} />
            </div>
          ) : null}
        </div>

        {!llm.isStored ? (
          <div className="chat-connect">
            <p className="hint">Add your Anthropic API key to start chatting.</p>
            <button type="button" className="btn btn-sm" onClick={onOpenSettings}>
              Open Settings
            </button>
          </div>
        ) : !backend ? (
          <p className="hint chat-connect">
            {mode === 'sec' ? (
              <>
                Connect to the SEC graph in the <strong>Graph</strong> tab first.
              </>
            ) : (
              <>
                Open a <code>holon.jsonld</code> in <strong>File</strong> mode, then ask about it.
              </>
            )}
          </p>
        ) : (
          <>
            {showPin ? (
              <label className="chat-pin">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                <span>
                  {pinned
                    ? `Pinned to ${secContext?.ticker ?? secContext?.entityName}`
                    : 'Pin this report to focus answers'}
                </span>
              </label>
            ) : null}
            <form
              className="chat-input"
              onSubmit={(e) => {
                e.preventDefault()
                send()
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
            {tts.error ? <p className="hint chat-tts-error">🔇 {tts.error}</p> : null}
          </>
        )}
      </div>
    </aside>
  )
}
