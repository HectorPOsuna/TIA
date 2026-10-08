export function CollapsiblePanel({ title, meta, open, onToggle, children }) {
  return (
    <section className={`panel ${open ? 'panel--open' : ''}`}>
      <button type="button" className="panel__head" onClick={onToggle} aria-expanded={open}>
        <span className="panel__title">{title}</span>
        {meta != null && <span className="panel__meta">{meta}</span>}
        <span className="panel__chev">▶</span>
      </button>
      {open && <div className="panel__body">{children}</div>}
    </section>
  )
}