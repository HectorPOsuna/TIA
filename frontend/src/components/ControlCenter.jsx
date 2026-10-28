import { useEffect, useRef } from 'react'
import { AiControlPanel } from './AiControlPanel.jsx'
import { AlertsPanel } from './AlertsPanel.jsx'
import { EfficiencyPanel } from './EfficiencyPanel.jsx'
import { Icon } from './Icon.jsx'
import { ModelPanel } from './ModelPanel.jsx'
import { PoolPanel } from './PoolPanel.jsx'
import { RulesPanel } from './RulesPanel.jsx'

const TABS = [
  { id: 'ia', label: 'IA' },
  { id: 'automation', label: 'Automatización' },
  { id: 'system', label: 'Sistema' },
  { id: 'alerts', label: 'Alertas' },
]

export function ControlCenter({
  tab,
  onTab,
  onClose,
  readOnly,
  rules,
  triggered,
  rulesApi,
  pool,
  api,
  aiControl,
  inference,
  liveNodes,
  alerts,
  effective,
  samples,
}) {
  const dialogRef = useRef(null)
  const tabRefs = useRef([])
  const activeTab = TABS.some((item) => item.id === tab) ? tab : 'ia'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const onTabKeyDown = (event, index) => {
    const last = TABS.length - 1
    let next = null
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    onTab(TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <dialog
      ref={dialogRef}
      className="control-center"
      aria-labelledby="control-center-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <header className="control-center__head">
        <div>
          <h2 id="control-center-title">Centro de control</h2>
          <p className="hint">Configuración, actividad y estado global del simulador.</p>
        </div>
        {readOnly && <span className="badge badge--warn">solo lectura</span>}
        <button
          type="button"
          className="icon-btn control-center__close"
          onClick={onClose}
          aria-label="Cerrar centro de control"
          title="Cerrar"
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="control-center__tabs" role="tablist" aria-label="Secciones del centro de control">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`cc-tab-${item.id}`}
            aria-selected={activeTab === item.id}
            aria-controls={`cc-panel-${item.id}`}
            tabIndex={activeTab === item.id ? 0 : -1}
            className={`control-center__tab ${activeTab === item.id ? 'is-active' : ''}`}
            onClick={() => onTab(item.id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {item.label}
            {item.id === 'alerts' && alerts.length > 0 && (
              <span className="control-center__count">{alerts.length}</span>
            )}
            {item.id === 'automation' && rules.length > 0 && (
              <span className="control-center__count">{rules.length}</span>
            )}
          </button>
        ))}
      </div>

      {readOnly && (
        <div className="readonly-banner readonly-banner--wide">
          <Icon name="alert" size={15} />
          Estás viendo una muestra histórica. La edición está deshabilitada.
        </div>
      )}

      <fieldset className="control-center__fieldset" disabled={readOnly}>
        <div className="control-center__content">
          <div
            role="tabpanel"
            id="cc-panel-ia"
            aria-labelledby="cc-tab-ia"
            hidden={activeTab !== 'ia'}
            className="cc-grid cc-grid--2"
          >
            <section className="cc-section">
              <h3>Predicciones</h3>
              <ModelPanel
                latest={inference.latest}
                version={inference.version}
                meta={inference.meta}
                enabled={inference.enabled}
                stats={inference.stats}
                nodes={liveNodes}
                aiNodes={aiControl.status?.nodes ?? []}
              />
            </section>
            <section className="cc-section">
              <h3>Control de IA</h3>
              <AiControlPanel
                status={aiControl.status}
                recent={aiControl.recent}
                error={aiControl.error}
                busy={aiControl.busy}
                onEnabled={aiControl.setEnabled}
                onPolicy={aiControl.setPolicy}
              />
            </section>
          </div>

          <div
            role="tabpanel"
            id="cc-panel-automation"
            aria-labelledby="cc-tab-automation"
            hidden={activeTab !== 'automation'}
            className="cc-grid cc-grid--automation"
          >
            <section className="cc-section">
              <h3>Reglas reactivas</h3>
              <RulesPanel rules={rules} triggered={triggered} api={rulesApi} />
            </section>
            <section className="cc-section">
              <h3>Cola global</h3>
              <PoolPanel pool={pool} api={api} />
            </section>
          </div>

          <div
            role="tabpanel"
            id="cc-panel-system"
            aria-labelledby="cc-tab-system"
            hidden={activeTab !== 'system'}
            className="cc-grid cc-grid--2"
          >
            <section className="cc-section">
              <h3>Eficiencia</h3>
              <EfficiencyPanel
                snapshot={effective}
                samples={samples}
                inference={inference.latest}
              />
            </section>
            <section className="cc-section">
              <h3>Simulación</h3>
              <p className="hint">
                Reinicia el estado térmico, las colas y los contadores. La configuración y las
                reglas se conservan.
              </p>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  if (window.confirm('¿Reiniciar la simulación?')) api.reset()
                }}
              >
                <Icon name="reset" size={15} />
                Reiniciar simulación
              </button>
            </section>
          </div>

          <div
            role="tabpanel"
            id="cc-panel-alerts"
            aria-labelledby="cc-tab-alerts"
            hidden={activeTab !== 'alerts'}
            className="cc-grid"
          >
            <section className="cc-section">
              <h3>Alertas</h3>
              <AlertsPanel alerts={alerts} />
            </section>
          </div>
        </div>
      </fieldset>
    </dialog>
  )
}
