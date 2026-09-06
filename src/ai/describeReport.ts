/**
 * The `describe_report` tool payload — the holon's vocabulary, the node shapes
 * computed from the graph, what this report contains, and working SPARQL to
 * start from. Brought to parity with filing-ladder's rung 7c hand-off
 * (`representations/holon.py`), so the holon and Tavi backends give the model
 * the same kind of orientation and differ only in data model and query
 * language.
 *
 * Everything here is read from the N3 store the chat queries — not from the
 * NormalizedReport the renderer uses — so what the model is told is what its
 * queries will see. In particular concepts are named by their rs:internalId
 * (the qname literal): a filer's own concepts (`nvda:…`) have no PREFIX the
 * model could write, and the literal sidesteps that.
 */
import { DataFactory, type NamedNode, type Store, type Term } from 'n3'

const { namedNode } = DataFactory

export const PREFIXES: Record<string, string> = {
  rs: 'https://robosystems.ai/vocab/',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  xbrli: 'http://www.xbrl.org/2003/instance#',
  xlink: 'http://www.w3.org/1999/xlink#',
  link: 'http://www.xbrl.org/2003/linkbase#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  'us-gaap': 'http://fasb.org/us-gaap/',
  dei: 'http://xbrl.sec.gov/dei/',
  srt: 'http://fasb.org/srt/',
  'rs-gaap': 'https://robosystems.ai/taxonomy/rs-gaap/v1/',
  iso4217: 'http://www.xbrl.org/2003/iso4217#',
  concept: 'https://robosystems.ai/concept/',
}

export const PREFIX_BLOCK = Object.entries(PREFIXES)
  .map(([prefix, iri]) => `PREFIX ${prefix}: <${iri}>`)
  .join('\n')

const RDF_TYPE = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
const rs = (local: string): NamedNode => namedNode(PREFIXES.rs + local)
const xbrli = (local: string): NamedNode => namedNode(PREFIXES.xbrli + local)
const PREF_LABEL = namedNode(PREFIXES.skos + 'prefLabel')

/** Compact an IRI with the prefixes above, else keep it angle-bracketed. */
export function compact(iri: string): string {
  for (const [prefix, base] of Object.entries(PREFIXES)) {
    if (iri.startsWith(base)) return `${prefix}:${iri.slice(base.length)}`
  }
  return `<${iri}>`
}

/** Working SPARQL patterns for a holon, each with the why. Prefixed at use. */
export const EXAMPLE_QUERIES: ReadonlyArray<readonly [string, string]> = [
  [
    'Find a concept by its label (the qname is what every other query needs).',
    `SELECT ?qname ?label (COUNT(?f) AS ?facts) WHERE {
  ?el a rs:Element ; rs:internalId ?qname ; skos:prefLabel ?label .
  OPTIONAL { ?f rs:element ?el }
  FILTER (CONTAINS(LCASE(?label), "property, plant"))
} GROUP BY ?qname ?label ORDER BY DESC(?facts)`,
  ],
  [
    'Consolidated (undimensioned) values of one concept, with the period pinned. Two facts can share an end date (the annual and the fourth quarter); rs:durationType and the start date tell them apart.',
    `SELECT ?qname ?label ?value ?start ?end ?instant ?ptype ?dtype ?measure WHERE {
  ?f a rs:Fact ; rs:element ?el ; rs:period ?p ; rs:numericValue ?value .
  ?el rs:internalId ?qname .
  OPTIONAL { ?el skos:prefLabel ?label }
  ?p xbrli:periodType ?ptype .
  OPTIONAL { ?p xbrli:startDate ?start } OPTIONAL { ?p xbrli:endDate ?end }
  OPTIONAL { ?p xbrli:instant ?instant } OPTIONAL { ?p rs:durationType ?dtype }
  OPTIONAL { ?f rs:unit ?u . ?u xbrli:measure ?measure }
  FILTER NOT EXISTS { ?f rs:dimension ?d }
  FILTER (?qname = "us-gaap:Revenues")
} ORDER BY DESC(?end) DESC(?instant)`,
  ],
  [
    'The dimensional breakdown of a concept (segments, members) for one period end.',
    `SELECT ?axis ?member ?value ?start ?end WHERE {
  ?f a rs:Fact ; rs:element ?el ; rs:period ?p ; rs:numericValue ?value ; rs:dimension ?d .
  ?el rs:internalId "us-gaap:Revenues" .
  ?d rs:axis ?axis ; rs:member ?member .
  ?p xbrli:endDate ?end . OPTIONAL { ?p xbrli:startDate ?start }
  FILTER (STR(?end) = "2024-12-31")
} ORDER BY ?axis ?member`,
  ],
  [
    'What sums to a concept: its calculation children with weights (the taxonomy is in the graph).',
    `SELECT ?childQname ?childLabel ?weight ?order WHERE {
  ?a rs:associationType "calculation" ; xlink:from ?parent ; xlink:to ?child ;
     link:weight ?weight ; link:order ?order .
  ?parent rs:internalId "us-gaap:OperatingIncomeLoss" .
  ?child rs:internalId ?childQname . OPTIONAL { ?child skos:prefLabel ?childLabel }
} ORDER BY ?order`,
  ],
  [
    'Which statements or notes a concept appears on (presentation structures), and its label there.',
    `SELECT ?structureLabel ?preferredLabel WHERE {
  ?s a rs:Structure ; skos:prefLabel ?structureLabel ; rs:hasAssociation ?a .
  ?a rs:associationType "presentation" ; xlink:to ?el .
  OPTIONAL { ?a rs:preferredLabel ?preferredLabel }
  ?el rs:internalId "us-gaap:Goodwill" .
}`,
  ],
]

