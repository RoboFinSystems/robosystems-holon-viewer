interface SpinnerProps {
  /** Optional status text shown beside the spinner. */
  label?: string
}

/** A small brand spinner; pass `label` for an inline status line. */
export function Spinner({ label }: SpinnerProps) {
  return (
    <span className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  )
}
