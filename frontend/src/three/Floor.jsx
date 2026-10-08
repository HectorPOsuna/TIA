export function Floor() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0a0f1c" roughness={1} metalness={0} />
      </mesh>
      <gridHelper args={[60, 26, '#1d2f50', '#0f1b30']} position={[0, 0.005, 0]} />
    </group>
  )
}