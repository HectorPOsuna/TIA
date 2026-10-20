import { recommend } from '../lib/recommendation.js'

export function ModelPanel({ latest, version, meta, enabled, stats, nodes = [] }) {
  const entries = Object.values(latest).sort((a, b) => a.nodeId.localeCompare(b.nodeId))
  const horizon = meta?.horizon_ms ?? entries[0]?.horizonMs
  const horizonLabel = horizon ? `${(horizon / 1000).toFixed(0)} s` : '—'
  const targets = new Map(nodes.map((node) => [node.id, node.targetTemp]))

  if (enabled === false) {
    return (
      <div className="hint">
        Inferencia deshabilitada en el backend (`INFERENCE_ENABLED=false`) o modelo no disponible.
      </div>
    )
  }

  return (
    <div>
      <div className="row">
        <span className="dim">Modelo</span>
        <span className="mono" title={version ?? ''}>
          {version ?? '—'}
        </span>
      </div>
      <div className="row">
        <span className="dim">Horizonte</span>
        <span className="mono">{horizonLabel}</span>
      </div>
      <div className="row">
        <span className="dim">Predicciones recibidas</span>
        <span className="mono">{stats.count}</span>
      </div>

      {entries.length === 0 ? (
        <div className="hint" style={{ marginTop: 8 }}>
          Esperando inferencias del modelo…
        </div>
      ) : (
        <ul className="list" style={{ marginTop: 8 }}>
          {entries.map((entry) => {
            const target = targets.get(entry.nodeId)
            const rec = recommend(entry.predictedTemp, target)
            const actual = Number.isFinite(entry.actualTemp)
              ? `${entry.actualTemp.toFixed(2)}°`
              : '—'
            return (
              <li key={entry.nodeId} className="list__item model-row">
                <div style={{ minWidth: 0 }}>
                  <strong>{entry.nodeId}</strong>
                  <div className="hint mono">
                    {entry.predictedTemp.toFixed(2)}° prevista · real {actual} · {entry.latencyMs} ms
                  </div>
                </div>
                <span className={`badge ${rec.tone}`}>{rec.label}</span>
              </li>
            )
          })}
        </ul>
      )}

      {entries.length > 0 && (
        <div className="hint" style={{ marginTop: 6 }}>
          Recomendación según la temperatura prevista a {horizonLabel} frente al objetivo.
        </div>
      )}
    </div>
  )
}
