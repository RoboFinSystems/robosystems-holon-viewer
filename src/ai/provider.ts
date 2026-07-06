/**
 * The AI provider seam for the report chat.
 *
 * Every AI call flows through one provider-neutral interface (`AIProvider`) and
 * returns a generic `AIResponse`, so the agentic query loop above it has zero
 * provider knowledge. Mirrors the backend's
 * `robosystems/operations/operators/ai_client.py` (AIMessage / AIResponse /
 * create_message) — the same seam, ported to the browser.
 *
 * Anthropic is the only implementation today (`./anthropic`). A second provider
 * (OpenAI-compatible) is a NEW FILE behind this interface, with nothing above it
 * changing — the provider is the only layer that knows a wire format. Keep it
 * that way: the loop and UI import from here, never from a provider SDK.
 */

/** A single tool the model may call. Provider-neutral (JSON Schema input). */
export interface ToolDef {
  name: string
  description: string
  /** JSON Schema for the tool's input object. */
  inputSchema: Record<string, unknown>
}

/** Plain text the model emitted, or the user wrote. */
export interface TextBlock {
  type: 'text'
  text: string
}

/** The model's request to call a tool. */
export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

/** The result we feed back for a prior `tool_use`. */
export interface ToolResultBlock {
  type: 'tool_result'
  toolUseId: string
  content: string
  isError?: boolean
}

/**
 * One turn's content. A block list carries a tool-use round-trip (assistant
 * `tool_use` → user `tool_result`); a simple single-shot turn passes a string.
 */
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface AIResponse {
  /** Concatenated text of every text block — for simple, single-shot callers. */
  content: string
  model: string
  inputTokens: number
  outputTokens: number
  /** 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' | … (provider-normalized). */
  stopReason: string | null
  /**
   * The full block list (text + tool_use), replayed verbatim as the assistant
   * turn on the next loop iteration. A `tool_use` block here → the loop runs the
   * tool and returns a matching `tool_result`.
   */
  blocks: ContentBlock[]
}

export interface CreateMessageParams {
  messages: AIMessage[]
  system?: string
  /** Provider-native model id override; the provider picks a sensible default. */
  model?: string
  maxTokens?: number
  /** Tools the model may call this turn. */
  tools?: ToolDef[]
}

/**
 * The seam. One method, mirroring `ai_client.py`'s `create_message`. The whole
 * agentic loop is written against this — swap the implementation to swap the
 * provider.
 */
export interface AIProvider {
  createMessage(params: CreateMessageParams): Promise<AIResponse>
}
