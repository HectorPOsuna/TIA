import { useMemo } from 'react'
import { Sparkline } from './Sparkline.jsx'

const BAND = 2

function averageTemp(snapshot) {
  const nodes = [snapshot.general, ...snapshot.workers]
  return nodes.reduce((acc, node) => acc + node.currentTemp, 0) / nodes.length
}

export function EfficiencyPanel({ snapshot, samples, inference }) {
  const series = useMemo(
    () => samples.slice(-120).map((sample) => averageTemp(sample)),
    [samples],
  )
  const poolSeries = useMemo(
    () => samples.slice(-120).map((sample) => sample.pendingQueue.size),
    [samples],
  )

  if (!snapshot) {
    return <div className="hint">Esperando datos del simulador…</div>
  }

  const nodes = [snapshot.general, ...snapshot.workers]
  const inBand = nodes.filter((node) => Math.abs(node.currentTemp - node.targetTemp) <= BAND).length
  const meanDeviation =
    nodes.reduce((acc, node) => acc + Math.abs(node.currentTemp - node.targetTemp), 0) /
    nodes.length
  const fansOn = nodes.filter((node) => node.fanActive).length
  const meanLoad = nodes.reduce((acc, node) => acc + node.workload, 0) / nodes.length
  const inBandPct = Math.round((100 * inBand) / nodes.length)

  const validSamples = samples.filter((sample) => sample !== undefined && sample !== null)
  let sessionInBand = null
  if (validSamples.length > 0) {
    const inside = validSamples.filter(
      (sample) => Math.abs(averageTemp(sample) - sample.targetTemp) <= BAND,
    ).length
    sessionInBand = Math.round((100 * inside) / validSamples.length)
  }

  const targets = new Map(nodes.map((node) => [node.id, node.targetTemp]))
  const predictions = Object.values(inference)
  const rising = predictions.filter((prediction) => {
    const target = targets.get(prediction.nodeId)
    return target !== undefined && prediction.predictedTemp - target > 1
  }).length
  const falling = predictions.filter((prediction) => {
    const target = targets.get(prediction.nodeId)
    return target !== undefined && prediction.predictedTemp - target < -1
  }).length

  return (
    <div>
      <div className="detail__grid">
        <div className="detail__metric">
          <div>en banda (±2 °C)</div>
          <div>
            {inBand}/{nodes.length}
          </div>
          <div className="detail__bar">
            <span style={{ width: `${inBandPct}%` }} />
          </div>
        </div>
        <div className="detail__metric">
          <div>desvío medio</div>
          <div>{meanDeviation.toFixed(2)}°</div>
        </div>
        <div className="detail__metric">
          <div>sesión en banda</div>
          <div>{sessionInBand === null ? '—' : `${sessionInBand}%`}</div>
        </div>
        <div className="detail__metric">
          <div>ventiladores</div>
          <div>
            {fansOn}/{nodes.length}
          </div>
        </div>
        <div className="detail__metric">
          <div>carga media</div>
          <div>{meanLoad.toFixed(2)}</div>
        </div>
        <div className="detail__metric">
          <div>pool pendiente</div>
          <div>
            {snapshot.pendingQueue.size}/{snapshot.pendingQueue.capacity}
          </div>
        </div>
      </div>

      <div className="hint">
        {predictions.length === 0
          ? 'Modelo IA: sin predicciones todavía.'
          : `Modelo IA: ${rising} nodo(s) prevén subida y ${falling} prevén bajada sobre el objetivo.`}
      </div>

      {series.length >= 2 && (
        <div style={{ marginTop: 10 }}>
          <div className="hint" style={{ marginBottom: 4 }}>
            Temperatura media (sesión)
          </div>
          <Sparkline values={series} target={snapshot.targetTemp} color="#38bdf8" />
          <div className="hint" style={{ margin: '10px 0 4px' }}>
            Tareas en pool (sesión)
          </div>
          <Sparkline values={poolSeries} color="#f59e0b" />
        </div>
      )}
    </div>
  )
}
