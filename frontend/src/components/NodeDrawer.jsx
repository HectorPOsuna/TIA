import { useEffect, useRef } from 'react'
import { Icon } from './Icon.jsx'
import { NodeDetailPanel } from './NodeDetailPanel.jsx'

export function NodeDrawer({ node, series, api, inference, aiNode, readOnly, onClose }) {
  const closeRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    previousFocus.current = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus()
      }
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (document.querySelector('dialog[open]')) return
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <aside className="node-drawer" aria-labelledby="node-drawer-title">
      <button
        ref={closeRef}
        type="button"
        className="icon-btn node-drawer__close"
        onClick={onClose}
        aria-label="Cerrar detalle del nodo"
        title="Cerrar detalle"
      >
        <Icon name="close" />
      </button>

      {readOnly && (
        <div className="readonly-banner">
          <Icon name="alert" size={15} />
          Vista histórica: solo lectura
        </div>
      )}

      <div className="node-drawer__body">
        <NodeDetailPanel
          node={node}
          series={series}
          api={api}
          inference={inference}
          aiNode={aiNode}
          readOnly={readOnly}
        />
      </div>
    </aside>
  )
}
