import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'

export function ReplayBar({ samples, replayIndex, isReplay, onGo, onLive, onStep }) {
  const [playing, setPlaying] = useState(false)
  const stateRef = useRef({ index: replayIndex, max: samples.length - 1 })
  const stepRef = useRef(onStep)
  const count = samples.length
  const maxIdx = count - 1
  const current = isReplay ? replayIndex : maxIdx
  const currentTs =
    current >= 0 && samples[current] ? samples[current].ts : count > 0 ? samples[maxIdx].ts : null

  useEffect(() => {
    stepRef.current = onStep
  }, [onStep])

  useEffect(() => {
    stateRef.current = { index: replayIndex, max: maxIdx }
  }, [replayIndex, maxIdx])

  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => {
      const { index, max } = stateRef.current
      if (index >= max) {
        setPlaying(false)
        return
      }
      stepRef.current(1)
    }, 600)
    return () => clearInterval(id)
  }, [playing])

  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (count < 2) return
    if (!isReplay || replayIndex >= maxIdx) onGo(0)
    setPlaying(true)
  }

  const goTo = (index) => {
    setPlaying(false)
    onGo(index)
  }

  const step = (delta) => {
    setPlaying(false)
    onStep(delta)
  }

  const goLive = () => {
    setPlaying(false)
    onLive()
  }

  return (
    <div className={`replay ${isReplay ? 'replay--back' : ''}`}>
      <span className="replay__state">
        <span className={`hud__dot ${isReplay ? 'is-warn' : 'is-on'}`} aria-hidden="true" />
        {isReplay ? 'replay' : 'vivo'}
      </span>

      <button
        type="button"
        className="icon-btn icon-btn--sm"
        onClick={() => step(-1)}
        disabled={count < 2}
        aria-label="Muestra anterior"
        title="Muestra anterior"
      >
        <Icon name="step-back" size={14} />
      </button>

      <button
        type="button"
        className="icon-btn icon-btn--sm"
        onClick={togglePlay}
        disabled={count < 2}
        aria-label={playing ? 'Pausar reproducción' : 'Reproducir historial'}
        title={playing ? 'Pausar reproducción' : 'Reproducir historial'}
      >
        <Icon name={playing ? 'pause' : 'play'} size={14} />
      </button>

      <button
        type="button"
        className="icon-btn icon-btn--sm"
        onClick={() => step(1)}
        disabled={!isReplay || replayIndex >= maxIdx}
        aria-label="Muestra siguiente"
        title="Muestra siguiente"
      >
        <Icon name="step-forward" size={14} />
      </button>

      <input
        className="replay__range"
        type="range"
        min={0}
        max={Math.max(0, maxIdx)}
        value={Math.max(0, current)}
        onChange={(event) => goTo(Number(event.target.value))}
        disabled={count < 2}
        aria-label="Posición del historial"
      />

      <span className="replay__time mono">
        {currentTs ? new Date(currentTs).toLocaleTimeString('es') : '—'}
      </span>

      {isReplay && (
        <button type="button" className="btn btn--sm replay__live-btn" onClick={goLive}>
          <Icon name="activity" size={14} />
          Vivo
        </button>
      )}
    </div>
  )
}
