export function Legend({ lo, hi }) {
  return (
    <div className="legend">
      <span className="legend__label">Temp mapa</span>
      <div className="legend__bar" />
      <div className="legend__ticks">
        <div>{hi.toFixed(0)}°</div>
        <div>{lo.toFixed(0)}°</div>
      </div>
    </div>
  )
}