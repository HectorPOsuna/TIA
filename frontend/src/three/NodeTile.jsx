import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { NodeLabel } from './NodeLabel.jsx'
import { heatColor } from './heatmap.js'

const FAN_SPIN = 6
const ERROR_PULSE = 4.5
const PLINTH_HEIGHT = 0.12

function FanAssembly({ y, radius, active, reducedMotion, palette }) {
  const blades = useRef(null)
  useFrame((_, dt) => {
    if (blades.current && active && !reducedMotion) blades.current.rotation.y += dt * FAN_SPIN
  })
  return (
    <group position={[0, y, 0]}>
      <mesh rotation-x={-Math.PI / 2}>
        <torusGeometry args={[radius, 0.025, 8, 32]} />
        <meshStandardMaterial color={palette.bezel} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <cylinderGeometry args={[radius * 0.92, radius * 0.92, 0.02, 32]} />
        <meshStandardMaterial color={palette.vent} metalness={0.4} roughness={0.5} />
      </mesh>
      <group ref={blades} position={[0, 0.025, 0]}>
        {[0, Math.PI / 3, (2 * Math.PI) / 3].map((angle) => (
          <mesh key={angle} rotation-y={angle}>
            <boxGeometry args={[radius * 1.55, 0.012, 0.07]} />
            <meshStandardMaterial
              color={active ? palette.fanBlade : palette.fan}
              emissive={palette.fanBlade}
              emissiveIntensity={active ? 0.55 : 0.08}
              metalness={0.5}
              roughness={0.35}
            />
          </mesh>
        ))}
        <mesh>
          <cylinderGeometry args={[radius * 0.16, radius * 0.16, 0.04, 16]} />
          <meshStandardMaterial color={palette.bezel} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

function SelectionRing({ active, reducedMotion, size, palette }) {
  const ref = useRef(null)
  useFrame((state) => {
    if (!ref.current || !ref.current.material) return
    ref.current.material.opacity = active
      ? reducedMotion
        ? 0.75
        : 0.6 + 0.3 * Math.sin(state.clock.elapsedTime * 4)
      : 0
  })
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
      <ringGeometry args={[size * 0.8, size * 0.9, 48]} />
      <meshBasicMaterial color={palette.ring} transparent side={2} toneMapped={false} />
    </mesh>
  )
}

export function NodeTile({
  node,
  position,
  heat,
  selected,
  onSelect,
  reducedMotion = false,
  palette,
}) {
  const group = useRef(null)
  const panelMat = useRef(null)
  const ledMatA = useRef(null)
  const ledMatB = useRef(null)
  const halo = useRef(null)
  const [hovered, setHovered] = useState(false)

  const status = node.status
  const isGeneral = node.type === 'general'
  const size = isGeneral ? 2.1 : 1.7
  const bodyHeight =
    status === 'inactive' ? 0.6 : 0.45 + heat * 1.6 + (isGeneral ? 0.35 : 0)
  const bodyY = PLINTH_HEIGHT + bodyHeight / 2
  const topY = PLINTH_HEIGHT + bodyHeight
  const panelHeight = Math.max(0.32, bodyHeight * 0.72)
  const panelWidth = size * 0.82
  const panelZ = size / 2 + 0.06
  const slotCount = isGeneral ? 6 : 4
  const slotGap = panelHeight / (slotCount + 1)
  const slotWidth = size * 0.56
  const ledX = panelWidth / 2 - 0.06
  const ledHeight = panelHeight * 0.8
  const fanActive = node.fanActive && status !== 'inactive'

  const ledColor =
    status === 'error'
      ? palette.ledError
      : status === 'inactive'
        ? palette.ledInactive
        : palette.ledActive
  const panelEmissive = status === 'error' ? palette.ledError : heatColor(heat)
  const haloColor = status === 'error' ? palette.ledError : heatColor(heat)

  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.scale.setScalar(hovered || selected ? 1.045 : 1)
    const t = state.clock.elapsedTime
    const scale = palette.emissiveScale
    let panelGlow
    let ledGlow
    let haloIntensity = 0
    if (status === 'inactive') {
      panelGlow = 0
      ledGlow = 0.12
    } else if (status === 'error') {
      const pulse = reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(t * ERROR_PULSE)
      panelGlow = (0.35 + 0.55 * pulse) * scale
      ledGlow = (0.7 + 0.5 * pulse) * scale
      haloIntensity = 0.5 + 0.8 * pulse
    } else {
      const fanPulse = fanActive && !reducedMotion ? 0.12 * Math.sin(t * 6) : 0
      panelGlow = (0.32 + heat * 0.6 + fanPulse) * scale
      ledGlow = 0.9 * scale
      haloIntensity = 0.35 + heat * 0.9
    }
    if (panelMat.current) panelMat.current.emissiveIntensity = panelGlow
    if (ledMatA.current) ledMatA.current.emissiveIntensity = ledGlow
    if (ledMatB.current) ledMatB.current.emissiveIntensity = ledGlow
    if (halo.current) halo.current.intensity = haloIntensity
  })

  return (
    <group ref={group} position={[position.x, 0, position.z]}>
      <RoundedBox
        args={[size * 1.08, PLINTH_HEIGHT, size * 1.08]}
        radius={0.04}
        smoothness={3}
        position={[0, PLINTH_HEIGHT / 2, 0]}
      >
        <meshStandardMaterial color={palette.plinth} metalness={0.5} roughness={0.55} />
      </RoundedBox>

      <RoundedBox
        args={[size, bodyHeight, size]}
        radius={0.12}
        smoothness={4}
        position={[0, bodyY, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect(node.id)
        }}
      >
        <meshStandardMaterial
          color={palette.chassis}
          metalness={palette.chassisMetalness}
          roughness={palette.chassisRoughness}
        />
      </RoundedBox>

      <mesh position={[0, bodyY, size / 2 + 0.025]}>
        <boxGeometry args={[panelWidth + 0.1, panelHeight + 0.1, 0.05]} />
        <meshStandardMaterial color={palette.bezel} metalness={0.55} roughness={0.4} />
      </mesh>

      <mesh position={[0, bodyY, panelZ]}>
        <boxGeometry args={[panelWidth, panelHeight, 0.04]} />
        <meshStandardMaterial
          ref={panelMat}
          color={palette.panelBase}
          emissive={panelEmissive}
          emissiveIntensity={0.4}
          metalness={0.35}
          roughness={0.45}
        />
      </mesh>

      {Array.from({ length: slotCount }, (_, index) => (
        <mesh
          key={index}
          position={[
            0,
            bodyY - panelHeight / 2 + slotGap * (index + 1),
            panelZ + 0.03,
          ]}
        >
          <boxGeometry args={[slotWidth, 0.045, 0.02]} />
          <meshStandardMaterial color={palette.slot} roughness={0.9} metalness={0.1} />
        </mesh>
      ))}

      {(isGeneral ? [-ledX, ledX] : [ledX]).map((x, index) => (
        <mesh key={x} position={[x, bodyY, panelZ + 0.03]}>
          <boxGeometry args={[0.05, ledHeight, 0.02]} />
          <meshStandardMaterial
            ref={index === 0 ? ledMatA : ledMatB}
            color={ledColor}
            emissive={ledColor}
            emissiveIntensity={0.8}
            metalness={0.2}
            roughness={0.4}
          />
        </mesh>
      ))}

      <mesh position={[0, bodyY - panelHeight / 2 + 0.05, panelZ + 0.03]}>
        <boxGeometry args={[slotWidth, 0.04, 0.02]} />
        <meshStandardMaterial
          color={panelEmissive}
          emissive={panelEmissive}
          emissiveIntensity={status === 'inactive' ? 0 : 0.7}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>

      <RoundedBox
        args={[size * 0.94, 0.05, size * 0.94]}
        radius={0.02}
        smoothness={2}
        position={[0, topY + 0.025, 0]}
      >
        <meshStandardMaterial color={palette.topPlate} metalness={0.6} roughness={0.35} />
      </RoundedBox>

      <FanAssembly
        y={topY + 0.07}
        radius={size * 0.22}
        active={fanActive}
        reducedMotion={reducedMotion}
        palette={palette}
      />

      <pointLight
        ref={halo}
        position={[0, bodyY, size / 2 + 0.55]}
        color={haloColor}
        intensity={0}
        distance={3.6}
        decay={2}
      />

      <SelectionRing
        active={selected}
        reducedMotion={reducedMotion}
        size={size}
        palette={palette}
      />

      <NodeLabel
        name={node.name}
        temp={node.currentTemp}
        fan={node.fanActive}
        queue={node.queue.size}
        stack={node.stack.size}
        height={topY + 0.12}
        lift={isGeneral ? 1 : 0.7}
        selected={selected}
      />
    </group>
  )
}
