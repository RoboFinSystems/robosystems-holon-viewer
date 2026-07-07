/**
 * The agentic tool-use loop — the browser port of the backend `tool_loop.py`.
 *
 * Provider-neutral AND backend-neutral: it drives any `ChatBackend` (a tool set +
 * an executor + a system prompt) through a bounded loop — the model calls tools,
 * sees errors fed back as is_error results and retries, then answers. File mode
 * plugs in a local SPARQL backend; SEC mode a remote Cypher/MCP one. Neither the
 * provider nor the tool wiring leaks into this file.
 */
import type { AIMessage, AIProvider, ContentBlock, ToolDef } from './provider'

const MAX_ITERATIONS = 6
// Cap tool results fed back so a large result can't blow the context window.
const MAX_RESULT_CHARS = 12000

/** One tool execution's outcome. */
export interface ToolRun {
  content: string
  isError?: boolean
  /** A query string (SPARQL / Cypher) to surface in the UI reveal. */
  query?: string
}

/** A pluggable chat backend: the tools, how to run them, and the system prompt. */
export interface ChatBackend {
  system: string
  tools: ToolDef[]
  /** Label for the generated-query reveal, e.g. 'SPARQL' or 'Cypher'. */
  queryLabel: string
  runTool: (name: string, input: Record<string, unknown>) => Promise<ToolRun>
}

export interface LoopResult {
  text: string
  query?: string
}

export interface LoopOptions {
  /**
   * Appended to the backend's system prompt for this run — how the report in
   * context (SEC mode) is injected so the agent anchors on the right filing.
   */
  contextNote?: string
  /**
   * Called as the loop moves through phases (thinking → running a tool →
   * interpreting), so the UI can show what the agent is actually doing rather
   * than a single static label.
   */
  onProgress?: (status: string) => void
}

// Tool name → what to tell the user while it runs. Covers both backends'
// tools; anything unmapped falls back to a generic "Working".
const TOOL_STATUS: Record<string, string> = {
  describe_report: 'Reading the report',
  'get-graph-schema': 'Reading the graph schema',
  'get-example-queries': 'Finding query patterns',
  run_sparql: 'Querying the report',
  'read-graph-cypher': 'Querying the graph',
}

export async function runToolLoop(
  provider: AIProvider,
  backend: ChatBackend,
  history: AIMessage[],
  question: string,
  opts: LoopOptions = {}
): Promise<LoopResult> {
  const { contextNote, onProgress } = opts
  const messages: AIMessage[] = [...history, { role: 'user', content: question }]
  const system = contextNote ? `${backend.system}\n\n${contextNote}` : backend.system
  let lastQuery: string | undefined

  onProgress?.('Thinking')
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await provider.createMessage({
      system,
      messages,
      tools: backend.tools,
    })
    if (res.stopReason !== 'tool_use') {
      return { text: res.content, query: lastQuery }
    }

    // Replay the assistant turn (text + tool_use blocks) verbatim.
    messages.push({ role: 'assistant', content: res.blocks })

    const results: ContentBlock[] = []
    for (const block of res.blocks) {
      if (block.type !== 'tool_use') continue
      onProgress?.(TOOL_STATUS[block.name] ?? 'Working')
      let content: string
      let isError = false
      try {
        const run = await backend.runTool(block.name, block.input)
        content = run.content
        isError = run.isError ?? false
        if (run.query) lastQuery = run.query
      } catch (e) {
        content = `Error: ${e instanceof Error ? e.message : String(e)}`
        isError = true
      }
      if (content.length > MAX_RESULT_CHARS) {
        content = `${content.slice(0, MAX_RESULT_CHARS)}\n…[truncated]`
      }
      results.push({ type: 'tool_result', toolUseId: block.id, content, isError })
    }
    messages.push({ role: 'user', content: results })
    onProgress?.('Interpreting results')
  }

  // Step limit hit — one final turn to answer from what was gathered.
  const final = await provider.createMessage({
    system,
    messages: [
      ...messages,
      {
        role: 'user',
        content: 'You have reached the step limit. Answer now from the results gathered so far.',
      },
    ],
    tools: backend.tools,
  })
  return {
    text: final.content || 'I gathered results but ran out of steps before answering.',
    query: lastQuery,
  }
}
