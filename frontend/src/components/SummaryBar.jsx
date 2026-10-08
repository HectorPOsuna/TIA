export function SummaryBar({ summary, targetTemp, ambientTemp }) {
  if (!summary) return null
  const items = [
    { label: 'Nodos', value: summary.totalWorkers, tone: '' },
    { label: 'Activos', value: summary.activeWorkers, tone: 'badge--ok' },
    { label: 'Inactivos', value: summary.inactiveWorkers, tone: '' },
    {
      label: 'En error',
      value: summary.errorWorkers,
      tone: summary.errorWorkers > 0 ? 'badge--danger' : '',
    },
    { label: 'Temp media', value: `${summary.averageTemp.toFixed(1)}°`, tone: '' },
    { label: 'Objetivo', value: `${targetTemp.toFixed(1)}°`, tone: '' },
    { label: 'Ambiente', value: `${ambientTemp.toFixed(1)}°`, tone: '' },
  ]
  return (
    <div className="summary">
      {items.map((item) => (
        <span key={item.label} className={`chip ${item.tone}`}>
          {item.label} <strong>{item.value}</strong>
        </span>
      ))}
    </div>
  )
}