/**
 * File-mode chat backend — SPARQL over the report's in-memory RDF store.
 * `describe_report` returns the schema (concepts, node shapes); `run_sparql`
 * runs Comunica locally. No network.
 */
import type { NormalizedReport } from '@robosystems/report-components'
import type { Store } from 'n3'
import { describeReport } from '../describeReport'
import type { ChatBackend } from '../loop'
import type { ToolDef } from '../provider'
import { runSparql } from '../runSparql'

const TOOLS: ToolDef[] = [
  {
    name: 'describe_report',
    description:
      "Return the report's RDF vocabulary (SPARQL prefixes, node shapes) plus the concepts and periods present. Call this first — never guess the schema.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'run_sparql',
    description:
      'Run a read-only SPARQL 1.1 SELECT or ASK query over this report and return the rows. Use the prefixes from describe_report.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'A SPARQL SELECT or ASK query.' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
]

const SYSTEM = `You answer questions about ONE financial report (an XBRL "holon" stored as RDF) by querying it with read-only SPARQL 1.1.

WORKFLOW:
1. Call describe_report FIRST to get the prefixes, node shapes, and the concepts present. Never guess the schema.
2. Write a SPARQL SELECT and run it with run_sparql.
3. If a query errors or returns nothing useful, read the message, fix the query, and try again. You have a limited number of steps — do not repeat a failing query unchanged.
4. When you have the answer, reply in natural language and cite the concept and period. Use Markdown — bold the key figures, and a table for multi-row results.

RULES:
- Read-only SELECT/ASK only. Always include the PREFIX lines from describe_report.
- A reported value: ?f a rs:Fact ; rs:element <concept> ; rs:numericValue ?v . Join skos:prefLabel for names and rs:period for dates.
- Never fabricate a figure — if the report does not contain it, say so plainly.`

export function sparqlBackend(report: NormalizedReport, store: Store): ChatBackend {
  return {
    system: SYSTEM,
    tools: TOOLS,
    queryLabel: 'SPARQL',
    runTool: async (name, input) => {
      if (name === 'describe_report') return { content: describeReport(report) }
      if (name === 'run_sparql') {
        const query = String(input.query ?? '')
        const rows = await runSparql(store, query)
        return { content: JSON.stringify(rows), query }
      }
      return { content: `Unknown tool: ${name}`, isError: true }
    },
  }
}
