/**
 * Mode B — live SEC graph (bring-your-own API key).
 *
 * A small state machine: connect (validate the key against the SEC repository) →
 * browse (search a company, pick a filing) → report (render, section by section).
 * The key persists in localStorage via `usePersistentApiKey`, and is now entered
 * in the Keys drawer — so this tab reacts to the key being set or cleared there:
 * a good key auto-validates straight into browse, and Disconnect drops back to
 * the connect CTA. While a report is open it publishes that filing's identity via
 * `onReportContext` so the chat can key its summaries on it.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SecReportContext } from '../ai/reportContext'
import { Spinner } from '../components/Spinner'
import { usePersistentApiKey } from '../hooks/usePersistentApiKey'
import { type SecEntity, type SecFiling, validateSecKey } from '../sec/client'
import { ConnectPanel } from './sec/ConnectPanel'
import { ReportPicker } from './sec/ReportPicker'
import { ReportScreen } from './sec/ReportScreen'
import { TickerSearch } from './sec/TickerSearch'

type Phase = 'connect' | 'browse' | 'report'

interface SecModeProps {
  /** Open the Keys drawer (where the RoboSystems key is entered). */
  onOpenSettings: () => void
  /** Publish the on-screen filing's identity (or null) for the chat to key on. */
  onReportContext?: (ctx: SecReportContext | null) => void
}

export function SecMode({ onOpenSettings, onReportContext }: SecModeProps) {
  const { key, setKey } = usePersistentApiKey('sec')

  const [phase, setPhase] = useState<Phase>('connect')
  const [connectError, setConnectError] = useState<string | null>(null)
  const [repoName, setRepoName] = useState<string | null>(null)
  const [entity, setEntity] = useState<SecEntity | null>(null)
  const [filing, setFiling] = useState<SecFiling | null>(null)

  const connect = useCallback(
    async (apiKey: string) => {
      setConnectError(null)
      try {
        const repo = await validateSecKey(apiKey)
        if (!repo) {
          setConnectError('This API key is valid but has no access to the SEC repository.')
          return
        }
        setRepoName(repo.graphName)
        setKey(apiKey)
        setPhase('browse')
      } catch (e) {
        setConnectError(e instanceof Error ? e.message : String(e))
      }
    },
    [setKey]
  )

  // React to the persisted key: a new key (set in the drawer) auto-validates
  // into browse; a cleared key resets to connect. `attemptedKey` stops a failed
  // key from re-validating in a loop — it only retries when the key changes.
  const attemptedKey = useRef<string | null>(null)
  useEffect(() => {
    if (!key) {
      attemptedKey.current = null
      setPhase('connect')
      setRepoName(null)
      setEntity(null)
      setFiling(null)
      setConnectError(null)
      return
    }
    if (phase === 'connect' && key !== attemptedKey.current) {
      attemptedKey.current = key
      void connect(key)
    }
  }, [key, phase, connect])

  // Publish / withdraw the on-screen filing for the chat.
  useEffect(() => {
    if (phase === 'report' && entity && filing) {
      onReportContext?.({
        entityName: entity.name,
        ticker: entity.ticker,
        form: filing.form,
        reportDate: filing.reportDate,
        reportId: filing.reportId,
      })
    } else {
      onReportContext?.(null)
    }
  }, [phase, entity, filing, onReportContext])
  // Clear context when leaving SEC mode entirely (this tab unmounts).
  useEffect(() => () => onReportContext?.(null), [onReportContext])

  const disconnect = useCallback(() => {
    // Clearing the key drives the key-reactive effect, which resets to connect.
    setKey('')
  }, [setKey])

  if (phase === 'connect') {
    // A stored key that hasn't been ruled out yet is still validating → spinner.
    // Only fall to the connect CTA once we know there's no key or no access
    // (connectError set), so the CTA never flashes mid-validation.
    if (key && !connectError) {
      return (
        <div className="panel-card">
          <div className="loading-center">
            <Spinner label="Connecting to the SEC graph…" />
          </div>
        </div>
      )
    }
    return <ConnectPanel error={connectError} onOpenSettings={onOpenSettings} />
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
