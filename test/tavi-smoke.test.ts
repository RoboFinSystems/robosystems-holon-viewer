import { buildPivots } from '@robosystems/report-components'
import { parseReportDocument } from '@robosystems/report-components/adapters'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The second door: a filing's tavi.json (3M FY2024, the two primary statements,
// trimmed from a real xbrlkit output) goes through the same sniffing entry
// File mode uses, and pivots like a holon does.
const here = dirname(fileURLToPath(import.meta.url))

describe('viewer ↔ library wiring (Mode A, Tavi)', () => {
  it('parses a tavi.json through parseReportDocument and pivots it', async () => {
    const doc = readFileSync(join(here, 'fixtures', 'mmm-fy2024-statements.tavi.json'), 'utf8')
    const { format, report } = await parseReportDocument(doc)
    expect(format).toBe('tavi')
    expect(report.entity?.name).toContain('3M')
    const statements = buildPivots(report).filter((p) => p.kind === 'Statement')
    expect(statements.map((s) => s.title)).toEqual([
      'Consolidated Statement of Income (Loss)',
      'Consolidated Balance Sheet',
    ])
  })
})
