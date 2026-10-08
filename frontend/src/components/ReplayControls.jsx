import { useEffect, useState } from 'react'

export function ReplayControls({ samples, replayIndex, isReplay, onGo, onLive, onStep }) {
  const [playing, setPlaying] = useState(false)
  const count = samples.length
  const maxIdx = count - 1
  const current = replayIndex < 0 ? maxIdx : replayIndex
  const currentTs =
    replayIndex >= 0 && samples[replayIndex]
      ? samples[replayIndex].ts
      : count > 0
        ? samples[maxIdx].ts
        : null

  useEffect(() => {
    if (!playing || count === 0 || replayIndex >= maxIdx) return undefined
    const id = setInterval(() => onStep(1), 600)
    return () => clearInterval(id)
  }, [playing, count, replayIndex, maxIdx, onStep])

  return (
    <div className="replay">
      {!isReplay ? (
        <span className="replay__meta replay__live">● vivo</span>
      ) : (
        <span className="replay__meta replay__back">
          ◀ replay {replayIndex + 1}/{count}
        </span>
      )}
      <input
        className="replay__range"
        type="range"
        min={0}
        max={Math.max(0, maxIdx)}
        value={Math.max(0, current)}
        onChange={(e) => onGo(Number(e.target.value))}
        disabled={count < 2}
        aria-label="Línea de tiempo de la sesión"
      />
      <span className="replay__meta">{currentTs ? new Date(currentTs).toLocaleTimeString('es') : '—'}</span>
      <button type="button" className="btn btn--sm" onClick={() => onStep(-1)} disabled={count < 2}>
        ◀
      </button>
      <button
        type="button"
        className="btn btn--sm"
        onClick={() => setPlaying((p) => !p)}
        disabled={count < 2}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <button
        type="button"
        className="btn btn--sm btn--primary"
        onClick={() => {
          setPlaying(false)
          onLive()
        }}
      >
        Vivo
      </button>
    </div>
  )
}