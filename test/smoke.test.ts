import { buildStatements } from '@robosystems/report-components'
import { parseTrig } from '@robosystems/report-components/adapters'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Exercises the cross-repo wiring: the alias to ../robosystems-report-components/src
// must resolve, and the sample holon must reconstruct into the four statements.
const here = dirname(fileURLToPath(import.meta.url))
const trig = readFileSync(
  join(here, '..', 'public', 'samples', 'seattle-method-case-1.holon.trig'),
  'utf8'
)

describe('viewer ↔ library wiring (Mode A)', () => {
  it('parses the sample holon and reconstructs the four statements', () => {
    const report = parseTrig(trig)
    expect(report.entity?.name).toContain('Lemonade Stand')

    const statements = buildStatements(report)
    expect(statements.length).toBe(4)
    expect(statements.map((s) => s.blockType)).toEqual([
      'balance_sheet',
      'income_statement',
      'cash_flow_statement',
      'equity_statement',
    ])
  })
})
