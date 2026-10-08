export function AlertsPanel({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return <div className="hint">Sin alertas</div>
  }
  return (
    <ul className="list">
      {alerts.map((alert, i) => (
        <li
          key={i}
          className={`alert-item ${alert.level === 'warning' ? 'alert-item--warn' : ''}`}
        >
          <span className="alert-item__time">
            {new Date(alert.at ?? alert.ts).toLocaleTimeString('es')}
          </span>
          <span className="alert-item__msg">
            {alert.nodeId ? `${alert.nodeId}: ` : ''}
            {alert.message}
          </span>
        </li>
      ))}
    </ul>
  )
}