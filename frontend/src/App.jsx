import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRules } from './hooks/useRules.js'
import { useSimulation } from './hooks/useSimulation.js'
import { useHistory } from './hooks/useHistory.js'
import { useInference } from './hooks/useInference.js'
import { useAiControl } from './hooks/useAiControl.js'
import { useReducedMotion } from './hooks/useReducedMotion.js'
import { Hud } from './components/Hud.jsx'
import { NodeDock } from './components/NodeDock.jsx'
import { NodeDrawer } from './components/NodeDrawer.jsx'
import { ControlCenter } from './components/ControlCenter.jsx'
import { ReplayBar } from './components/ReplayBar.jsx'
import { ToastStack } from './components/ToastStack.jsx'
import { SceneErrorBoundary } from './components/SceneErrorBoundary.jsx'
import { Legend } from './three/Legend.jsx'
import './App.css'

const Scene = lazy(() => import('./three/Scene.jsx').then((m) => ({ default: m.Scene })))
const ALERT_TOAST_MS = 6000

export default function App() {
  const { snapshot, status, connected, alerts, api } = useSimulation()
  const { rules, triggered, api: rulesApi } = useRules()
  const history = useHistory()
  const inference = useInference()
  const aiControl = useAiControl()
  const reducedMotion = useReducedMotion()

  const [selectedId, setSelectedId] = useState(null)
  const [controlTab, setControlTab] = useState(null)
  const [target, setTarget] = useState('')
  const [hintVisible, setHintVisible] = useState(true)
  const [toasts, setToasts] = useState([])
  const toastTimers = useRef(new Map())
  const lastAlertKey = useRef(null)

  const live = snapshot
  const isReplay = history.isReplay
  const effective = isReplay && history.replaySnapshot ? history.replaySnapshot : live
  const running = live?.running ?? status?.running
  const pool = effective?.pendingQueue
  const bandHi = effective ? effective.targetTemp + 8 : null
  const bandLo = effective ? effective.targetTemp - 8 : null
  const nodes = effective ? [effective.general, ...effective.workers] : []
  const liveNodes = live ? [live.general, ...live.workers] : []

  const selectedNode = effective
    ? effective.general.id === selectedId
      ? effective.general
      : effective.workers.find((w) => w.id === selectedId) ?? null
    : null
  const selectedAi =
    selectedId && aiControl.status?.nodes
      ? aiControl.status.nodes.find((entry) => entry.nodeId === selectedId) ?? null
      : null

  const series = useMemo(() => {
    if (!selectedId) return null
    const values = []
    for (const sample of history.samples) {
      const node =
        sample.general.id === selectedId
          ? sample.general
          : sample.workers.find((w) => w.id === selectedId)
      if (node) values.push(node.currentTemp)
    }
    return values
  }, [selectedId, history.samples])

  const selectNode = (id) => {
    setSelectedId(id)
    setHintVisible(false)
  }

  const closeDrawer = useCallback(() => setSelectedId(null), [])
  const closeControl = useCallback(() => setControlTab(null), [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    const timer = toastTimers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      toastTimers.current.delete(id)
    }
  }, [])

  const pushToast = useCallback((alert) => {
    const id = `${alert.at ?? alert.ts}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((prev) => [...prev.slice(-2), { ...alert, id }])
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      toastTimers.current.delete(id)
    }, ALERT_TOAST_MS)
    toastTimers.current.set(id, timer)
  }, [])

  useEffect(() => {
    const timers = toastTimers.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  useEffect(() => {
    if (isReplay) return
    const newest = alerts[0]
    if (!newest) return
    const key = `${newest.at ?? newest.ts ?? ''}-${newest.message ?? ''}-${newest.nodeId ?? ''}`
    if (key === lastAlertKey.current) return
    lastAlertKey.current = key
    pushToast(newest)
  }, [alerts, isReplay, pushToast])

  useEffect(() => {
    if (!hintVisible || selectedId) return undefined
    const id = setTimeout(() => setHintVisible(false), 9000)
    return () => clearTimeout(id)
  }, [hintVisible, selectedId])

  const applyTarget = () => {
    if (target === '') return
    api.patchSystem({ targetTemp: Number(target) })
    setTarget('')
  }

  return (
    <div className="app">
      <div className="stage">
        <main className="scene-col">
          <div className="scene-canvas">
            {effective ? (
              <SceneErrorBoundary>
                <Suspense
                  fallback={
                    <div className="scene-loading" role="status">
                      Cargando escena 3D…
                    </div>
                  }
                >
                  <div className="scene-canvas__3d" aria-hidden="true">
                    <Scene
                      snapshot={effective}
                      bandLo={bandLo}
                      bandHi={bandHi}
                      selectedId={selectedId}
                      onSelect={selectNode}
                      reducedMotion={reducedMotion}
                    />
                  </div>
                </Suspense>
              </SceneErrorBoundary>
            ) : (
              <div className="scene-empty" role="status">
                <span className="scene-empty__eyebrow">WAItt control</span>
                <strong>Esperando datos del simulador…</strong>
                <span>Arranca el backend en el puerto 3000 y vuelve a cargar la página.</span>
              </div>
            )}
          </div>

          <Hud
            connected={connected}
            running={running}
            isReplay={isReplay}
            summary={effective?.summary}
            targetTemp={effective?.targetTemp}
            target={target}
            onTarget={setTarget}
            onApplyTarget={applyTarget}
            onToggleRunning={() => (running ? api.pause() : api.resume())}
            onOpenControl={(tab) => setControlTab(tab)}
            alertCount={alerts.length}
            aiState={aiControl.status}
          />

          {effective && (
            <NodeDock nodes={nodes} selectedId={selectedId} onSelect={selectNode} />
          )}

          {effective && bandLo != null && (
            <div className="scene-overlay scene-overlay--bl">
              <Legend lo={bandLo} hi={bandHi} />
            </div>
          )}

          {effective && (
            <div className="scene-overlay scene-overlay--bc">
              <ReplayBar
                samples={history.samples}
                replayIndex={history.replayIndex}
                isReplay={history.isReplay}
                onGo={history.goTo}
                onLive={history.live}
                onStep={history.step}
              />
            </div>
          )}

          {effective && !selectedId && hintVisible && (
            <div className="scene-hint" role="status">
              Haz clic en un nodo o usa la lista para ver su detalle
            </div>
          )}

          {!isReplay && <ToastStack toasts={toasts} onDismiss={dismissToast} />}
        </main>

        {selectedNode && (
          <NodeDrawer
            node={selectedNode}
            series={series}
            api={api}
            inference={!isReplay && selectedId ? inference.latest[selectedId] : undefined}
            aiNode={!isReplay ? selectedAi : null}
            readOnly={isReplay}
            onClose={closeDrawer}
          />
        )}
      </div>

      {controlTab && (
        <ControlCenter
          tab={controlTab}
          onTab={setControlTab}
          onClose={closeControl}
          readOnly={isReplay}
          rules={rules}
          triggered={triggered}
          rulesApi={rulesApi}
          pool={pool}
          api={api}
          aiControl={aiControl}
          inference={inference}
          liveNodes={liveNodes}
          alerts={alerts}
          effective={effective}
          samples={history.samples}
        />
      )}
    </div>
  )
}
