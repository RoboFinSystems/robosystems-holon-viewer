/**
 * What the chat can query for the report on screen — the file's own shape,
 * kept beside the `NormalizedReport` the renderer uses.
 *
 * A holon is RDF, so its queryable form is the N3 store rebuilt from the same
 * document (SPARQL). A Tavi compiled model is one JSON document holding the
 * facts and the taxonomy together, so its queryable form is the document
 * itself (jq): parsed, for `describe_model`, and as text, which the jq worker
 * hands to jq as-is without re-serializing it.
 */
import type { TaviDocument } from '@robosystems/report-components/adapters'
import type { Store } from 'n3'

export type ReportSource =
  { format: 'holon'; store: Store } | { format: 'tavi'; doc: TaviDocument; text: string }
