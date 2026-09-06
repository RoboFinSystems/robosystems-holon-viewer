/**
 * Evaluate one read-only jq program over a Tavi document and shape the result
 * for the model — the port of filing-ladder's `run_jq`. Pure: it takes a loaded
 * jq handle and the document text, so the same code runs in the browser worker
 * (`jqWorker.ts`) and under Node in tests.
 *
 * The document goes to jq as text, not as an object: jq-wasm passes a string
 * through as raw JSON, so a multi-megabyte model is parsed once by jq per call
 * rather than stringified by us first.
 */
import type { Jq } from 'jq-wasm'
import { clip, errorPayload } from './toolPayload'

export const JQ_TIMEOUT_MS = 60_000
export const MAX_RESULTS = 200
const HARD_RESULT_CAP = 100_000

// jq can read the process environment ($ENV, env). The worker's holds nothing
// secret, but the environment is not part of the report — keep the model on
// the document, as filing-ladder does.
const ENVIRONMENT = /\$ENV\b|(?<![\w$.])env\b/

export function timeoutPayload(timeoutMs: number): string {
  return errorPayload(
    `jq program timed out after ${Math.round(timeoutMs / 1000)}s — it is unbounded or walks the whole document repeatedly. Select on one concept, one period or one network first, and use limit(n; ...) or first(...).`
  )
}

export function evaluateJq(
  jq: Jq,
  text: string,
  program: string,
  maxResults = MAX_RESULTS
): string {
  if (ENVIRONMENT.test(program)) {
    return errorPayload('$ENV / env are not available: the environment is not part of the report.')
  }
  const run = jq.raw(text, program, ['-c'])
  if (run.exitCode !== 0) {
    return errorPayload(`jq error: ${run.stderr.trim() || `exit code ${run.exitCode}`}`)
  }
  // -c prints one JSON value per line, so lines are outputs.
  const lines = run.stdout.split('\n').filter((line) => line !== '')
  const total = lines.length
  const results = lines.slice(0, maxResults).map(parseOutput)
  const payload: { result_count: number; results: unknown[]; note?: string } = {
    result_count: total,
    results,
  }
  if (total >= HARD_RESULT_CAP) {
    payload.note = `${total.toLocaleString()} results — the program is unbounded; showing ${maxResults}`
  } else if (total > maxResults) {
    payload.note = `showing ${maxResults} of ${total} results; select more narrowly`
  } else if (total === 0 || (total === 1 && isEmptyValue(results[0]))) {
    payload.note =
      'empty result — the selection matched nothing; check the QName (example 1), the period literal (an exclusive-end dateTime interval) and the collection you started from'
  }
  return clip(JSON.stringify(payload))
}

function parseOutput(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return line
  }
}

function isEmptyValue(value: unknown): boolean {
  return value === null || (Array.isArray(value) && value.length === 0)
}
