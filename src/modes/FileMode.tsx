import type { NormalizedReport } from '@robosystems/report-components'
import { ReportView } from '@robosystems/report-components'
import { parseTrig } from '@robosystems/report-components/adapters'
import type { DragEvent } from 'react'
import { useCallback, useState } from 'react'

const SAMPLE_URL = '/samples/seattle-method-case-1.holon.trig'

/**
 * Mode A — offline, zero-auth. Drop (or pick) a `holon.trig`; the library's
 * trig adapter parses it client-side and the shared components render it. No
 * network, no key, no backend.
 */
export function FileMode() {
  const [report, setReport] = useState<NormalizedReport | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const loadText = useCallback((text: string, name: string) => {
    try {
      const parsed = parseTrig(text)
      if (!parsed.informationBlocks.length) {
        setReport(null)
        setError('No Information Blocks found — is this a holon report?')
        return
      }
      setReport(parsed)
      setFileName(name)
      setError(null)
    } catch (e) {
      setReport(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

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
      .then((text) => loadText(text, 'seattle-method-case-1.holon.trig'))
      .catch((e) => setError(`Could not load sample: ${e}`))
  }, [loadText])

  if (report) {
    return (
      <div>
        <div className="loaded-bar">
          <span>
            Loaded <strong>{fileName}</strong>
            {report.reportId ? <span className="hint"> · {report.reportId}</span> : null}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setReport(null)
              setFileName(null)
            }}
          >
            Load another
          </button>
        </div>
        <ReportView report={report} />
      </div>
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
        <h2>Open a holon.trig</h2>
        <p>
          Drag &amp; drop a report holon here, or choose a file. Everything runs in your browser.
        </p>
        <div
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <label className="file-input-label btn">
            Choose file
            <input
              type="file"
              accept=".trig,.ttl,text/turtle"
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
