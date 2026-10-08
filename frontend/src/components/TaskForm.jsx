import { useState } from 'react'

const options = (n) => Array.from({ length: n }, (_, i) => i + 1)

export function TaskForm({ onSubmit, submitLabel, defaults = {} }) {
  const [priority, setPriority] = useState(defaults.priority ?? 3)
  const [demand, setDemand] = useState(defaults.demand ?? 1)
  const [duration, setDuration] = useState(defaults.duration ?? 8)

  return (
    <div className="task-form">
      <label className="field">
        <span>prioridad</span>
        <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
          {options(5).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>demanda</span>
        <select value={demand} onChange={(e) => setDemand(Number(e.target.value))}>
          {options(5).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>duración (s)</span>
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          {options(10).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn btn--primary btn--sm"
        onClick={() => onSubmit({ priority, demand, duration })}
      >
        {submitLabel}
      </button>
    </div>
  )
}