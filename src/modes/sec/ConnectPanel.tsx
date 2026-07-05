import { useState } from 'react'

interface ConnectPanelProps {
  /** Seed the input from the persisted key (so a stored key is pre-filled). */
  initialKey: string
  connecting: boolean
  error: string | null
  onConnect: (apiKey: string) => void
}

/**
 * Step 1 — bring-your-own API key. The key is validated by listing graphs and
 * confirming SEC access; on success it's persisted (localStorage) by the parent.
 */
export function ConnectPanel({ initialKey, connecting, error, onConnect }: ConnectPanelProps) {
  const [value, setValue] = useState(initialKey)
  const trimmed = value.trim()

  return (
    <div className="panel-card">
      <h2>Connect to the SEC graph</h2>
      <p>
        Explore public-company financial filings from the SEC EDGAR knowledge graph. Bring your own
        RoboSystems API key — the authenticated call is made client-side, straight to the API.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (trimmed) onConnect(trimmed)
        }}
      >
        <label className="field">
          <span>API key</span>
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="rfs…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="btn" disabled={connecting || !trimmed}>
          {connecting ? 'Connecting…' : 'Connect'}
        </button>
      </form>

      {error ? <div className="error">{error}</div> : null}

      <p className="hint" style={{ marginTop: '1rem' }}>
        Your key is stored only in this browser and sent directly to the RoboSystems API — never to
        this app (it&apos;s static-hosted with no backend). Clear it any time with{' '}
        <strong>Disconnect</strong>.
      </p>
    </div>
  )
}
