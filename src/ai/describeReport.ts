/**
 * The `describe_report` tool payload — the SPARQL analog of the backend's
 * `get-graph-schema`. It hands the model the report's RDF vocabulary (prefixes +
 * node shapes, curated from `report-components/constants.ts`) plus the concepts
 * and periods actually present (from the parsed report), so it can write valid
 * SPARQL instead of guessing IRIs.
 */
import type { NormalizedReport } from '@robosystems/report-components'

const PREFIX_BLOCK = `PREFIX rs: <https://robosystems.ai/vocab/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xbrli: <http://www.xbrl.org/2003/instance#>
PREFIX rs-gaap: <https://robosystems.ai/taxonomy/rs-gaap/v1/>
PREFIX us-gaap: <http://fasb.org/us-gaap/>
PREFIX dei: <http://xbrl.sec.gov/dei/>
PREFIX iso4217: <http://www.xbrl.org/2003/iso4217#>`

const SHAPES = `Node shapes (subject a <type> ; predicates):
  Fact:    ?f a rs:Fact ; rs:element <concept> ; rs:period <period> ; rs:unit <unit> ; rs:numericValue ?number .
  Element: <concept> a rs:Element ; skos:prefLabel "Human label" ; xbrli:balance "debit"|"credit" ; xbrli:periodType "instant"|"duration" .
  Period:  <period> a rs:Period ; xbrli:instant "YYYY-MM-DD"  (instant)  OR  xbrli:startDate "…" ; xbrli:endDate "…"  (duration) .
  Unit:    <unit> a rs:Unit ; xbrli:measure ?measure .

To read a concept's value: match a Fact by its rs:element (the concept IRI below) and read rs:numericValue; join the concept to skos:prefLabel for its name and rs:period for the date. Numbers are decimal literals — ORDER BY and comparisons work.`

function periodLabel(report: NormalizedReport, id: string): string {
  const p = report.periods[id]
  if (!p) return ''
  return p.type === 'instant'
    ? `${p.instant ?? p.end ?? ''} (instant)`
    : `${p.startDate ?? ''}→${p.endDate ?? p.end ?? ''} (duration)`
}

export function describeReport(report: NormalizedReport): string {
  const usedElements = new Set(report.facts.map((f) => f.element))
  const concepts = [...usedElements]
    .map((id) => report.elements[id])
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((e) => `  - "${e.label}" → ${e.qname}`)
    .sort()
    .join('\n')

  const periods = Object.keys(report.periods)
    .map((id) => `  - <${id}> : ${periodLabel(report, id)}`)
    .join('\n')

  const entity = report.entity?.name ? `Entity: ${report.entity.name}\n\n` : ''

  return `This is ONE financial report as RDF (an XBRL "holon"), queryable with read-only SPARQL 1.1.

${PREFIX_BLOCK}

${SHAPES}

${entity}Concepts present (skos:prefLabel → concept IRI to use as rs:element):
${concepts}

Periods present (IRI → date):
${periods}`
}
