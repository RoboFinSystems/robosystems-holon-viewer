export interface SectionRef {
  id: string
  title: string
}

interface TocSidebarProps {
  sections: SectionRef[]
  selectedId: string | null
  loadingId: string | null
  loadedIds: Set<string>
  onSelect: (id: string) => void
}

/**
 * The report's sections in their given order — for SEC, the filer's layout
 * (`Structure.number`), which leads with the Cover Page; for a holon file, the
 * canonical statement order. A flat list matching how the report reads; no
 * re-grouping.
 */
export function TocSidebar({
  sections,
  selectedId,
  loadingId,
  loadedIds,
  onSelect,
}: TocSidebarProps) {
  return (
    <nav className="toc" aria-label="Report sections">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          className={s.id === selectedId ? 'toc-item active' : 'toc-item'}
          onClick={() => onSelect(s.id)}
          aria-current={s.id === selectedId}
        >
          <span className="toc-item-title">{s.title}</span>
          {loadingId === s.id ? (
            <span className="spinner spinner-sm" />
          ) : loadedIds.has(s.id) ? (
            <span className="toc-dot" title="Loaded" />
          ) : null}
        </button>
      ))}
    </nav>
  )
}
