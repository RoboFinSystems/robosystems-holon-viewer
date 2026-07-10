/**
 * SEC data access over the RoboSystems API, via the `@robosystems/client` SDK.
 *
 * The app passes the user's API key (which stays client-side — this app is
 * static-hosted and never sees the key at its own origin) per call, and exposes
 * the handful of reads the SEC flow needs: graph discovery, entity search, filing
 * listing, and the `SecQuery` closure that the `@robosystems/report-components`
 * SEC adapter runs its reconstruction through.
 *
 * We import the SDK functions from the `/sdk` subpath rather than the package
 * root. The root `index.js` is ESM that re-exports the generated CommonJS SDK via
 * `export * from './sdk.gen.js'`; Vite's dep pre-bundler turns that into a dynamic
 * re-export and drops the static named exports, so `executeCypher` is missing
 * at runtime. Importing the CJS module directly (`/sdk`) makes esbuild emit static
 * named exports, which Vite resolves correctly.
 *
 * All reads go through `POST /v1/graphs/sec/query`; the query bodies live here so
 * the SEC graph knowledge (which is navigation, not rendering) stays out of the
 * rendering library.
 */
import { executeCypher, getGraphs } from '@robosystems/client/sdk'
import type { SecQuery } from '@robosystems/report-components'

// In dev, use a relative base URL so requests go through the Vite proxy (which
// forwards to the API server-side, dodging the API's localhost-less CORS
// allowlist — see vite.config.ts). In a production build, call the API directly
// (its CORS allowlist must include the deployed origin).
const viteEnv = (import.meta as { env?: { DEV?: boolean; VITE_ROBOSYSTEMS_API_URL?: string } }).env
const DEFAULT_API_URL = viteEnv?.DEV
  ? ''
  : (viteEnv?.VITE_ROBOSYSTEMS_API_URL ?? 'https://api.robosystems.ai')

export interface SecEntity {
  ticker: string | null
  name: string
  cik: string
}

export interface SecFiling {
  reportId: string
  form: string
  reportDate: string | null
  filingDate: string | null
  accession: string | null
  fiscalYear: number | null
  fiscalPeriod: string | null
}

let currentApiKey = ''
let currentBaseUrl = DEFAULT_API_URL

/** Per-call SDK options: target base URL + the user's API key header. */
function opts() {
  return { baseUrl: currentBaseUrl, headers: { 'X-API-Key': currentApiKey } }
}

function describeError(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    if (typeof e.detail === 'string') return e.detail
    if (typeof e.message === 'string') return e.message
    if (typeof e.error === 'string') return e.error
  }
  return 'Request failed'
}

/** Point the SDK at the API with the user's key (kept client-side only). */
export function configureSec(apiKey: string, baseUrl: string = DEFAULT_API_URL): void {
  currentApiKey = apiKey
  currentBaseUrl = baseUrl
}

export function isConfigured(): boolean {
  return currentApiKey.length > 0
}

/** The raw SEC Cypher primitive — also the `SecQuery` the adapter runs through. */
export const secQuery: SecQuery = async (cypher, params) => {
  const res = await executeCypher({
    ...opts(),
    path: { graph_id: 'sec' },
    body: { query: cypher, parameters: (params as Record<string, unknown> | undefined) ?? null },
    query: { mode: 'sync' },
  })
  if (res.error) throw new Error(describeError(res.error))
  const body = res.data as { data?: unknown[]; error?: string | null } | undefined
  if (body?.error) throw new Error(body.error)
  return (body?.data as Array<Record<string, unknown>>) ?? []
}

/**
 * Confirm the key can reach the SEC repository. Returns the graph name on
 * success, or null when the key is valid but has no SEC access.
 */
export async function findSecRepository(): Promise<{ graphId: string; graphName: string } | null> {
  const res = await getGraphs({ ...opts() })
  if (res.error) throw new Error(describeError(res.error))
  const graphs = (res.data?.graphs ?? []) as Array<{
    graphId: string
    graphName: string
    isRepository?: boolean
    repositoryType?: string | null
    status?: string | null
  }>
  const sec = graphs.find(
    (g) => g.graphId === 'sec' || (g.isRepository === true && g.repositoryType === 'sec')
  )
  return sec ? { graphId: sec.graphId, graphName: sec.graphName } : null
}

/**
 * Point the SDK at `apiKey` and confirm it can reach the SEC repository —
 * `configureSec` + `findSecRepository` in one call, shared by the Keys drawer
 * (live "Connected" status) and `SecMode` (auto-validate on load). Returns the
 * graph on success, null when the key is valid but has no SEC access, and throws
 * on an authentication/transport error.
 */
export async function validateSecKey(
  apiKey: string
): Promise<{ graphId: string; graphName: string } | null> {
  configureSec(apiKey)
  return findSecRepository()
}

// Ticker prefix (upper-cased) OR company-name substring (lower-cased). Capped
// and ordered so the dropdown stays small and stable.
const SEARCH_Q = `
MATCH (e:Entity)
WHERE e.ticker STARTS WITH $ticker OR toLower(e.name) CONTAINS $name
RETURN e.ticker AS ticker, e.name AS name, e.cik AS cik
ORDER BY e.ticker
LIMIT 20`

export async function searchEntities(term: string): Promise<SecEntity[]> {
  const q = term.trim()
  if (!q) return []
  const rows = await secQuery(SEARCH_Q, { ticker: q.toUpperCase(), name: q.toLowerCase() })
  return rows
    .map((r) => ({
      ticker: (r.ticker as string | null) ?? null,
      name: (r.name as string) ?? '',
      cik: (r.cik as string) ?? '',
    }))
    .filter((e) => e.cik)
}

// Anchored on the entity (cik); the report fan-out is small, so this is fast.
const REPORTS_Q = `
MATCH (e:Entity {cik: $cik})-[:ENTITY_HAS_REPORT]->(r:Report)
RETURN r.identifier AS report_id, r.form AS form, r.report_date AS report_date,
       r.filing_date AS filing_date, r.accession_number AS accession,
       r.fiscal_year_focus AS fy, r.fiscal_period_focus AS fp
ORDER BY r.filing_date DESC
LIMIT 100`

export async function listReports(cik: string): Promise<SecFiling[]> {
  const rows = await secQuery(REPORTS_Q, { cik })
  return rows
    .map((r) => ({
      reportId: (r.report_id as string) ?? '',
      form: (r.form as string) ?? '',
      reportDate: (r.report_date as string | null) ?? null,
      filingDate: (r.filing_date as string | null) ?? null,
      accession: (r.accession as string | null) ?? null,
      fiscalYear: (r.fy as number | null) ?? null,
      fiscalPeriod: (r.fp as string | null) ?? null,
    }))
    .filter((f) => f.reportId)
}
