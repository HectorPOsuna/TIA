import { useState } from 'react'
import { useRules } from './hooks/useRules.js'
import { useSimulation } from './hooks/useSimulation.js'
import './App.css'

const card = {
  border: '1px solid #333',
  borderRadius: 8,
  padding: '12px 16px',
  background: '#1a1a2e',
  minWidth: 240,
}

const badge = (color) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 12,
  background: color,
  color: '#fff',
})

const statusColor = { active: '#2e7d32', inactive: '#8b7355', error: '#c62828' }

function fmt(n) {
  return n.toFixed(2)
}

const prioOpts = [1, 2, 3, 4, 5]
const demandOpts = prioOpts
const durationOpts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function TaskForm({ priority, onPriority, demand, onDemand, duration, onDuration, onSubmit, submitLabel }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
      <label style={labelSmall}>
        prioridad
        <select value={priority} onChange={(e) => onPriority(Number(e.target.value))}>
          {prioOpts.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label style={labelSmall}>
        demanda
        <select value={demand} onChange={(e) => onDemand(Number(e.target.value))}>
          {demandOpts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label style={labelSmall}>
        duración (s)
        <select value={duration} onChange={(e) => onDuration(Number(e.target.value))}>
          {durationOpts.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={onSubmit}>
        {submitLabel}
      </button>
    </div>
  )
}

const labelSmall = { fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }

function NodeCard({ node, api }) {
  const { patchNode, enqueue } = api
  const [priority, setPriority] = useState(3)
  const [demand, setDemand] = useState(1)
  const [duration, setDuration] = useState(8)
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{node.name}</strong>
        <span style={badge(statusColor[node.status] ?? '#666')}>{node.status}</span>
      </div>
      <div style={{ fontSize: 28, marginTop: 6 }}>
        {fmt(node.currentTemp)}°C
        {node.fanActive && <span style={{ marginLeft: 8, fontSize: 14 }}>💨</span>}
      </div>
      <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
        objetivo {fmt(node.targetTemp)}°C · ambiente {fmt(node.ambientTemp)}°C · carga{' '}
        {fmt(node.workload)}
      </div>
      <div style={{ fontSize: 12, color: '#aaa' }}>
        cola {node.queue.size}/{node.queue.capacity}
        {node.queue.processing && (
          <>
            {' '}
            · procesando: {node.queue.processing.type} (p{node.queue.processing.priority} ·{' '}
            {node.queue.processing.durationSecs}s)
          </>
        )}{' '}
        · eventos {node.stack.size}
      </div>
      {node.queue.list.length > 0 && (
        <ul style={{ fontSize: 11, color: '#999', paddingLeft: 16, margin: '6px 0 0' }}>
          {node.queue.list.map((t) => (
            <li key={t.id}>
              {t.type} (p{t.priority} · {t.durationSecs}s)
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => patchNode(node.id, { targetTemp: node.targetTemp - 5 })}>
          -5°C
        </button>
        <button type="button" onClick={() => patchNode(node.id, { targetTemp: node.targetTemp + 5 })}>
          +5°C
        </button>
        <button type="button" onClick={() => patchNode(node.id, { fanActive: !node.fanActive })}>
          Ventilador {node.fanActive ? 'off' : 'on'}
        </button>
      </div>
      <TaskForm
        priority={priority}
        onPriority={setPriority}
        demand={demand}
        onDemand={setDemand}
        duration={duration}
        onDuration={setDuration}
        submitLabel="Encolar"
        onSubmit={() =>
          enqueue(node.id, {
            type: 'cooldown',
            priority,
            computeDemand: demand,
            durationSecs: duration,
            description: 'Manual',
          })
        }
      />
    </div>
  )
}

export default function App() {
  const { snapshot, status, connected, alerts, api } = useSimulation()
  const { rules, triggered, api: rulesApi } = useRules()
  const [target, setTarget] = useState('')
  const [poolPriority, setPoolPriority] = useState(5)
  const [poolDemand, setPoolDemand] = useState(3)
  const [poolDuration, setPoolDuration] = useState(8)

  const summary = snapshot?.summary
  const running = snapshot?.running ?? status?.running
  const pool = snapshot?.pendingQueue

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>WAItt · Simulador de temperatura</h1>
        <span style={badge(connected ? '#2e7d32' : '#c62828')}>
          {connected ? 'conectado' : 'sin conexión'}
        </span>
        <span style={badge(running ? '#1565c0' : '#8e24aa')}>
          {running ? 'en ejecución' : 'pausado'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => (running ? api.pause() : api.resume())}>
            {running ? 'Pausar' : 'Reanudar'}
          </button>
          <button type="button" onClick={() => api.reset()}>
            Reset
          </button>
        </div>
      </header>

      {summary && (
        <section style={{ display: 'flex', gap: 12, margin: '16px 0', flexWrap: 'wrap' }}>
          <span>Nodos: {summary.totalWorkers}</span>
          <span style={{ color: '#2e7d32' }}>activos {summary.activeWorkers}</span>
          <span style={{ color: '#8b7355' }}>inactivos {summary.inactiveWorkers}</span>
          <span style={{ color: '#c62828' }}>en error {summary.errorWorkers}</span>
          <span>Temp media: {fmt(summary.averageTemp)}°C</span>
          <label style={{ marginLeft: 'auto' }}>
            Objetivo global (°C){' '}
            <input
              type="number"
              value={target}
              placeholder={snapshot?.targetTemp ?? ''}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (target !== '') {
                api.patchSystem({ targetTemp: Number(target) })
                setTarget('')
              }
            }}
          >
            Aplicar
          </button>
        </section>
      )}

      {snapshot && (
        <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[snapshot.general, ...snapshot.workers].map((node) => (
            <NodeCard key={node.id} node={node} api={api} />
          ))}
        </section>
      )}

      {pool && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Cola de prioridad global</h2>
            <span style={{ fontSize: 12, color: '#aaa' }}>
              {pool.size}/{pool.capacity} pendientes
            </span>
            <TaskForm
              priority={poolPriority}
              onPriority={setPoolPriority}
              demand={poolDemand}
              onDemand={setPoolDemand}
              duration={poolDuration}
              onDuration={setPoolDuration}
              submitLabel="Encolar al pool"
              onSubmit={() =>
                api.submitTask({
                  type: 'custom',
                  priority: poolPriority,
                  computeDemand: poolDemand,
                  durationSecs: poolDuration,
                  description: 'Tarea manual al pool',
                })
              }
            />
            {pool.size > 0 && (
              <button type="button" onClick={() => api.clearPool()}>
                Vaciar pool
              </button>
            )}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
            {pool.list.map((t) => (
              <li key={t.id} style={{ fontSize: 13, padding: '2px 0', color: '#ccc' }}>
                [{t.description ?? t.type}] p{t.priority} · demanda {t.computeDemand} · {t.durationSecs}s
              </li>
            ))}
            {pool.size === 0 && <li style={{ color: '#888' }}>Sin tareas pendientes</li>}
          </ul>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>Reglas reactivas</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {rules.map((rule) => (
            <li key={rule.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{rule.name}</strong>
                  <div style={{ fontSize: 12, color: '#aaa' }}>
                    {rule.subject} · {rule.metric} {rule.op} {rule.value} → {rule.action} · disparos:{' '}
                    {rule.triggerCount}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={badge(rule.enabled ? '#2e7d32' : '#666')}>
                    {rule.enabled ? 'activa' : 'desactivada'}
                  </span>
                  <button type="button" onClick={() => rulesApi.toggle(rule.id, rule.enabled)}>
                    {rule.enabled ? 'Desactivar' : 'Activar'}
                  </button>
                  <button type="button" onClick={() => rulesApi.remove(rule.id)}>
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
          {rules.length === 0 && <li style={{ color: '#888' }}>Sin reglas</li>}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Alertas</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {alerts.map((alert, i) => (
            <li key={i} style={{ fontSize: 13, padding: '4px 0', color: '#ff8a65' }}>
              [{new Date(alert.ts).toLocaleTimeString()}] {alert.nodeId}: {alert.message}
            </li>
          ))}
          {alerts.length === 0 && <li style={{ color: '#888' }}>Sin alertas</li>}
        </ul>
      </section>

      {triggered.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Disparos recientes</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {triggered.map((t, i) => (
              <li key={i} style={{ fontSize: 13, padding: '2px 0', color: '#888' }}>
                {t.ruleName} → {t.nodeIds?.join(', ') ?? ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}