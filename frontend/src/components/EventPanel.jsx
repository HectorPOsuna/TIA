import { useEffect, useRef } from 'react'
import { Icon } from './Icon.jsx'

const CATEGORY_LABEL = {
  traffic: 'tráfico',
  perturbation: 'perturbación',
}

const time = (ts) => new Date(ts).toLocaleTimeString('es')

function NumberField({ label, value, min, max, step, onCommit }) {
  const commit = (input) => {
    const parsed = Number(input.value)
    if (input.value.trim() === '' || !Number.isFinite(parsed)) {
      input.value = String(value)
      return
    }
    const clamped = Math.min(max, Math.max(min, parsed))
    input.value = String(clamped)
    if (clamped !== value) onCommit(clamped)
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        key={value}
        type="number"
        defaultValue={value}
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        onBlur={(event) => commit(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          commit(event.currentTarget)
          event.currentTarget.blur()
        }}
      />
    </label>
  )
}

export function EventPanel({
  id,
  state,
  error,
  busy,
  readOnly,
  onClose,
  onGenerator,
  onEvent,
  onTrigger,
}) {
  const closeRef = useRef(null)
  const previousFocus = useRef(null)
  const generator = state.generator
  const enabled = generator.enabled

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
    <div
      id={id}
      className="event-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="event-panel-title"
    >
      <header className="event-panel__head">
        <div>
          <h2 id="event-panel-title">Eventos</h2>
          <div className="event-panel__status">
            <span className={`badge ${enabled ? 'badge--warn' : 'badge--muted'}`}>
              {enabled ? 'auto' : 'off'}
            </span>
            <span className="hint">
              {enabled
                ? `Generador activo cada ${generator.intervalMs / 1000} s`
                : 'Generador detenido'}
            </span>
          </div>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={onClose}
          aria-label="Cerrar panel de eventos"
          title="Cerrar"
        >
          <Icon name="close" size={15} />
        </button>
      </header>

      {readOnly && (
        <div className="readonly-banner">
          <Icon name="alert" size={15} />
          Vista histórica: solo lectura
        </div>
      )}

      {error && <p className="event-panel__error">{error}</p>}

      <fieldset className="event-panel__body" disabled={readOnly || busy}>
        <div className="event-panel__controls">
          <button
            type="button"
            className={`btn btn--sm ${enabled ? 'btn--danger' : 'btn--primary'}`}
            onClick={() => onGenerator({ enabled: !enabled })}
          >
            {enabled ? 'Detener' : 'Activar'}
          </button>
          <NumberField
            label="Intervalo (s)"
            value={generator.intervalMs / 1000}
            min={0.25}
            max={3600}
            step={0.25}
            onCommit={(seconds) => onGenerator({ intervalMs: Math.round(seconds * 1000) })}
          />
        </div>

        <h3 className="event-panel__section-title">Catálogo</h3>
        {state.events.length === 0 ? (
          <div className="hint">Cargando catálogo…</div>
        ) : (
          <ul className="list event-list">
            {state.events.map((event) => (
              <li key={event.id} className="event-row">
                <div className="event-row__head">
                  <label className="event-row__toggle">
                    <input
                      type="checkbox"
                      checked={event.enabled}
                      onChange={(change) => onEvent(event.id, { enabled: change.target.checked })}
                    />
                    <span>{event.name}</span>
                  </label>
                  <span
                    className={`badge ${
                      event.category === 'traffic' ? 'badge--info' : 'badge--warn'
                    }`}
                  >
                    {CATEGORY_LABEL[event.category] ?? event.category}
                  </span>
                </div>
                <p className="event-row__desc">{event.description}</p>
                <div className="event-row__controls">
                  <NumberField
                    label="Prob. %"
                    value={Math.round(event.probability * 100)}
                    min={0}
                    max={100}
                    step={1}
                    onCommit={(percent) => onEvent(event.id, { probability: percent / 100 })}
                  />
                  <NumberField
                    label="Cooldown (s)"
                    value={event.cooldownMs / 1000}
                    min={0}
                    max={3600}
                    step={1}
                    onCommit={(seconds) =>
                      onEvent(event.id, { cooldownMs: Math.round(seconds * 1000) })
                    }
                  />
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => onTrigger(event.id)}
                    aria-label={`Disparar ${event.name}`}
                  >
                    Disparar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div className="event-feed">
        <h3 className="event-panel__section-title">Últimos eventos</h3>
        {state.recent.length === 0 ? (
          <div className="hint">Sin eventos todavía</div>
        ) : (
          <ul className="list event-feed__list">
            {state.recent.map((item, index) => (
              <li key={`${item.at}-${item.eventId}-${index}`} className="event-feed__item">
                <div className="event-feed__head">
                  <span className="mono dim">{time(item.at)}</span>
                  <span
                    className={`badge ${item.source === 'auto' ? 'badge--warn' : 'badge--info'}`}
                  >
                    {item.source}
                  </span>
                  <strong>{item.name}</strong>
                  {item.nodeId && <span className="mono dim">{item.nodeId}</span>}
                  {!item.applied && <span className="badge badge--danger">no aplicado</span>}
                </div>
                <p className="event-feed__msg">{item.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
