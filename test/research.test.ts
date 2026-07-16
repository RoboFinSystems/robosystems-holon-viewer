import { afterEach, describe, expect, it, vi } from 'vitest'

// The SEC report page links out to the public research portal only for tickers
// the catalog covers — so the gate must fetch once, match case-insensitively,
// and fail closed (hide the link) rather than surface a fetch error.
const CATALOG = {
  generated: '2026-07-15T18:17:48',
  count: 2,
  items: [{ ticker: 'JEF' }, { ticker: 'gtbif' }], // mixed case on purpose
}

const okResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response
const errResponse = (status: number) =>
  ({ ok: false, status, json: async () => ({}) }) as unknown as Response

// research.ts memoizes the catalog at module scope, so reset the module registry
// per test to get a fresh (unfetched) cache.
async function freshModule() {
  vi.resetModules()
  return import('../src/sec/research')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('research coverage gate', () => {
  it('reports coverage for a catalog ticker, case-insensitively', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse(CATALOG))
    )
    const { hasResearchCoverage } = await freshModule()
    expect(await hasResearchCoverage('JEF')).toBe(true)
    expect(await hasResearchCoverage('jef')).toBe(true)
    expect(await hasResearchCoverage('GTBIF')).toBe(true) // catalog stored it lowercase
  })

  it('reports no coverage for an unlisted ticker', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse(CATALOG))
    )
    const { hasResearchCoverage } = await freshModule()
    expect(await hasResearchCoverage('NVDA')).toBe(false)
  })

  it('treats a missing/blank ticker as uncovered without fetching', async () => {
    const fetchSpy = vi.fn(async () => okResponse(CATALOG))
    vi.stubGlobal('fetch', fetchSpy)
    const { hasResearchCoverage } = await freshModule()
    expect(await hasResearchCoverage(null)).toBe(false)
    expect(await hasResearchCoverage('   ')).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches the catalog once across many lookups', async () => {
    const fetchSpy = vi.fn(async () => okResponse(CATALOG))
    vi.stubGlobal('fetch', fetchSpy)
    const { hasResearchCoverage } = await freshModule()
    await hasResearchCoverage('JEF')
    await hasResearchCoverage('NVDA')
    await hasResearchCoverage('GTBIF')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('fails closed (no coverage) when the catalog fetch errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => errResponse(500))
    )
    const { hasResearchCoverage } = await freshModule()
    expect(await hasResearchCoverage('JEF')).toBe(false)
  })

  it('builds a lower-cased outbound URL', async () => {
    const { researchUrl } = await freshModule()
    expect(researchUrl('JEF')).toBe('https://robosystems.ai/research/jef')
  })
})
