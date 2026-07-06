/**
 * Call a RoboSystems MCP tool over HTTP — the same `/mcp/call-tool` endpoint the
 * `@robosystems/mcp` stdio server wraps, but callable directly from the browser
 * (BYO key via `X-API-Key`). `?format=json` forces a synchronous response.
 *
 * The API returns an MCPToolResult: `{ result: { type: "text", text: "<...>" } }`.
 */
const viteEnv = (import.meta as { env?: { DEV?: boolean; VITE_ROBOSYSTEMS_API_URL?: string } }).env
// Dev: relative base → the Vite proxy (dodges the API's CORS allowlist).
// Prod: call the API directly (its allowlist must include the deployed origin).
const DEFAULT_API_URL = viteEnv?.DEV
  ? ''
  : (viteEnv?.VITE_ROBOSYSTEMS_API_URL ?? 'https://api.robosystems.ai')

/** Pull the text content out of an MCPToolResult. */
function extractText(data: unknown): string {
  if (typeof data === 'string') return data
  const result = (data as { result?: unknown }).result
  if (result && typeof result === 'object' && 'text' in result) {
    return String((result as { text: unknown }).text)
  }
  if (Array.isArray(result)) {
    return result
      .map((block) => (block as { text?: unknown })?.text ?? JSON.stringify(block))
      .join('\n')
  }
  return JSON.stringify(result ?? data)
}

export async function callMcpTool(
  apiKey: string,
  graphId: string,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`${DEFAULT_API_URL}/v1/graphs/${graphId}/mcp/call-tool?format=json`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, arguments: args }),
  })
  if (res.status === 202) {
    return 'The query was queued (result too large for a direct response). Add a LIMIT or narrow it, then retry.'
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: string; error?: string }
      detail = body.detail ?? body.error ?? detail
    } catch {
      // non-JSON error body — keep the status line
    }
    throw new Error(detail)
  }
  return extractText(await res.json())
}
