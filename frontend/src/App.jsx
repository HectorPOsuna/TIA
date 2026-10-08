import { lazy, Suspense, useMemo, useState } from 'react'
import { useRules } from './hooks/useRules.js'
import { useSimulation } from './hooks/useSimulation.js'
import { useHistory } from './hooks/useHistory.js'
import { Header } from './components/Header.jsx'
import { SummaryBar } from './components/SummaryBar.jsx'
import { CollapsiblePanel } from './components/CollapsiblePanel.jsx'
import { NodeDetailPanel } from './components/NodeDetailPanel.jsx'
import { RulesPanel } from './components/RulesPanel.jsx'
import { PoolPanel } from './components/PoolPanel.jsx'
import { AlertsPanel } from './components/AlertsPanel.jsx'
import { ReplayControls } from './components/ReplayControls.jsx'
import { Legend } from './three/Legend.jsx'
import './App.css'

const Scene = lazy(() => import('./three/Scene.jsx').then((m) => ({ default: m.Scene })))

export default function App() {
  const { snapshot, status, connected, alerts, api } = useSimulation()
  const { rules, api: rulesApi } = useRules()
  const history = useHistory()

  const [selectedId, setSelectedId] = useState(null)
  const [target, setTarget] = useState('')
  const [open, setOpen] = useState({ detail: true, rules: false, pool: false, alerts: true })

  const live = snapshot
  const isReplay = history.isReplay
  const effective = isReplay && history.replaySnapshot ? history.replaySnapshot : live
  const running = live?.running ?? status?.running
  const pool = effective?.pendingQueue
  const bandHi = effective ? effective.targetTemp + 8 : null
  const bandLo = effective ? effective.targetTemp - 8 : null

  const selectedNode = effective
    ? effective.general.id === selectedId
      ? effective.general
      : effective.workers.find((w) => w.id === selectedId) ?? null
    : null

  const series = useMemo(() => {
    if (!selectedId) return null
    const values = []
    for (const sample of history.samples) {
      const snap = sample.snapshot
      const node =
        snap.general.id === selectedId
          ? snap.general
          : snap.workers.find((w) => w.id === selectedId)
      if (node) values.push(node.currentTemp)
    }
    return values
  }, [selectedId, history.samples])

  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }))

  const applyTarget = () => {
    if (target === '') return
    api.patchSystem({ targetTemp: Number(target) })
    setTarget('')
  }

  return (
    <div className="app">
      <Header
        connected={connected}
        running={running}
        isReplay={isReplay}
        target={target}
        onTarget={setTarget}
        onApplyTarget={applyTarget}
        onToggleRunning={() => (running ? api.pause() : api.resume())}
        onReset={() => api.reset()}
      />

      <div className="layout">
        <main className="scene-wrap">
          {effective ? (
            <>
              <div className="scene-overlay scene-overlay--tl">
                <SummaryBar
                  summary={effective.summary}
                  targetTemp={effective.targetTemp}
                  ambientTemp={effective.ambientTemp}
                />
              </div>
              <Suspense fallback={null}>
                <Scene
                  snapshot={effective}
                  bandLo={bandLo}
                  bandHi={bandHi}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </Suspense>
              <div className="scene-overlay scene-overlay--br">
                <Legend lo={bandLo} hi={bandHi} />
                <ReplayControls
                  samples={history.samples}
                  replayIndex={history.replayIndex}
                  isReplay={history.isReplay}
                  onGo={history.goTo}
                  onLive={history.live}
                  onStep={history.step}
                />
              </div>
            </>
          ) : (
            <div className="scene-empty">
              <strong>Esperando datos del simulador…</strong>
              <div>Arranca el backend (puerto 3000) y vuelve a cargar la página.</div>
            </div>
          )}
        </main>

        <aside className="rail">
          <CollapsiblePanel
            title="Nodo seleccionado"
            meta={selectedNode ? selectedNode.name.toUpperCase() : '—'}
            open={open.detail}
            onToggle={() => toggle('detail')}
          >
            <NodeDetailPanel node={selectedNode} series={series} api={api} />
          </CollapsiblePanel>

          <CollapsiblePanel
            title="Cola global"
            meta={pool ? `${pool.size}/${pool.capacity}` : null}
            open={open.pool}
            onToggle={() => toggle('pool')}
          >
            <PoolPanel pool={pool} api={api} />
          </CollapsiblePanel>

          <CollapsiblePanel
            title="Reglas reactivas"
            meta={rules.length}
            open={open.rules}
            onToggle={() => toggle('rules')}
          >
            <RulesPanel rules={rules} api={rulesApi} />
          </CollapsiblePanel>

          <CollapsiblePanel
            title="Alertas"
            meta={alerts.length}
            open={open.alerts}
            onToggle={() => toggle('alerts')}
          >
            <AlertsPanel alerts={alerts} />
          </CollapsiblePanel>
        </aside>
      </div>
    </div>
  )
}