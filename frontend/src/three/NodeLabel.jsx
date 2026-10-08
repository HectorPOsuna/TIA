import { Html } from '@react-three/drei'

export function NodeLabel({ name, temp, fan, queue, stack, height, selected }) {
  const chips = [
    fan ? <span key="fan" className="node-label__chip node-label__chip--info">fan</span> : null,
    <span key="queue" className="node-label__chip">{queue}</span>,
    <span key="stack" className="node-label__chip node-label__chip--warn">{stack}</span>,
  ]
  return (
    <Html
      position={[0, height + 0.42, 0]}
      center
      distanceFactor={9}
      zIndexRange={[5, 0]}
      className="node-label"
      style={{ opacity: selected ? 1 : 0.85 }}
    >
      <div className="node-label__name">{name}</div>
      <div className="node-label__temp">{temp.toFixed(1)}°</div>
      <div className="node-label__chips">{chips}</div>
    </Html>
  )
}