import type { NormalizedReport } from '@robosystems/report-components'
import { reportSections, sliceReportSection } from '@robosystems/report-components'
import { parseJsonld } from '@robosystems/report-components/adapters'
import type { DragEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SectionedReport } from '../report/SectionedReport'

const SAMPLE_URL = '/samples/seattle-method-case-1.holon.jsonld'

interface FileModeProps {
  /** The loaded report, owned by `App` (so the header can show it). */
  report: NormalizedReport | null
  /** File name of the loaded report — keys the section view so it resets per file. */
  fileName: string | null
  /** Called when a holon parses successfully. */
  onLoaded: (report: NormalizedReport, fileName: string) => void
  /** Clear the loaded report and return to the dropzone. */
  onReset: () => void
}

/**
 * Mode A — offline, zero-auth. Drop (or pick) a report's `holon.jsonld`; the
 * library parses it client-side and the shared components render it. No
 * network, no key, no backend. The loaded-file chip + "Load another" live in
 * the app header (`App` owns that state); this renders the dropzone, then the
 * report once one is loaded.
 */
export function FileMode({ report, fileName, onLoaded, onReset }: FileModeProps) {
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  // A holon is fully in memory, so a section loads instantly — slice it out of
  // the parsed report. Same shared surface the SEC mode uses.
  const sections = useMemo(() => (report ? reportSections(report) : []), [report])
  const loadSection = useCallback(
    (id: string): Promise<NormalizedReport> =>
      report
        ? Promise.resolve(sliceReportSection(report, id))
        : Promise.reject(new Error('No report loaded')),
    [report]
  )

  // Clear any error whenever the loaded report changes — in particular when
  // "Load another" (App's onReset) sets report back to null — so a stale
  // message from a superseded/failed load can't surface on the empty dropzone.
  // A failed load leaves report unchanged (null → null), so its error persists.
  useEffect(() => {
    setError(null)
  }, [report])

  const loadText = useCallback(
    async (text: string, name: string) => {
      try {
        const parsed = await parseJsonld(text)
        if (!parsed.informationBlocks.length) {
          setError('No Information Blocks found — is this a holon report?')
          return
        }
        onLoaded(parsed, name)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [onLoaded]
  )

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      file
        .text()
        .then((text) => loadText(text, file.name))
        .catch((e) => setError(String(e)))
    },
    [loadText]
  )

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      onFiles(e.dataTransfer.files)
    },
    [onFiles]
  )

  const loadSample = useCallback(() => {
    fetch(SAMPLE_URL)
      .then((r) => r.text())
      .then((text) => loadText(text, 'seattle-method-case-1.holon.jsonld'))
      .catch((e) => setError(`Could not load sample: ${e}`))
  }, [loadText])

  if (report) {
    const header = (
      <div className="report-breadcrumb">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>
          ← Load another
        </button>
        <span className="report-breadcrumb-title">
          <strong>{report.entity?.name ?? fileName ?? 'Report'}</strong>
          {fileName ? <span className="hint"> · {fileName}</span> : null}
        </span>
      </div>
    )
    return (
      <SectionedReport
        key={fileName ?? 'file'}
        sections={sections}
        loadSection={loadSection}
        header={header}
      />
    )
  }

  return (
    <div>
      <div
        className={dragging ? 'dropzone dragging' : 'dropzone'}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <h2>Open a holon.jsonld</h2>
        <p>
          Drag &amp; drop a report&apos;s <code>holon.jsonld</code> here, or choose a file.
          Everything runs in your browser.
        </p>
        <div
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <label className="file-input-label btn">
            Choose file
            <input
              type="file"
              accept=".jsonld,.json,application/ld+json"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
          <button type="button" className="btn btn-secondary" onClick={loadSample}>
            Load sample (Lemonade Stand)
          </button>
        </div>
        <p className="hint">
          Reads the report&apos;s scene · boundary · projection graphs — never an underlying ledger.
        </p>
      </div>
      {error ? <div className="error">{error}</div> : null}
    </div>
  )
}
