import { Icon } from './Icon.jsx'

export function Hud({
  connected,
  running,
  isReplay,
  summary,
  targetTemp,
  target,
  onTarget,
  onApplyTarget,
  onToggleRunning,
  onOpenControl,
  alertCount = 0,
  aiState,
  theme = 'dark',
  onToggleTheme,
}) {
  const aiAvailable = aiState?.available !== false
  const aiEnabled = Boolean(aiState?.enabled)
  const aiLabel = !aiAvailable ? 'IA n/a' : aiEnabled ? 'IA auto' : 'IA off'
  const themeLabel = theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'

  return (
    <header className="hud">
      <div className="hud__brand" data-tutorial-id="hud-brand">
        <span className="hud__logo">
          WAItt <span>control</span>
        </span>
        <span
          className={`hud__live ${isReplay ? 'is-warn' : connected ? 'is-on' : 'is-off'}`}
          role="status"
        >
          <span
            className={`hud__dot ${isReplay ? 'is-warn' : connected ? 'is-on' : 'is-off'}`}
            aria-hidden="true"
          />
          {isReplay ? 'histórico' : connected ? 'en vivo' : 'sin conexión'}
        </span>
        {isReplay && <span className="badge badge--warn">replay</span>}
      </div>

      {summary && (
        <dl className="hud__metrics" aria-label="Resumen del sistema" data-tutorial-id="hud-metrics">
          <div>
            <dt>media</dt>
            <dd>{summary.averageTemp.toFixed(1)}°</dd>
          </div>
          <div>
            <dt>activos</dt>
            <dd>
              {summary.activeWorkers}/{summary.totalWorkers}
            </dd>
          </div>
          <div>
            <dt>errores</dt>
            <dd className={summary.errorWorkers > 0 ? 'is-danger' : undefined}>
              {summary.errorWorkers}
            </dd>
          </div>
        </dl>
      )}

      <div className="hud__actions">
        <button
          type="button"
          data-tutorial-id="hud-ai"
          className={`hud__ai ${aiEnabled ? 'is-auto' : ''} ${aiAvailable ? '' : 'is-off'}`}
          onClick={() => onOpenControl('ia')}
          title="Abrir control de IA"
        >
          <span className="hud__dot" aria-hidden="true" />
          {aiLabel}
        </button>

        <form
          className="hud__target"
          data-tutorial-id="hud-target"
          onSubmit={(event) => {
            event.preventDefault()
            onApplyTarget()
          }}
        >
          <label htmlFor="global-target">objetivo</label>
          <input
            id="global-target"
            type="number"
            inputMode="decimal"
            value={target}
            placeholder={targetTemp != null ? targetTemp.toFixed(1) : '30'}
            onChange={(event) => onTarget(event.target.value)}
            disabled={isReplay}
          />
          <button
            type="submit"
            className="btn btn--sm"
            disabled={isReplay || target === ''}
          >
            fijar
          </button>
        </form>

        <button
          type="button"
          className="icon-btn"
          data-tutorial-id="hud-theme"
          onClick={onToggleTheme}
          aria-label={themeLabel}
          aria-pressed={theme === 'light'}
          title={themeLabel}
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} />
        </button>

        <button
          type="button"
          className="icon-btn"
          data-tutorial-id="hud-running"
          onClick={onToggleRunning}
          disabled={isReplay || !connected}
          aria-label={running ? 'Pausar simulación' : 'Reanudar simulación'}
          title={running ? 'Pausar simulación' : 'Reanudar simulación'}
        >
          <Icon name={running ? 'pause' : 'play'} />
        </button>

        <button
          type="button"
          className="icon-btn hud__bell"
          data-tutorial-id="hud-alerts"
          onClick={() => onOpenControl('alerts')}
          aria-label={`Abrir alertas: ${alertCount}`}
          title="Alertas"
        >
          <Icon name="bell" />
          {alertCount > 0 && <span className="hud__count">{alertCount}</span>}
        </button>

        <button
          type="button"
          className="btn btn--sm hud__panel"
          data-tutorial-id="hud-panel"
          onClick={() => onOpenControl('ia')}
          aria-label="Abrir centro de control"
        >
          <Icon name="sliders" />
          <span>Panel</span>
        </button>
      </div>
    </header>
  )
}
