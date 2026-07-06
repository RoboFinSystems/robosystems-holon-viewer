/**
 * SEC-mode chat backend — read-only Cypher over the live SEC graph via the
 * RoboSystems MCP HTTP surface (`/mcp/call-tool`). The curated read set mirrors
 * the backend CypherOperator's READ_ONLY_TOOLS. The remote API is the tool
 * runner; this just forwards tool calls with the user's key.
 */
import type { ChatBackend } from '../loop'
import { callMcpTool } from '../mcp'
import type { ToolDef } from '../provider'

const TOOLS: ToolDef[] = [
  {
    name: 'get-graph-schema',
    description:
      'Return the graph node labels, relationship types, and properties. Call this first — never guess the schema.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get-example-queries',
    description:
      'Return working Cypher query patterns tuned to this graph. Use them as a starting point before writing your own.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read-graph-cypher',
    description: 'Run a read-only Cypher query against the graph and return the rows.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A read-only Cypher query (MATCH … RETURN), always with a LIMIT.',
        },
        parameters: { type: 'object', description: 'Optional query parameters.' },
      },
      required: ['query'],
    },
  },
]

const SYSTEM = `You answer questions about the SEC EDGAR financial knowledge graph — a large, shared repository of public-company XBRL filings — by querying it with read-only Cypher.

WORKFLOW:
1. Call get-graph-schema FIRST to discover node labels, relationships, and properties. Never guess the schema.
2. Call get-example-queries for working query patterns tuned to this graph.
3. Write a read-only Cypher query and run it with read-graph-cypher.
4. If a query errors or returns nothing useful, read the message, fix it, and try again. You have a limited number of steps — do not repeat a failing query unchanged.
5. Answer in natural language, citing the figures and periods. Use Markdown — bold the key numbers, and a table for multi-row results.

RULES:
- Read-only only: MATCH, WHERE, WITH, RETURN, ORDER BY, LIMIT. Never CREATE, SET, DELETE, MERGE, or DROP.
- Always include a LIMIT (max 100).
- Anchor every query on a selective, indexed starting point and expand from there — this is a shared repository with thousands of filers. Good anchors: an Entity by ticker or CIK, a Report by identifier, an Element by qname. Never lead a MATCH with an unfiltered global pattern like (f:Fact) or (n) — it scans the whole graph and times out.
- Never fabricate a figure — if the data does not contain it, say so plainly.`

export function cypherBackend(apiKey: string, graphId: string): ChatBackend {
  return {
    system: SYSTEM,
    tools: TOOLS,
    queryLabel: 'Cypher',
    runTool: async (name, input) => {
      const content = await callMcpTool(apiKey, graphId, name, input)
      return {
        content,
        query: name === 'read-graph-cypher' ? String(input.query ?? '') : undefined,
      }
    },
  }
}
