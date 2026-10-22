const ACTION_LABEL = {
  fan_on: 'ventilador on',
  fan_off: 'ventilador off',
  set_workload: 'carga',
  target_offset: 'objetivo',
  enqueue_cooldown: 'tarea frío',
  enqueue_load: 'tarea carga',
  shutdown: 'apagado',
  startup: 'encendido',
}

const ACTION_OPTIONS = [
  { key: 'allowFan', label: 'Ventilador' },
  { key: 'allowLoad', label: 'Carga' },
  { key: 'allowTarget', label: 'Objetivo' },
  { key: 'allowTasks', label: 'Tareas' },
  { key: 'allowShutdown', label: 'Apagado' },
]

const time = (ts) => new Date(ts).toLocaleTimeString('es')

export function AiControlPanel({ status, recent, error, busy, onEnabled, onPolicy }) {
  if (!status) {
    return <div className="hint">Cargando control de IA…</div>
  }
  if (!status.available) {
    return (
      <div className="hint">
        Control de IA no disponible. Requiere inferencia activa (`INFERENCE_ENABLED=true`) y un
        modelo cargado.
      </div>
    )
  }

  const policy = status.policy ?? {}
  const enabled = status.enabled
  const actions = recent ?? status.recent ?? []

  return (
    <div className="ai-control">
      <div className="ai-control__head">
        <div>
          <span className={`badge ${enabled ? 'badge--warn' : 'badge--muted'}`}>
            {enabled ? 'auto' : 'off'}
          </span>
          <div className="hint" style={{ marginTop: 4 }}>
            {enabled
              ? 'La IA puede actuar sobre los workers.'
              : 'La IA solo predice; el control está desactivado.'}
          </div>
        </div>
        <button
          type="button"
          className={`btn btn--sm ${enabled ? 'btn--danger' : 'btn--primary'}`}
          disabled={busy}
          onClick={() => onEnabled(!enabled)}
        >
          {enabled ? 'Detener IA' : 'Activar IA'}
        </button>
      </div>

      {error && (
        <div className="hint" style={{ color: 'var(--danger)', marginTop: 6 }}>
          {error}
        </div>
      )}

      <div className="ai-checks">
        {ACTION_OPTIONS.map((option) => (
          <label key={option.key} className="ai-check">
            <input
              type="checkbox"
              checked={policy[option.key] !== false}
              disabled={busy}
              onChange={(event) => onPolicy({ [option.key]: event.target.checked })}
            />
            {option.label}
          </label>
        ))}
      </div>

      <div className="ai-thresholds mono">
        <span>banda ±{policy.hotDelta ?? 1.5} °C</span>
        <span>objetivo ±{policy.targetMargin ?? 1.5} °C</span>
        <span>carga {policy.loadMin ?? 0.05}–{policy.loadMax ?? 0.8}</span>
        <span>cooldown {(policy.cooldownMs ?? 5000) / 1000}s</span>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <span className="hint">Acciones aplicadas</span>
        <span className="mono">{status.stats?.actions ?? 0}</span>
      </div>
      <div className="row">
        <span className="hint">Último minuto</span>
        <span className="mono">{status.stats?.actionsLastMinute ?? 0}</span>
      </div>

      <div className="ai-actions">
        <div className="hint" style={{ marginBottom: 4 }}>
          Últimas acciones
        </div>
        {actions.length === 0 ? (
          <div className="hint">Sin acciones de IA todavía.</div>
        ) : (
          <ul className="list">
            {actions.slice(0, 8).map((action, index) => (
              <li key={`${action.at}-${index}`} className="ai-action">
                <div className="ai-action__head">
                  <strong>{action.nodeId}</strong>
                  <span className="badge badge--info">
                    {ACTION_LABEL[action.action] ?? action.action}
                  </span>
                  <span className="dim mono">{time(action.at)}</span>
                </div>
                <div className="hint">{action.reason}</div>
                <div className="mono dim ai-action__data">
                  {action.predictedTemp?.toFixed(2)}° previstos · base{' '}
                  {action.baseTarget?.toFixed(1)}° · efectivo {action.targetTemp?.toFixed(1)}°
                  {action.offset ? ` (${action.offset > 0 ? '+' : ''}${action.offset.toFixed(1)})` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hint" style={{ marginTop: 8 }}>
        El apagado de emergencia está desactivado por defecto. La IA no toca el Servidor General
        (es un agregado de los workers).
      </div>
    </div>
  )
}
