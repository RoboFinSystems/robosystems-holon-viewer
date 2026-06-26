/**
 * Mode B — live SEC graph (bring-your-own API key). Phase 2.
 *
 * The plan: the user supplies an API key, the library's cypher adapter pulls a
 * company's report from the live SEC graph client-side, and the *same* shared
 * components render it — no app backend. Stubbed until the cypher adapter lands.
 */
export function SecMode() {
  return (
    <div className="panel-card">
      <span className="badge">Coming soon</span>
      <h2>Connect to the SEC graph</h2>
      <p>
        Pull a company&apos;s report live from the SEC graph with your own API key. The
        authenticated call is made client-side — there&apos;s still no app backend — and the same
        components render it, proving the rendering is source-agnostic.
      </p>

      <label className="field">
        <span>API key</span>
        <input type="password" placeholder="rs_…" disabled />
      </label>
      <label className="field">
        <span>Company / ticker</span>
        <input type="text" placeholder="e.g. AAPL" disabled />
      </label>

      <button type="button" className="btn" disabled>
        Fetch report
      </button>
      <p className="hint" style={{ marginTop: '1rem' }}>
        For now, use <strong>File</strong> mode to open a <code>holon.trig</code> offline.
      </p>
    </div>
  )
}
