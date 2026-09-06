/**
 * The payload contract the local query tools share (SPARQL over a holon, jq
 * over a Tavi model), taken from filing-ladder: a JSON object; `{"error": …}`
 * on failure, so the loop flags it and the model reads the message and
 * retries; clipped, so one result cannot swamp the context.
 */

/** filing-ladder's clip: the most a tool hands back in one payload. */
export const MAX_TOOL_CHARS = 60_000

export function errorPayload(message: string): string {
  return JSON.stringify({ error: message })
}

export function isErrorPayload(payload: string): boolean {
  return payload.trimStart().startsWith('{"error"')
}

export function clip(text: string, limit = MAX_TOOL_CHARS): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}... [truncated: ${text.length - limit} more characters; narrow the request]`
}
