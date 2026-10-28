import { Icon } from './Icon.jsx'

export function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.level === 'warning' ? 'toast--warn' : ''}`}
        >
          <Icon name="alert" size={18} className="toast__icon" />
          <div className="toast__body">
            <strong>{toast.nodeId ?? 'Sistema'}</strong>
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={() => onDismiss(toast.id)}
            aria-label="Cerrar alerta"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
