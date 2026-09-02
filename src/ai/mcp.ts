/**
 * A minimal MCP client speaking Streamable HTTP (JSON-RPC 2.0) straight from
 * the browser, against `POST /v1/graphs/{graph_id}/mcp` — the platform's
 * native MCP transport, the same endpoint `@robosystems/mcp` proxies for stdio
 * hosts and Claude connects as a custom connector. It replaces the REST tool
 * endpoints (`GET /mcp/tools`, `POST /mcp/call-tool`), removed server-side.
 *
 * Three things the transport gives us that the REST pair didn't:
 *
 * - the graph is the URL, so `graph_id` never becomes a tool argument;
 * - `Accept: …, text/event-stream` opts a call into the server's shared query
 *   queue (cypher reads bypass admission control otherwise) and streams
 *   `notifications/progress` back while the query runs;
 * - tool failures arrive as `result.isError`, not HTTP errors, so the model
 *   can read the message and retry instead of the loop swallowing it.
 *
 * The transport is stateless — no `Mcp-Session-Id`, no GET-side channel — so a
 * "session" here is just the negotiated protocol version, learned once at
 * `initialize` and echoed on every later request per the spec.
 *
 * BYO key: the user's `X-API-Key` travels on each call and never leaves the
 * browser (this app is static-hosted and has no backend of its own).
 */
const viteEnv = (import.meta as { env?: { DEV?: boolean; VITE_ROBOSYSTEMS_API_URL?: string } }).env
// Dev: relative base → the Vite proxy (dodges the API's CORS allowlist, and
// strips the localhost Origin the transport's origin gate would reject).
// Prod: call the API directly (its allowlist must include the deployed origin).
const DEFAULT_API_URL = viteEnv?.DEV
  ? ''
  : (viteEnv?.VITE_ROBOSYSTEMS_API_URL ?? 'https://api.robosystems.ai')

/** The revision we ask for at initialize; the server answers with what it can serve. */
const PROTOCOL_VERSION = '2025-06-18'

const CLIENT_INFO = { name: 'robosystems-holon-viewer', version: '0.1.0' }

/** One tool call's outcome. A tool that failed still returns its message. */
export interface McpToolRun {
  text: string
  isError: boolean
}

export interface McpSession {
  callTool(
    name: string,
    args: Record<string, unknown>,
    onProgress?: (message: string) => void
  ): Promise<McpToolRun>
}

interface JsonRpcMessage {
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: { code?: number; message?: string }
}

/** Concatenate the text blocks of an MCP `tools/call` result. */
function extractText(result: Record<string, unknown> | undefined): string {
  const content = result?.content
  if (!Array.isArray(content)) return JSON.stringify(result ?? {})
  return content
    .map((block) => {
      const b = block as { type?: string; text?: unknown }
      return b?.type === 'text' ? String(b.text ?? '') : JSON.stringify(block)
    })
    .join('\n')
}

/**
 * Read an SSE body and hand each event's JSON payload to `deliver`. Multi-line
 * `data:` fields are joined per the spec; comment lines (the server's keepalive
 * pings, which carry the stream across the ALB idle timeout) are ignored, as
 * are `event:` / `id:` / `retry:` — this endpoint puts all JSON-RPC content in
 * `data:`.
 */
async function readSse(
  body: ReadableStream<Uint8Array>,
  deliver: (message: JsonRpcMessage) => void
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let dataLines: string[] = []

  const dispatch = () => {
    if (dataLines.length === 0) return
    const payload = dataLines.join('\n')
    dataLines = []
    if (!payload) return
    try {
      deliver(JSON.parse(payload) as JsonRpcMessage)
    } catch {
      // A truncated or non-JSON event tells us nothing — skip it and read on.
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line === '') dispatch()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
      }
    }
    // A stream that ended without its final blank line still has an event.
    if (buffer.startsWith('data:')) dataLines.push(buffer.slice(5).replace(/^ /, ''))
    dispatch()
  } finally {
    void reader.cancel().catch(() => {})
  }
}

/** The `progress` notification's human message, when it carries one. */
function progressMessage(message: JsonRpcMessage): string | undefined {
  if (message.method !== 'notifications/progress') return undefined
  const text = message.params?.message
  return typeof text === 'string' && text ? text : undefined
}

export function createMcpSession(apiKey: string, graphId: string): McpSession {
  const endpoint = `${DEFAULT_API_URL}/v1/graphs/${graphId}/mcp`
  // Learned at initialize and echoed afterwards; the server rejects a version
  // it can't serve, and accepts requests that carry none.
  let protocolVersion: string | null = null
  let handshake: Promise<void> | null = null
  let nextId = 1

  const headers = (): Record<string, string> => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      // Both, so the server may answer either way: it streams the long calls
      // (and routes them through the query queue) and returns plain JSON for
      // the rest.
      Accept: 'application/json, text/event-stream',
      'X-API-Key': apiKey,
    }
    if (protocolVersion) h['MCP-Protocol-Version'] = protocolVersion
    return h
  }

  /** Send one JSON-RPC request and resolve with its response message. */
  const rpc = async (
    method: string,
    params: Record<string, unknown>,
    onProgress?: (message: string) => void
  ): Promise<JsonRpcMessage> => {
    const id = nextId++
    // The server emits notifications/progress only for a call that asked for
    // them by token (the MCP contract); the request id doubles as the token.
    const body = onProgress ? { ...params, _meta: { progressToken: id } } : params
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params: body }),
    })

    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const body = (await res.json()) as { error?: { message?: string }; detail?: string }
        detail = body.error?.message ?? body.detail ?? detail
      } catch {
        // non-JSON error body — keep the status line
      }
      throw new Error(detail)
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('text/event-stream') && res.body) {
      let response: JsonRpcMessage | undefined
      await readSse(res.body, (message) => {
        const note = progressMessage(message)
        if (note) onProgress?.(note)
        else if (message.id === id) response = message
      })
      if (!response) throw new Error('The server closed the stream before answering.')
      return response
    }

    return (await res.json()) as JsonRpcMessage
  }

  /** Negotiate once per session; concurrent callers await the same handshake. */
  const initialize = (): Promise<void> => {
    if (handshake) return handshake
    const pending = (async () => {
      const message = await rpc('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO,
      })
      if (message.error) throw new Error(message.error.message ?? 'initialize failed')
      const negotiated = message.result?.protocolVersion
      if (typeof negotiated === 'string') protocolVersion = negotiated
    })()
    // Let the next call retry rather than wedging the session on one blip.
    handshake = pending.catch((e: unknown) => {
      handshake = null
      throw e
    })
    return handshake
  }

  return {
    async callTool(name, args, onProgress) {
      await initialize()
      const message = await rpc('tools/call', { name, arguments: args }, onProgress)
      if (message.error) throw new Error(message.error.message ?? 'Tool call failed')
      return {
        text: extractText(message.result),
        isError: message.result?.isError === true,
      }
    },
  }
}
