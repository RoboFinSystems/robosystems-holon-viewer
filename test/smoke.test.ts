import { buildPivots } from '@robosystems/report-components'
import { parseJsonld } from '@robosystems/report-components/adapters'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Exercises the cross-repo wiring: the report-components package must resolve, and
// the bundled .holon.jsonld sample (NVIDIA FY2026 10-K) must parse and pivot.
const here = dirname(fileURLToPath(import.meta.url))
const samples = join(here, '..', 'public', 'samples')

describe('viewer ↔ library wiring (Mode A)', () => {
  it('parses the bundled .holon.jsonld sample into pivotable blocks', async () => {
    const doc = readFileSync(join(samples, '0001045810-26-000021.holon.jsonld'), 'utf8')
    const report = await parseJsonld(doc)
    expect(report.entity?.name).toContain('NVIDIA')
    expect(report.informationBlocks.length).toBeGreaterThan(0)

    const statements = buildPivots(report)
    expect(statements.length).toBe(report.informationBlocks.length)
  })
})
