/**
 * Research-coverage lookup for the public equity-research portal.
 *
 * The SEC report page links out to robosystems.ai/research/<ticker> — but only
 * a subset of tickers are covered, and an uncovered ticker 404s there. Rather
 * than duplicate the research portal in this viewer, we do the cheapest check
 * that keeps the link honest: fetch the same public catalog the portal is built
 * from (one small JSON on the CDN, no auth) and expose whether a ticker is
 * covered plus its outbound URL. The fetch is memoized for the tab's lifetime.
 */

const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env

const CATALOG_URL =
  viteEnv?.VITE_RESEARCH_CATALOG_URL ?? 'https://assets.robosystems.ai/content/index.json'

/** Base for the outbound per-ticker links (trailing slash trimmed). */
const RESEARCH_BASE_URL = (
  viteEnv?.VITE_RESEARCH_BASE_URL ?? 'https://robosystems.ai/research'
).replace(/\/+$/, '')

interface CatalogItem {
  ticker?: string | null
}
interface Catalog {
  items?: CatalogItem[]
}

// One fetch per tab, shared by every ReportScreen. Resolves to the set of
// covered tickers (upper-cased). Any failure resolves to an empty set so the
// caller simply hides the link — a missing catalog is never an error the user
// should have to see.
let coveragePromise: Promise<Set<string>> | null = null

function loadCoverage(): Promise<Set<string>> {
  if (coveragePromise) return coveragePromise
  coveragePromise = fetch(CATALOG_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Research catalog fetch failed: ${res.status}`)
      return res.json() as Promise<Catalog>
    })
    .then((cat) => {
      const covered = new Set<string>()
      for (const item of cat.items ?? []) {
        const t = item.ticker?.trim().toUpperCase()
        if (t) covered.add(t)
      }
      return covered
    })
    .catch(() => new Set<string>())
  return coveragePromise
}

/** The public research URL for a ticker (lower-cased path segment). */
export function researchUrl(ticker: string): string {
  return `${RESEARCH_BASE_URL}/${ticker.trim().toLowerCase()}`
}

/** Whether the public research portal has coverage for `ticker`. */
export async function hasResearchCoverage(ticker: string | null | undefined): Promise<boolean> {
  const t = ticker?.trim().toUpperCase()
  if (!t) return false
  const covered = await loadCoverage()
  return covered.has(t)
}
