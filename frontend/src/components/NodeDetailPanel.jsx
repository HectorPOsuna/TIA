import { TaskForm } from './TaskForm.jsx'
import { Sparkline } from './Sparkline.jsx'
import { recommend } from '../lib/recommendation.js'

const STATUS_BADGE = { active: 'badge--ok', inactive: 'badge--muted', error: 'badge--danger' }
const AI_ACTION = {
  fan_on: 'ventilador on',
  fan_off: 'ventilador off',
  set_workload: 'ajuste de carga',
  target_offset: 'ajuste de objetivo',
  enqueue_cooldown: 'tarea de frío',
  enqueue_load: 'tarea de carga',
  shutdown: 'apagado',
  startup: 'encendido',
}

export function NodeDetailPanel({ node, series, api, inference, aiNode }) {
  if (!node) {
    return (
      <div className="detail__none">Selecciona un nodo en el plano 3D para ver sus controles.</div>
    )
  }
  const { patchNode, enqueue } = api
  const load = Math.max(0, Math.min(1, node.workload))
  const rec = inference ? recommend(inference.predictedTemp, node.targetTemp) : null
  const delta = inference ? inference.predictedTemp - node.currentTemp : null
  const offset = node.aiTargetOffset ?? 0
  const effectiveTarget = node.targetTemp + offset

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
        objetivo {node.targetTemp.toFixed(1)}°C
        {offset !== 0 && ` · IA ${offset > 0 ? '+' : ''}${offset.toFixed(1)}° (${effectiveTarget.toFixed(1)}°C)`}
        {' · '}ambiente {node.ambientTemp.toFixed(1)}°C
      </div>

      {aiNode && (aiNode.aiShutdown || aiNode.lastAction) && (
        <div className="detail__ai-status">
          <span className="hint">Control IA</span>
          <span className={`badge ${aiNode.aiShutdown ? 'badge--danger' : 'badge--info'}`}>
            {aiNode.aiShutdown
              ? 'apagado por IA'
              : AI_ACTION[aiNode.lastAction] ?? aiNode.lastAction}
          </span>
        </div>
      )}

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

      {rec && (
        <div className="detail__model">
          <div className="row">
            <span className="hint">Modelo IA · +{(inference.horizonMs / 1000).toFixed(0)} s</span>
            <span className={`badge ${rec.tone}`}>{rec.label}</span>
          </div>
          <div className="detail__model-temp">
            {inference.predictedTemp.toFixed(2)}
            <small> °C previstos</small>
          </div>
          <div className="hint">{rec.detail}</div>
          <div className="hint mono">
            Δ vs actual {delta >= 0 ? '+' : ''}
            {delta.toFixed(2)} °C · latencia {inference.latencyMs} ms
          </div>
        </div>
      )}

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

      {node.stack.list.length > 0 && (
        <div className="detail__queue">
          <div className="hint" style={{ marginBottom: 4 }}>
            Pila LIFO (última arriba)
          </div>
          <ul className="list">
            {node.stack.list.slice(0, 5).map((entry, i) => (
              <li
                key={`${entry.ts}-${i}`}
                className="list__item mono"
                style={{ fontSize: 12 }}
              >
                <strong>{entry.kind}</strong>
                <span className="dim">{entry.label}</span>
                <span className="dim" style={{ marginLeft: 'auto' }}>
                  {new Date(entry.ts).toLocaleTimeString('es')}
                </span>
              </li>
            ))}
            {node.stack.list.length > 5 && (
              <li className="list__item dim" style={{ fontSize: 12 }}>
                +{node.stack.list.length - 5} más
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
          <Sparkline
            values={series}
            target={node.targetTemp}
            marker={inference ? inference.predictedTemp : null}
          />
        </div>
      )}
    </div>
  )
}