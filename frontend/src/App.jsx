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

function NodeCard({ node, api }) {
  const { patchNode, enqueue } = api
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
        {node.queue.processing && <> · procesando: {node.queue.processing.type}</>} · eventos{' '}
        {node.stack.size}
      </div>
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
        <button
          type="button"
          onClick={() =>
            enqueue(node.id, { type: 'cooldown', estimatedDurationMs: 8000, description: 'Manual' })
          }
        >
          Encolar
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { snapshot, status, connected, alerts, api } = useSimulation()
  const { rules, triggered, api: rulesApi } = useRules()
  const [target, setTarget] = useState('')

  const summary = snapshot?.summary
  const running = snapshot?.running ?? status?.running

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>TIA · Simulador de temperatura</h1>
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