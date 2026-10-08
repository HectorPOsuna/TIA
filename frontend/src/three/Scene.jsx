import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { Floor } from './Floor.jsx'
import { NodeTile } from './NodeTile.jsx'
import { computeLayout, cameraDistance } from './layout.js'
import { tempBand } from './heatmap.js'

export function Scene({ snapshot, bandLo, bandHi, selectedId, onSelect }) {
  const nodes = [snapshot.general, ...snapshot.workers]
  const { positionsBy, maxSpan } = computeLayout(
    snapshot.workers.map((n) => n.id),
    snapshot.general.id,
  )
  const d = cameraDistance(maxSpan)

  return (
    <Canvas
      camera={{ position: [0, d, d * 0.82], fov: 42, near: 0.5, far: 400 }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={['#0a0d14']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 14, 6]} intensity={1.0} />
      <directionalLight position={[-9, 8, -7]} intensity={0.35} color="#7dd3fc" />
      <Floor />
      {nodes.map((node) => (
        <NodeTile
          key={node.id}
          node={node}
          position={positionsBy[node.id]}
          heat={tempBand(node.currentTemp, bandLo, bandHi)}
          selected={selectedId === node.id}
          onSelect={onSelect}
        />
      ))}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.38} scale={90} blur={2.5} far={7} color="#000000" />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={5}
        maxDistance={70}
        minPolarAngle={0.12}
        maxPolarAngle={1.15}
      />
    </Canvas>
  )
}