interface ConnectPanelProps {
  /** Validation error from a stored/failed key (e.g. no SEC access). */
  error: string | null
  /** Open the Keys drawer, where the RoboSystems key is now entered. */
  onOpenSettings: () => void
}

/**
 * Step 1 — bring-your-own API key. Key entry now lives in the Keys drawer
 * (one place for every key), so this just points there. `SecMode` validates the
 * stored key on load and drops the user straight into browse when it's good.
 */
export function ConnectPanel({ error, onOpenSettings }: ConnectPanelProps) {
  return (
    <div className="panel-card">
      <h2>Connect to the SEC graph</h2>
      <p>
        Explore public-company financial filings from the SEC EDGAR knowledge graph. Add your
        RoboSystems API key in <strong>Settings</strong> to connect — the authenticated call is made
        client-side, straight to the API.
      </p>

      <button type="button" className="btn" onClick={onOpenSettings}>
        Open Settings
      </button>

      {error ? <div className="error">{error}</div> : null}

      <p className="hint" style={{ marginTop: '1rem' }}>
        Your key is stored only in this browser and sent directly to the RoboSystems API — never to
        this app (it&apos;s static-hosted with no backend). Manage or clear it any time in Settings.
      </p>
    </div>
  )
}
