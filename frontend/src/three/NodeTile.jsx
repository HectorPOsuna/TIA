import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { NodeLabel } from './NodeLabel.jsx'
import { heatColor } from './heatmap.js'

const FAN_SPIN = 6
const ERROR_PULSE = 4.5

function FanDisc({ y }) {
  const blade = useRef(null)
  useFrame((_, dt) => {
    if (blade.current) blade.current.rotation.z += dt * FAN_SPIN
  })
  return (
    <group rotation-x={-Math.PI / 2} position={[0, y, 0]}>
      <mesh ref={blade}>
        <cylinderGeometry args={[0.78, 0.78, 0.035, 32]} />
        <meshStandardMaterial
          color="#0e7490"
          emissive="#22d3ee"
          emissiveIntensity={0.85}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>
      <mesh rotation-z={Math.PI / 4}>
        <planeGeometry args={[0.3, 1.2]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.45} />
      </mesh>
    </group>
  )
}

function SelectionRing({ active }) {
  const ref = useRef(null)
  useFrame((state) => {
    if (ref.current && ref.current.material) {
      ref.current.material.opacity = active
        ? 0.5 + 0.35 * Math.sin(state.clock.elapsedTime * 4)
        : 0
    }
  })
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[0, 0.025, 0]}>
      <ringGeometry args={[1.15, 1.45, 48]} />
      <meshBasicMaterial color="#38bdf8" transparent side={2} />
    </mesh>
  )
}

const STATUS_COLORS = { active: null, inactive: '#33415c', error: '#6b2f2f' }

export function NodeTile({ node, position, heat, selected, onSelect }) {
  const group = useRef(null)
  const mat = useRef(null)
  const [hovered, setHovered] = useState(false)

  const status = node.status
  const isGeneral = node.type === 'general'
  const size = isGeneral ? 2.1 : 1.7
  const height =
    status === 'inactive' ? 0.6 : 0.45 + heat * 1.6 + (isGeneral ? 0.35 : 0)
  const baseColor = STATUS_COLORS[status] ?? heatColor(heat)
  const glowColor =
    status === 'error'
      ? '#f87171'
      : status === 'inactive'
        ? '#1e3a5f'
        : heatColor(heat)

  useFrame((state) => {
    const g = group.current
    const m = mat.current
    if (!g || !m) return
    const target = hovered || selected ? 1.05 : 1
    g.scale.set(target, target, target)
    const t = state.clock.elapsedTime
    if (status === 'error') {
      m.emissiveIntensity = 0.5 + 0.5 * Math.sin(t * ERROR_PULSE)
    } else if (node.fanActive) {
      m.emissiveIntensity = 0.35 + 0.25 * Math.sin(t * 6)
    } else {
      m.emissiveIntensity = status === 'inactive' ? 0.03 : 0.12 + heat * 0.35
    }
  })

  return (
    <group ref={group} position={[position.x, 0, position.z]}>
      <RoundedBox
        args={[size, height, size]}
        radius={0.16}
        smoothness={4}
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
          ref={mat}
          color={baseColor}
          metalness={0.55}
          roughness={0.32}
          emissive={glowColor}
          emissiveIntensity={0.15}
        />
      </RoundedBox>
      {node.fanActive && <FanDisc y={height + 0.05} />}
      <SelectionRing active={selected} />
      <NodeLabel
        name={node.name}
        temp={node.currentTemp}
        fan={node.fanActive}
        queue={node.queue.size}
        stack={node.stack.size}
        height={height}
        selected={selected}
      />
    </group>
  )
}