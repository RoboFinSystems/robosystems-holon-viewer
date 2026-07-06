/**
 * Mode B — live SEC graph (bring-your-own API key).
 *
 * A small state machine: connect (validate the key against the SEC repository) →
 * browse (search a company, pick a filing) → report (render, section by section).
 * The key persists in localStorage via `usePersistentApiKey`, so a returning
 * visitor is validated and dropped straight into browse. The same hook backs the
 * chat-provider key as a fast-follow (a different `slot`).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Spinner } from '../components/Spinner'
import { usePersistentApiKey } from '../hooks/usePersistentApiKey'
import { configureSec, findSecRepository, type SecEntity, type SecFiling } from '../sec/client'
import { ConnectPanel } from './sec/ConnectPanel'
import { ReportPicker } from './sec/ReportPicker'
import { ReportScreen } from './sec/ReportScreen'
import { TickerSearch } from './sec/TickerSearch'

type Phase = 'connect' | 'browse' | 'report'

export function SecMode() {
  const { key, setKey, clear } = usePersistentApiKey('sec')

  const [phase, setPhase] = useState<Phase>('connect')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [repoName, setRepoName] = useState<string | null>(null)
  const [entity, setEntity] = useState<SecEntity | null>(null)
  const [filing, setFiling] = useState<SecFiling | null>(null)
  // True while a stored key is auto-validated on mount — show a spinner instead
  // of flashing the full connect form.
  const [autoValidating, setAutoValidating] = useState(() => Boolean(key))

  const connect = useCallback(
    async (apiKey: string) => {
      setConnecting(true)
      setConnectError(null)
      configureSec(apiKey)
      try {
        const repo = await findSecRepository()
        if (!repo) {
          setConnectError('This API key is valid but has no access to the SEC repository.')
          return
        }
        setRepoName(repo.graphName)
        setKey(apiKey)
        setPhase('browse')
      } catch (e) {
        setConnectError(e instanceof Error ? e.message : String(e))
      } finally {
        setConnecting(false)
      }
    },
    [setKey]
  )

  // A stored key auto-validates once on mount → straight to browse.
  const autoTried = useRef(false)
  useEffect(() => {
    if (autoTried.current) return
    autoTried.current = true
    if (key) connect(key).finally(() => setAutoValidating(false))
    else setAutoValidating(false)
  }, [key, connect])

  const disconnect = useCallback(() => {
    clear()
    setPhase('connect')
    setRepoName(null)
    setEntity(null)
    setFiling(null)
    setConnectError(null)
  }, [clear])

  if (phase === 'connect') {
    if (autoValidating) {
      return (
        <div className="panel-card">
          <div className="loading-center">
            <Spinner label="Checking your saved API key…" />
          </div>
        </div>
      )
    }
    return (
      <ConnectPanel
        initialKey={key}
        connecting={connecting}
        error={connectError}
        onConnect={connect}
      />
    )
  }

  if (phase === 'report' && entity && filing) {
    return (
      <ReportScreen
        entity={entity}
        filing={filing}
        onBack={() => {
          setFiling(null)
          setPhase('browse')
        }}
      />
    )
  }

  // browse
  return (
    <div className="sec-browse">
      <div className="sec-browse-head">
        <div>
          <h2>SEC EDGAR</h2>
          <p className="hint">
            Connected to <strong>{repoName ?? 'SEC repository'}</strong> — search a public company
            to view its filings.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={disconnect}>
          Disconnect
        </button>
      </div>

      <TickerSearch selected={entity} onSelect={(e) => setEntity(e)} />

      {entity ? (
        <ReportPicker
          entity={entity}
          onSelect={(f) => {
            setFiling(f)
            setPhase('report')
          }}
        />
      ) : (
        <div className="sec-empty">
          <p className="hint">Start typing a ticker (e.g. NVDA) or a company name.</p>
        </div>
      )}
    </div>
  )
}
