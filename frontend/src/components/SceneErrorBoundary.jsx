import { Component } from 'react'
import { Icon } from './Icon.jsx'

export class SceneErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="scene-fallback" role="alert">
          <Icon name="alert" size={26} />
          <strong>La escena 3D no está disponible.</strong>
          <span>Puedes seguir usando la lista de nodos y el panel de detalle.</span>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => this.setState({ failed: false })}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
