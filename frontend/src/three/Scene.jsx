import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { Floor } from './Floor.jsx'
import { NodeTile } from './NodeTile.jsx'
import { computeLayout, cameraDistance, FOV_DEG } from './layout.js'
import { tempBand } from './heatmap.js'
import { scenePalette } from './theme.js'

function CameraRig({ center, halfWidth, halfDepth }) {
  const { camera, size } = useThree()
  const aspect = size.width / Math.max(1, size.height)
  const distance = cameraDistance(halfWidth, halfDepth, aspect)

  useEffect(() => {
    camera.position.set(center.x, distance, center.z + distance * 0.82)
  }, [camera, center.x, center.z, distance])

  return null
}

export function Scene({
  snapshot,
  bandLo,
  bandHi,
  selectedId,
  onSelect,
  reducedMotion = false,
  theme = 'dark',
}) {
  const palette = scenePalette(theme)
  const nodes = [snapshot.general, ...snapshot.workers]
  const portrait = window.innerWidth < window.innerHeight
  const { positionsBy, center, halfWidth, halfDepth } = computeLayout(
    snapshot.workers.map((n) => n.id),
    snapshot.general.id,
    portrait,
  )

  return (
    <Canvas
      camera={{ position: [0, 13, 11], fov: FOV_DEG, near: 0.5, far: 400 }}
      dpr={[1, 1.75]}
    >
      <CameraRig center={center} halfWidth={halfWidth} halfDepth={halfDepth} />
      <color attach="background" args={[palette.background]} />
      <ambientLight intensity={palette.ambient} />
      <directionalLight position={[8, 14, 6]} intensity={palette.key} />
      <directionalLight
        position={[-9, 8, -7]}
        intensity={palette.rim}
        color={palette.rimColor}
      />
      <Floor palette={palette} />
      {nodes.map((node) => (
        <NodeTile
          key={node.id}
          node={node}
          position={positionsBy[node.id]}
          heat={tempBand(node.currentTemp, bandLo, bandHi)}
          selected={selectedId === node.id}
          onSelect={onSelect}
          reducedMotion={reducedMotion}
          palette={palette}
        />
      ))}
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={palette.shadowOpacity}
        scale={90}
        blur={2.5}
        far={7}
        color={palette.shadowColor}
      />
      <OrbitControls
        makeDefault
        target={[center.x, 0, center.z]}
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