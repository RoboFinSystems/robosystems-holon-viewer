import { buildStatements } from '@robosystems/report-components'
import { parseJsonld, parseTrig } from '@robosystems/report-components/adapters'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Exercises the cross-repo wiring: the alias to ../robosystems-report-components/src
// must resolve, and the sample holon must reconstruct into the four statements.
const here = dirname(fileURLToPath(import.meta.url))
const samples = join(here, '..', 'public', 'samples')
const FOUR_STATEMENTS = [
  'balance_sheet',
  'income_statement',
  'cash_flow_statement',
  'equity_statement',
]

describe('viewer ↔ library wiring (Mode A)', () => {
  it('parses the .holon.jsonld sample (the default) into the four statements', async () => {
    const doc = readFileSync(join(samples, 'seattle-method-case-1.holon.jsonld'), 'utf8')
    const report = await parseJsonld(doc)
    expect(report.entity?.name).toContain('Lemonade Stand')

    const statements = buildStatements(report)
    expect(statements.map((s) => s.blockType)).toEqual(FOUR_STATEMENTS)
  })

  it('still parses the .holon.trig sample (the RDF export)', () => {
    const trig = readFileSync(join(samples, 'seattle-method-case-1.holon.trig'), 'utf8')
    const report = parseTrig(trig)
    expect(report.entity?.name).toContain('Lemonade Stand')

    const statements = buildStatements(report)
    expect(statements.map((s) => s.blockType)).toEqual(FOUR_STATEMENTS)
  })
})
