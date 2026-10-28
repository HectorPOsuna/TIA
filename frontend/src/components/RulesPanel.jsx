export function RulesPanel({ rules, triggered = [], api }) {
  return (
    <div>
      {triggered.length > 0 && (
        <div className="detail__queue">
          <div className="hint" style={{ marginBottom: 4 }}>
            Últimos disparos
          </div>
          <ul className="list">
            {triggered.map((item, i) => (
              <li key={`${item.rule?.id ?? 'rule'}-${i}`} className="list__item mono" style={{ fontSize: 12 }}>
                <strong>{item.rule?.name ?? 'regla'}</strong>
                {item.nodeId && <span className="dim">{item.nodeId}</span>}
                <span className="dim">
                  {item.action ?? item.rule?.action}
                  {item.applied === false
                    ? ` · no aplicada${item.reason ? `: ${item.reason}` : ''}`
                    : ''}
                </span>
                <span className="dim" style={{ marginLeft: 'auto' }}>
                  {new Date(item.at).toLocaleTimeString('es')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
              <button
                type="button"
                className="btn btn--sm btn--danger"
                onClick={() => api.remove(rule.id)}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
        {rules.length === 0 && <li className="list__empty">Sin reglas</li>}
      </ul>
    </div>
  )
}
