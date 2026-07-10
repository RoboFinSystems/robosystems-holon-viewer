/**
 * Type facade for `@robosystems/client` — the two SDK functions the SEC flow uses.
 *
 * The published SDK ships `.ts` sources that TypeScript resolves ahead of their
 * companion `.d.ts` (Bundler resolution prefers `.ts`), and one of those sources
 * contains an internal generic-variance error that `skipLibCheck` cannot suppress
 * (it only skips `.d.ts`). Rather than let a third-party packaging bug fail our
 * typecheck, `tsconfig.json` maps `@robosystems/client` to this facade. At runtime
 * Vite ignores tsconfig `paths` and loads the real package from `node_modules`.
 *
 * Keep this in sync if the SEC client starts using more SDK surface.
 */

/** hey-api result envelope: `data` on success, `error` on a non-2xx. */
export interface SdkResult<T> {
  data?: T
  error?: unknown
  response?: Response
}

export interface CypherQueryBody {
  success?: boolean
  data?: Array<Record<string, unknown>>
  columns?: string[]
  row_count?: number
  error?: string | null
}

export function executeCypher(options: {
  baseUrl?: string
  headers?: Record<string, string>
  path: { graph_id: string }
  body: { query: string; parameters?: Record<string, unknown> | null }
  query?: { mode?: string; test_mode?: boolean }
}): Promise<SdkResult<CypherQueryBody>>

export interface GraphInfoLite {
  graphId: string
  graphName: string
  isRepository?: boolean
  repositoryType?: string | null
  status?: string | null
}

export function getGraphs(options?: {
  baseUrl?: string
  headers?: Record<string, string>
}): Promise<SdkResult<{ graphs?: GraphInfoLite[] }>>
