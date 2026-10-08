export function Sparkline({ values, target, color = '#22d3ee', height = 44 }) {
  if (!values || values.length < 2) return null
  const width = 640
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const range = hi - lo || 1
  const x = (i) => (i / (values.length - 1)) * width
  const y = (v) => height - ((v - lo) / range) * (height - 6) - 3
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ty = target != null ? y(Math.min(hi, Math.max(lo, target))) : null

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
    </svg>
  )
}