/**
 * Run a read-only SPARQL query over a report's in-memory RDF store — Comunica
 * over the N3 quad store, entirely client-side. Returns rows as plain
 * `{ variable: value }` objects for the loop to feed back to the model.
 */
import { QueryEngine } from '@comunica/query-sparql-rdfjs'
import type { Store } from 'n3'

const engine = new QueryEngine()

export async function runSparql(store: Store, query: string): Promise<Record<string, string>[]> {
  // A holon keeps its facts in named graphs (#scene / #boundary / #projection),
  // so `unionDefaultGraph` is required — otherwise a default-graph query (no
  // GRAPH clause, which is how the model writes them) matches nothing. Mirrors
  // report-components' parseStore reading the store as a union across graphs.
  const stream = await engine.queryBindings(query, { sources: [store], unionDefaultGraph: true })
  const bindings = await stream.toArray()
  return bindings.map((binding) => {
    const row: Record<string, string> = {}
    for (const [variable, term] of binding) {
      row[variable.value] = term.value
    }
    return row
  })
}
