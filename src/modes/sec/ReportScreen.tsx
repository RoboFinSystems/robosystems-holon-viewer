import type { NormalizedReport, SecReportShell } from '@robosystems/report-components'
import { fetchSecReportShell, fetchSecSection } from '@robosystems/report-components'
import { useCallback, useEffect, useState } from 'react'
import { ResearchIcon } from '../../components/icons'
import { SectionedReport } from '../../report/SectionedReport'
import { secQuery, type SecEntity, type SecFiling } from '../../sec/client'
import { hasResearchCoverage, researchUrl } from '../../sec/research'

interface ReportScreenProps {
  entity: SecEntity
  filing: SecFiling
  /** Back to company / filing selection. */
  onBack: () => void
}

/**
 * SEC report screen: load the section list for the chosen filing (fast), then
 * hand it to the shared `SectionedReport`, which fetches each section on demand.
 */
export function ReportScreen({ entity, filing, onBack }: ReportScreenProps) {
  const [shell, setShell] = useState<SecReportShell | null>(null)
  const [loadingShell, setLoadingShell] = useState(true)
  const [shellError, setShellError] = useState<string | null>(null)
  // Outbound link to the public research portal, set only when this ticker has
  // coverage (so we never point at a page that 404s).
  const [researchLink, setResearchLink] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setShell(null)
    setLoadingShell(true)
    setShellError(null)
    fetchSecReportShell(secQuery, filing.reportId)
      .then((s) => {
        if (cancelled) return
        setShell(s)
        setLoadingShell(false)
      })
      .catch((e) => {
        if (cancelled) return
        setShellError(e instanceof Error ? e.message : String(e))
        setLoadingShell(false)
      })
    return () => {
      cancelled = true
    }
  }, [filing.reportId])

  // Check the public research catalog for this ticker; show the link only when
  // covered. Failures resolve to "no coverage", so the link just stays hidden.
  useEffect(() => {
    let cancelled = false
    setResearchLink(null)
    const ticker = entity.ticker
    if (!ticker) return
    void hasResearchCoverage(ticker).then((covered) => {
      if (!cancelled && covered) setResearchLink(researchUrl(ticker))
    })
    return () => {
      cancelled = true
    }
  }, [entity.ticker])

  const loadSection = useCallback(
    (id: string): Promise<NormalizedReport> => {
      if (!shell) return Promise.reject(new Error('Report not loaded'))
      const section = shell.sections.find((s) => s.id === id)
      if (!section) return Promise.reject(new Error(`Unknown section ${id}`))
      return fetchSecSection(secQuery, shell, section)
    },
    [shell]
  )

  const header = (
    <div className="report-breadcrumb">
      <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
        ← Change filing
      </button>
      <span className="report-breadcrumb-title">
        <strong>{entity.name}</strong>
        {entity.ticker ? <span className="hint"> · {entity.ticker}</span> : null}
        <span className="hint"> · {filing.form}</span>
        {filing.reportDate ? <span className="hint"> · {filing.reportDate}</span> : null}
      </span>
      {researchLink ? (
        <a
          className="research-link"
          href={researchLink}
          target="_blank"
          rel="noreferrer noopener"
          title={`View equity research for ${entity.ticker}`}
        >
          <ResearchIcon className="research-link-icon" />
          Research
          <span aria-hidden="true"> ↗</span>
        </a>
      ) : null}
    </div>
  )

  if (loadingShell) {
    return (
      <div className="sectioned-report">
        {header}
        <div className="sec-loading">
          <span className="spinner" /> Loading report sections…
        </div>
      </div>
    )
  }
  if (shellError) {
    return (
      <div className="sectioned-report">
        {header}
        <div className="error">{shellError}</div>
      </div>
    )
  }

  return (
    <SectionedReport
      key={filing.reportId}
      sections={shell?.sections ?? []}
      loadSection={loadSection}
      header={header}
    />
  )
}
