import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMcpSession } from '../src/ai/mcp'

/** A JSON-RPC response as the transport's non-streaming path returns it. */
function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** An SSE body carrying the given JSON-RPC messages, plus a keepalive comment. */
function sseResponse(messages: unknown[]): Response {
  const body = [': ping\n\n', ...messages.map((m) => `data: ${JSON.stringify(m)}\n\n`)].join('')
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  result: { protocolVersion: '2025-06-18', capabilities: { tools: {} } },
}

/** Queue responses in order; returns the mock so calls can be inspected. */
function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn()
  for (const res of responses) fetchMock.mockResolvedValueOnce(res)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, call: number) =>
  JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string)

const headersOf = (fetchMock: ReturnType<typeof vi.fn>, call: number) =>
  (fetchMock.mock.calls[call][1] as RequestInit).headers as Record<string, string>

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('remote MCP transport client', () => {
  it('initializes once, then calls tools over JSON-RPC at the graph URL', async () => {
    const fetchMock = mockFetch(
      jsonResponse(INITIALIZE),
      jsonResponse({
        jsonrpc: '2.0',
        id: 2,
        result: { content: [{ type: 'text', text: 'rows' }] },
      }),
      jsonResponse({
        jsonrpc: '2.0',
        id: 3,
        result: { content: [{ type: 'text', text: 'more' }] },
      })
    )

    const session = createMcpSession('sk-test', 'sec')
    expect(await session.callTool('read-graph-cypher', { query: 'MATCH (n) RETURN n LIMIT 1' })) //
      .toEqual({ text: 'rows', isError: false })
    expect(await session.callTool('get-graph-schema', {})).toEqual({
      text: 'more',
      isError: false,
    })

    // One handshake, two tool calls — all POSTed to the graph-scoped endpoint.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe('/v1/graphs/sec/mcp')
      expect((init as RequestInit).method).toBe('POST')
    }
    expect(bodyOf(fetchMock, 0).method).toBe('initialize')
    expect(bodyOf(fetchMock, 1)).toMatchObject({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'read-graph-cypher' },
    })

    // The key rides every request; the negotiated version is echoed after the
    // handshake (never before — the server rejects a version it can't serve).
    expect(headersOf(fetchMock, 0)['X-API-Key']).toBe('sk-test')
    expect(headersOf(fetchMock, 0)['MCP-Protocol-Version']).toBeUndefined()
    expect(headersOf(fetchMock, 1)['MCP-Protocol-Version']).toBe('2025-06-18')
    expect(headersOf(fetchMock, 1).Accept).toContain('text/event-stream')
  })

  it('relays streamed progress and resolves with the final SSE message', async () => {
    const fetchMock = mockFetch(
      jsonResponse(INITIALIZE),
      sseResponse([
        {
          jsonrpc: '2.0',
          method: 'notifications/progress',
          params: { progressToken: 2, progress: 1, message: 'Fetched 5000 rows' },
        },
        { jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: 'done' }] } },
      ])
    )

    const progress: string[] = []
    const session = createMcpSession('sk-test', 'sec')
    const run = await session.callTool('read-graph-cypher', { query: 'MATCH (n) RETURN n' }, (m) =>
      progress.push(m)
    )

    expect(run).toEqual({ text: 'done', isError: false })
    expect(progress).toEqual(['Fetched 5000 rows'])
    // Progress is only emitted for a call that asked for it by token.
    expect(bodyOf(fetchMock, 1).params._meta.progressToken).toBe(2)
  })

  it('returns a tool failure as isError so the model can read it and retry', async () => {
    mockFetch(
      jsonResponse(INITIALIZE),
      jsonResponse({
        jsonrpc: '2.0',
        id: 2,
        result: { content: [{ type: 'text', text: 'Query timed out' }], isError: true },
      })
    )

    const session = createMcpSession('sk-test', 'sec')
    expect(await session.callTool('read-graph-cypher', { query: 'MATCH (n) RETURN n' })).toEqual({
      text: 'Query timed out',
      isError: true,
    })
  })

  it('throws on a JSON-RPC protocol error and on an HTTP failure', async () => {
    mockFetch(
      jsonResponse(INITIALIZE),
      jsonResponse({
        jsonrpc: '2.0',
        id: 2,
        error: { code: -32601, message: 'Method not found: tools/call' },
      })
    )
    const session = createMcpSession('sk-test', 'sec')
    await expect(session.callTool('nope', {})).rejects.toThrow('Method not found')

    vi.unstubAllGlobals()
    mockFetch(
      new Response(JSON.stringify({ detail: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const denied = createMcpSession('sk-test', 'sec')
    await expect(denied.callTool('get-graph-schema', {})).rejects.toThrow('Origin not allowed')
  })

  it('retries the handshake after a failed one instead of wedging the session', async () => {
    const fetchMock = mockFetch(
      new Response('gateway timeout', { status: 504 }),
      jsonResponse(INITIALIZE),
      jsonResponse({ jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: 'ok' }] } })
    )

    const session = createMcpSession('sk-test', 'sec')
    await expect(session.callTool('get-graph-schema', {})).rejects.toThrow('HTTP 504')
    expect(await session.callTool('get-graph-schema', {})).toEqual({ text: 'ok', isError: false })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
