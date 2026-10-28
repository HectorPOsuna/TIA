import { useRef } from 'react'

const STATUS_LABEL = {
  active: 'activo',
  inactive: 'inactivo',
  error: 'en error',
}

export function NodeDock({ nodes, selectedId, onSelect }) {
  const refs = useRef([])

  const focusAt = (index) => {
    if (nodes.length === 0) return
    const next = (index + nodes.length) % nodes.length
    refs.current[next]?.focus()
  }

  const onKeyDown = (event, index) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusAt(index + 1)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      focusAt(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusAt(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusAt(nodes.length - 1)
    }
  }

  return (
    <nav className="dock" aria-label="Nodos del simulador">
      <div className="dock__head">
        <span>Nodos</span>
        <span className="dock__count">{nodes.length}</span>
      </div>
      <ul className="dock__list">
        {nodes.map((node, index) => {
          const status = STATUS_LABEL[node.status] ?? node.status
          const selected = node.id === selectedId
          return (
            <li key={node.id}>
              <button
                ref={(element) => {
                  refs.current[index] = element
                }}
                type="button"
                className={`dock__item ${selected ? 'is-selected' : ''}`}
                onClick={() => onSelect(node.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                tabIndex={selected || (!selectedId && index === 0) ? 0 : -1}
                aria-current={selected ? 'true' : undefined}
                title={`${node.name}: ${node.currentTemp.toFixed(1)} °C, ${status}`}
              >
                <span
                  className={`dock__status dock__status--${node.status}`}
                  aria-hidden="true"
                />
                <span className="dock__name">{node.name}</span>
                <span className="dock__temp">{node.currentTemp.toFixed(1)}°</span>
                <span className="sr-only">{status}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
