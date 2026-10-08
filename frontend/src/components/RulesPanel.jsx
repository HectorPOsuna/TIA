export function RulesPanel({ rules, api }) {
  return (
    <ul className="list">
      {rules.map((rule) => (
        <li key={rule.id} className="list__item" style={{ justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <strong>{rule.name}</strong>
            <div className="hint">
              {rule.subject} · {rule.metric} {rule.op} {rule.value} → {rule.action} · disparos:{' '}
              {rule.triggerCount}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className={`badge ${rule.enabled ? 'badge--ok' : 'badge--muted'}`}>
              {rule.enabled ? 'activa' : 'off'}
            </span>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => api.toggle(rule.id, rule.enabled)}
            >
              {rule.enabled ? 'Desactivar' : 'Activar'}
            </button>
            <button type="button" className="btn btn--sm btn--danger" onClick={() => api.remove(rule.id)}>
              ✕
            </button>
          </div>
        </li>
      ))}
      {rules.length === 0 && <li className="list__empty">Sin reglas</li>}
    </ul>
  )
}