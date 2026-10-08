export function Header({
  connected,
  running,
  isReplay,
  target,
  onTarget,
  onApplyTarget,
  onToggleRunning,
  onReset,
}) {
  return (
    <header className="topbar">
      <div>
        <div className="brand__title">
          WAItt <span>CONTROL</span>
        </div>
        <div className="brand__sub">simulador térmico · vista cenital</div>
      </div>
      {isReplay && <span className="badge badge--warn">replay</span>}
      <span className={`badge ${connected ? 'badge--ok' : 'badge--danger'}`}>
        {connected ? 'conectado' : 'sin conexión'}
      </span>
      <span className={`badge ${running ? 'badge--info' : 'badge--muted'}`}>
        {running ? 'en ejecución' : 'pausado'}
      </span>
      <div className="topbar__right">
        <label className="field form-inline">
          <span>Objetivo global</span>
          <input
            type="number"
            value={target}
            placeholder="30"
            onChange={(e) => onTarget(e.target.value)}
          />
        </label>
        <button type="button" className="btn btn--primary btn--sm" onClick={onApplyTarget}>
          Aplicar
        </button>
        <button type="button" className="btn btn--sm" onClick={onToggleRunning}>
          {running ? 'Pausar' : 'Reanudar'}
        </button>
        <button type="button" className="btn btn--sm btn--danger" onClick={onReset}>
          Reset
        </button>
      </div>
    </header>
  )
}