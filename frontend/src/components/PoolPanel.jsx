import { TaskForm } from './TaskForm.jsx'

export function PoolPanel({ pool, api }) {
  if (!pool) return null
  return (
    <div>
      <div className="row">
        <div>Pendientes</div>
        <span className="mono">
          {pool.size}/{pool.capacity}
        </span>
      </div>

      <TaskForm
        submitLabel="Encolar al pool"
        defaults={{ priority: 5, demand: 3 }}
        onSubmit={(p) =>
          api.submitTask({
            type: 'custom',
            description: 'Tarea manual al pool',
            priority: p.priority,
            computeDemand: p.demand,
            durationSecs: p.duration,
          })
        }
      />

      {pool.size > 0 && (
        <button
          type="button"
          className="btn btn--sm btn--danger"
          style={{ marginTop: 8 }}
          onClick={() => api.clearPool()}
        >
          Vaciar pool
        </button>
      )}

      <ul className="list" style={{ marginTop: 8 }}>
        {pool.list.slice(0, 12).map((t) => (
          <li key={t.id} className="list__item mono" style={{ fontSize: 12 }}>
            <strong>p{t.priority}</strong>
            <span className="dim">[{t.description ?? t.type}]</span>
            <span className="dim">
              demanda {t.computeDemand} · {t.durationSecs}s
            </span>
          </li>
        ))}
        {pool.size === 0 && <li className="list__empty">Sin tareas pendientes</li>}
      </ul>
    </div>
  )
}