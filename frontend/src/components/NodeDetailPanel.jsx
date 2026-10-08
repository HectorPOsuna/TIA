import { TaskForm } from './TaskForm.jsx'
import { Sparkline } from './Sparkline.jsx'

const STATUS_BADGE = { active: 'badge--ok', inactive: 'badge--muted', error: 'badge--danger' }

export function NodeDetailPanel({ node, series, api }) {
  if (!node) {
    return (
      <div className="detail__none">Selecciona un nodo en el plano 3D para ver sus controles.</div>
    )
  }
  const { patchNode, enqueue } = api
  const load = Math.max(0, Math.min(1, node.workload))

  return (
    <div>
      <div className="detail__head">
        <div>
          <strong style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{node.name}</strong>
          <div className="dim mono" style={{ fontSize: 12 }}>
            {node.id} · {node.type}
          </div>
        </div>
        <span className={`badge ${STATUS_BADGE[node.status] ?? ''}`}>{node.status}</span>
      </div>

      <div className="detail__temp">
        {node.currentTemp.toFixed(2)}
        <small> °C</small>
      </div>
      <div className="hint">
        objetivo {node.targetTemp.toFixed(1)}°C · ambiente {node.ambientTemp.toFixed(1)}°C
      </div>

      <div className="detail__actions">
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => patchNode(node.id, { targetTemp: node.targetTemp - 5 })}
        >
          -5°
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => patchNode(node.id, { targetTemp: node.targetTemp + 5 })}
        >
          +5°
        </button>
        <button
          type="button"
          className={`btn btn--sm ${node.fanActive ? 'btn--primary' : ''}`}
          onClick={() => patchNode(node.id, { fanActive: !node.fanActive })}
        >
          Ventilador {node.fanActive ? 'on' : 'off'}
        </button>
      </div>

      <div className="detail__grid">
        <div className="detail__metric">
          <div>carga</div>
          <div>{node.workload.toFixed(2)}</div>
          <div className="detail__bar">
            <span style={{ width: `${load * 100}%` }} />
          </div>
        </div>
        <div className="detail__metric">
          <div>cola</div>
          <div>
            {node.queue.size}/{node.queue.capacity}
            {node.queue.processing ? ` · ${node.queue.processing.type}` : ''}
          </div>
        </div>
        <div className="detail__metric">
          <div>pila (eventos)</div>
          <div>{node.stack.size}</div>
        </div>
        <div className="detail__metric">
          <div>fallos consecutivos</div>
          <div>{node.stats.consecutiveFailures}</div>
        </div>
      </div>

      {node.queue.list.length > 0 && (
        <div className="detail__queue">
          <div className="hint" style={{ marginBottom: 4 }}>
            Cola del nodo
          </div>
          <ul className="list">
            {node.queue.list.slice(0, 6).map((t) => (
              <li key={t.id} className="list__item mono" style={{ fontSize: 12 }}>
                <strong>{t.type}</strong>
                <span className="dim">
                  p{t.priority} · {t.durationSecs}s
                </span>
              </li>
            ))}
            {node.queue.list.length > 6 && (
              <li className="list__item dim" style={{ fontSize: 12 }}>
                +{node.queue.list.length - 6} más
              </li>
            )}
          </ul>
        </div>
      )}

      <TaskForm
        submitLabel="Encolar tarea"
        onSubmit={(p) =>
          enqueue(node.id, {
            type: 'cooldown',
            description: 'Manual',
            priority: p.priority,
            computeDemand: p.demand,
            durationSecs: p.duration,
          })
        }
      />

      {series && series.length >= 2 && (
        <div style={{ marginTop: 12 }}>
          <div className="hint" style={{ marginBottom: 4 }}>
            Tendencia (sesión)
          </div>
          <Sparkline values={series} target={node.targetTemp} />
        </div>
      )}
    </div>
  )
}