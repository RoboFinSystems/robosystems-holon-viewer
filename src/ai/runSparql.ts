/**
 * Run a read-only SPARQL query over a report's in-memory RDF store — Comunica
 * over the N3 quad store, entirely client-side — and shape the result for the
 * model the way filing-ladder's `run_sparql` does: `{columns, row_count,
 * rows, note}`, `{ask}` for ASK, `{error}` for anything the model must fix.
 *
 * A wall-clock limit bounds a model-written cross product: Comunica evaluates
 * asynchronously, so on timeout the bindings stream is destroyed and the model
 * gets a tool error it can recover from.
 */
import { QueryEngine } from '@comunica/query-sparql-rdfjs'
import type { Store } from 'n3'
import { compact } from './describeReport'
import { clip, errorPayload } from './toolPayload'

const engine = new QueryEngine()

export const SPARQL_TIMEOUT_MS = 60_000
export const MAX_ROWS = 200

const READ_ONLY = /^\s*(PREFIX\s+\S+\s+<[^>]*>\s*)*(SELECT|ASK)\b/i

const NUMERIC_TYPES = new Set(
  ['decimal', 'integer', 'double', 'float', 'long', 'int', 'short', 'nonNegativeInteger'].map(
    (t) => `http://www.w3.org/2001/XMLSchema#${t}`
  )
)

interface RunSparqlOptions {
  maxRows?: number
  timeoutMs?: number
}

export async function runSparql(
  store: Store,
  query: string,
  { maxRows = MAX_ROWS, timeoutMs = SPARQL_TIMEOUT_MS }: RunSparqlOptions = {}
): Promise<string> {
  if (!READ_ONLY.test(query)) return errorPayload('Only SELECT or ASK queries are allowed.')

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs)
  })
  const timedOut = () =>
    errorPayload(
      `SPARQL query timed out after ${Math.round(timeoutMs / 1000)}s — the pattern is too broad (an unbounded join or cross product). Anchor on one concept or one period, and add a LIMIT.`
    )

  try {
    // A holon keeps its facts in named graphs (#scene / #boundary /
    // #projection), so `unionDefaultGraph` is required — otherwise a
    // default-graph query (no GRAPH clause, which is how the model writes them)
    // matches nothing. Mirrors report-components' parseStore reading the store
    // as a union across graphs.
    const result = await engine.query(query, { sources: [store], unionDefaultGraph: true })

    if (result.resultType === 'boolean') {
      const ask = await Promise.race([result.execute(), timeout])
      return ask === 'timeout' ? timedOut() : JSON.stringify({ ask })
    }
    if (result.resultType !== 'bindings') {
      return errorPayload('Only SELECT or ASK queries are allowed.')
    }

    const stream = await result.execute()
    const outcome = await Promise.race([stream.toArray(), timeout])
    if (outcome === 'timeout') {
      stream.destroy()
      return timedOut()
    }
    const columns = (await result.metadata()).variables.map((v) => v.value)
    const total = outcome.length
    const rows = outcome.slice(0, maxRows).map((binding) => {
      const row: Record<string, unknown> = {}
      for (const column of columns) row[column] = plain(binding.get(column))
      return row
    })
    const payload: { columns: string[]; row_count: number; rows: unknown[]; note?: string } = {
      columns,
      row_count: total,
      rows,
    }
    if (total > maxRows) {
      payload.note = `showing ${maxRows} of ${total} rows; add a FILTER or LIMIT`
    } else if (total === 0) {
      payload.note =
        '0 rows — the pattern matched nothing; check the qname, the period shape and the PREFIX lines'
    }
    return clip(JSON.stringify(payload))
  } catch (e) {
    return errorPayload(`SPARQL error: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    clearTimeout(timer)
  }
}

/** The shape of an RDF/JS term, whichever library's it is (Comunica's are @rdfjs/types). */
interface RdfTerm {
  termType: string
  value: string
  datatype?: { value: string }
}

/** An RDF term as the model should read it: numbers as numbers, IRIs compacted. */
function plain(term: RdfTerm | undefined): unknown {
  if (!term) return null
  switch (term.termType) {
    case 'Literal': {
      if (NUMERIC_TYPES.has(term.datatype?.value ?? '')) {
        const n = Number(term.value)
        return Number.isFinite(n) ? n : term.value
      }
      return term.value
    }
    case 'NamedNode':
      return compact(term.value)
    case 'BlankNode':
      return `_:${term.value}`
    default:
      return term.value
  }
}