const CONCEPTS_LISTED = 40

export function describeReport(store: Store): string {
  const examples = EXAMPLE_QUERIES.map(
    ([why, query]) => `# ${why}\n${PREFIX_BLOCK}\n${query}`
  ).join('\n\n')

  return `This is ONE financial report as RDF (an XBRL "holon"), queryable with read-only SPARQL 1.1.
Always include these PREFIX lines:

${PREFIX_BLOCK}

${reportLine(store)}
Node shapes, computed from this graph (type: predicate ×count):
${nodeShapes(store)}

Reading a value: a rs:Fact has rs:element (the concept), rs:period, rs:unit, and rs:numericValue
or rs:stringValue. A fact with any rs:dimension is a breakdown (segment, member); the
consolidated total is the fact WITHOUT rs:dimension — use FILTER NOT EXISTS { ?f rs:dimension ?d }.
Concepts are identified by rs:internalId (the qname, e.g. "us-gaap:Revenues"); join
skos:prefLabel for the human label. Periods carry xbrli:startDate / xbrli:endDate (duration) or
xbrli:instant, plus rs:durationType (annual | quarterly | other). Presentation, calculation and
definition relationships are rs:Association nodes (xlink:from, xlink:to, link:order, link:weight,
rs:associationType) grouped under rs:Structure nodes — the taxonomy is in this graph.

Most-reported concepts in this report (qname → label; the full set is found by query):
${conceptsPresent(store)}

Periods present:
${periodsPresent(store)}

Units present:
${unitsPresent(store)}

Example queries (working patterns for this graph — start from these):

${examples}`
}

function tally(values: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return counts
}

/** Entries by descending count, ties by key. */
function mostCommon(counts: Map<string, number>): [string, number][] {
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
  )
}

/** The first object of (subject, predicate), as a string — a literal's value or an IRI. */
function first(store: Store, subject: Term, predicate: NamedNode): string | undefined {
  const object = store.getObjects(subject, predicate, null)[0]
  return object?.value
}

function reportLine(store: Store): string {
  const report = store.getSubjects(RDF_TYPE, rs('Report'), null)[0]
  if (!report) return ''
  const entity = store.getObjects(report, rs('entity'), null)[0]
  const name = entity ? first(store, entity, PREF_LABEL) : undefined
  const form = first(store, report, rs('form'))
  const fy = first(store, report, rs('fiscalYearFocus'))
  const fp = first(store, report, rs('fiscalPeriodFocus'))
  const accession = first(store, report, rs('accessionNumber'))
  return `Report: ${name ?? '?'} — form ${form ?? '?'}, fiscal year ${fy ?? '?'} ${fp ?? ''}, accession ${accession ?? '?'}\n`
}

function nodeShapes(store: Store): string {
  const byType = new Map<string, Map<string, number>>()
  for (const typed of store.getQuads(null, RDF_TYPE, null, null)) {
    const predicates = byType.get(typed.object.value) ?? new Map<string, number>()
    byType.set(typed.object.value, predicates)
    for (const quad of store.getQuads(typed.subject, null, null, null)) {
      if (quad.predicate.equals(RDF_TYPE)) continue
      predicates.set(quad.predicate.value, (predicates.get(quad.predicate.value) ?? 0) + 1)
    }
  }
  return [...byType.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([type, predicates]) => {
      const inner = mostCommon(predicates)
        .map(([predicate, n]) => `${compact(predicate)} ×${n}`)
        .join(', ')
      return `  ${compact(type)}: ${inner}`
    })
    .join('\n')
}

function conceptsPresent(store: Store): string {
  // rs:element hangs off facts only, so its objects counted are facts per concept.
  const counts = tally(store.getQuads(null, rs('element'), null, null).map((q) => q.object.value))
  const rows = mostCommon(counts).map(([iri, n]) => {
    const element = namedNode(iri)
    return {
      qname: first(store, element, rs('internalId')) ?? compact(iri),
      label: first(store, element, PREF_LABEL) ?? '',
      n,
    }
  })
  const shown = rows
    .slice(0, CONCEPTS_LISTED)
    .map((r) => `  - ${r.qname} → "${r.label}" (${r.n} facts)`)
  if (rows.length > CONCEPTS_LISTED) {
    shown.push(
      `  … and ${rows.length - CONCEPTS_LISTED} more concepts — find one by label with example query 1.`
    )
  }
  return shown.join('\n')
}

function periodsPresent(store: Store): string {
  const rows = store.getSubjects(RDF_TYPE, rs('Period'), null).map((period) => {
    const instant = first(store, period, xbrli('instant'))
    const start = first(store, period, xbrli('startDate'))
    const end = first(store, period, xbrli('endDate'))
    const dtype = first(store, period, rs('durationType'))
    return {
      end: instant ?? end ?? '',
      start: start ?? '',
      when: instant ? `${instant} (instant)` : `${start} → ${end} (${dtype ?? 'duration'})`,
      n: store.countQuads(null, rs('period'), period, null),
    }
  })
  return rows
    .sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start))
    .map((r) => `  - ${r.when}: ${r.n} facts`)
    .join('\n')
}

function unitsPresent(store: Store): string {
  const rows = store.getSubjects(RDF_TYPE, rs('Unit'), null).map((unit) => {
    const measure = first(store, unit, xbrli('measure'))
    return {
      measure: measure ? compact(measure) : '?',
      n: store.countQuads(null, rs('unit'), unit, null),
    }
  })
  return rows
    .sort((a, b) => b.n - a.n)
    .map((r) => `  - ${r.measure}: ${r.n} facts`)
    .join('\n')
}
