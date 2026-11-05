export function Floor({ palette }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={palette.floor} roughness={1} metalness={0} />
      </mesh>
      <gridHelper
        args={[60, 26, palette.gridMajor, palette.gridMinor]}
        position={[0, 0.005, 0]}
      />
    </group>
  )
}