/**
 * Build the queryable RDF store from a holon.jsonld document.
 *
 * `report-components`' `parseJsonld` builds this same N3 store internally to
 * derive the NormalizedReport, then discards it. We rebuild it here so the chat
 * loop can run SPARQL over the exact RDF the report renders from — kept in the
 * app (not the library) per the harness-first pattern; extract upstream if it
 * stabilizes.
 */
import type { JsonLdDocument } from 'jsonld'
import jsonld from 'jsonld'
import { Parser, Store } from 'n3'

export async function buildStore(holonText: string): Promise<Store> {
  const json = JSON.parse(holonText) as JsonLdDocument
  // N-Quads preserves the holon's named graphs (scene/boundary/projection).
  const nquads = (await jsonld.toRDF(json, { format: 'application/n-quads' })) as string
  return new Store(new Parser({ format: 'application/n-quads' }).parse(nquads))
}
