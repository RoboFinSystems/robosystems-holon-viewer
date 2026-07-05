import type { NormalizedReport } from '@robosystems/report-components'
import { ReportView } from '@robosystems/report-components'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { TocSidebar, type SectionRef } from './TocSidebar'

interface SectionedReportProps {
  /** The navigable sections, in display order (first is selected initially). */
  sections: SectionRef[]
  /** Resolve one section's renderable report (SEC: a live fetch; File: an in-memory slice). */
  loadSection: (id: string) => Promise<NormalizedReport>
  /** Optional bar above the layout (e.g. a breadcrumb). */
  header?: ReactNode
}

/**
 * The shared report surface for both modes: a left table-of-contents and one
 * section rendered at a time. Selecting a section resolves its report via
 * `loadSection` (cached, so revisiting is instant) and renders it with the
 * library `ReportView` (fact inspector intact).
 *
 * Mount this with a `key` per report (`reportId` / file name) so each report
 * gets fresh state — the initial selection then falls out of `sections[0]`.
 */
export function SectionedReport({ sections, loadSection, header }: SectionedReportProps) {
  const [selectedId, setSelectedId] = useState<string | null>(sections[0]?.id ?? null)
  const [report, setReport] = useState<NormalizedReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set())
  const cache = useRef(new Map<string, NormalizedReport>())

  useEffect(() => {
    if (!selectedId) return
    const cached = cache.current.get(selectedId)
    if (cached) {
      setReport(cached)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    loadSection(selectedId)
      .then((r) => {
        if (cancelled) return
        cache.current.set(selectedId, r)
        setReport(r)
        setLoadedIds((prev) => new Set(prev).add(selectedId))
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
  }, [selectedId, loadSection])

  return (
    <div className="sectioned-report">
      {header}
      {sections.length === 0 ? (
        <div className="hint">This report has no renderable sections.</div>
      ) : (
        <div className="report-layout">
          <aside className="report-toc">
            <TocSidebar
              sections={sections}
              selectedId={selectedId}
              loadingId={loading ? selectedId : null}
              loadedIds={loadedIds}
              onSelect={setSelectedId}
            />
          </aside>
          <main className="report-main">
            {loading ? (
              <div className="sec-loading">
                <span className="spinner" /> Loading section…
              </div>
            ) : error ? (
              <div className="error">{error}</div>
            ) : report ? (
              <ReportView report={report} />
            ) : null}
          </main>
        </div>
      )}
    </div>
  )
}
