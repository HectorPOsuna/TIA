export function Sparkline({ values, target, marker, color = '#22d3ee', height = 44 }) {
  if (!values || values.length < 2) return null
  const width = 640
  const span = marker != null && Number.isFinite(marker) ? [...values, marker] : values
  const lo = Math.min(...span)
  const hi = Math.max(...span)
  const range = hi - lo || 1
  const x = (i) => (i / (values.length - 1)) * width
  const y = (v) => height - ((v - lo) / range) * (height - 6) - 3
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ty = target != null ? y(Math.min(hi, Math.max(lo, target))) : null
  const my = marker != null && Number.isFinite(marker) ? y(marker) : null

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
    >
      <polyline points={points} style={{ stroke: color }} />
      {ty != null && (
        <line
          x1="0"
          y1={ty}
          x2={width}
          y2={ty}
          stroke="#7c879e"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      )}
      {my != null && (
        <>
          <line
            x1={width - 12}
            y1={my}
            x2={width}
            y2={my}
            stroke="#c084fc"
            strokeWidth="2"
            strokeDasharray="2 2"
          />
          <circle cx={width - 6} cy={my} r="3.5" fill="#c084fc" />
        </>
      )}
    </svg>
  )
}