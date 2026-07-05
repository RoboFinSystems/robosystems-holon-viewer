import { useEffect, useState } from 'react'
import { listReports, type SecEntity, type SecFiling } from '../../sec/client'

interface ReportPickerProps {
  entity: SecEntity
  onSelect: (filing: SecFiling) => void
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
}

/** Step 3 — the selected company's filings, most recent first. Pick one to render. */
export function ReportPicker({ entity, onSelect }: ReportPickerProps) {
  const [filings, setFilings] = useState<SecFiling[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFilings([])
    listReports(entity.cik)
      .then((rows) => {
        if (cancelled) return
        setFilings(rows)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entity.cik])

  return (
    <div className="sec-filings">
      <div className="sec-filings-head">
        Filings for <strong>{entity.name}</strong>
        {entity.ticker ? <span className="hint"> · {entity.ticker}</span> : null}
      </div>

      {loading ? (
        <div className="sec-loading">
          <span className="spinner" /> Loading filings…
        </div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : filings.length === 0 ? (
        <div className="hint">No filings found for this company.</div>
      ) : (
        <ul className="filing-list">
          {filings.map((f) => (
            <li key={f.reportId}>
              <button type="button" className="filing-item" onClick={() => onSelect(f)}>
                <span className="filing-form">{f.form}</span>
                <span className="filing-meta">
                  <span className="filing-date">Filed {formatDate(f.filingDate)}</span>
                  {f.fiscalYear ? (
                    <span className="filing-fy">
                      FY{f.fiscalYear}
                      {f.fiscalPeriod && f.fiscalPeriod !== 'FY' ? ` ${f.fiscalPeriod}` : ''}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
