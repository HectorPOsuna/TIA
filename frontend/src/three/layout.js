const CELL_W = 3.0
const CELL_H = 3.0
const GENERAL_BACK = 2.3
const TILE_HALF = 1.05
const FRAME_MARGIN = 0.9

export const FOV_DEG = 42

export function computeLayout(workerIds, generalId, portrait = false) {
  const ids = [...workerIds].sort()
  const n = ids.length
  const columns = portrait ? 1 : Math.max(1, Math.ceil(Math.sqrt(n)))
  const rows = Math.max(1, Math.ceil(n / columns))
  const startX = ((columns - 1) * -CELL_W) / 2
  const startZ = ((rows - 1) * CELL_H) / 2
  const positionsBy = {}
  ids.forEach((id, i) => {
    const col = i % columns
    const row = Math.floor(i / columns)
    positionsBy[id] = { x: startX + col * CELL_W, z: startZ - row * CELL_H }
  })
  const generalZ = startZ + CELL_H * 0.6 + GENERAL_BACK
  positionsBy[generalId] = { x: 0, z: generalZ }

  const values = Object.values(positionsBy)
  const xs = values.map((position) => position.x)
  const zs = values.map((position) => position.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 }
  const halfWidth = (maxX - minX) / 2 + TILE_HALF
  const halfDepth = (maxZ - minZ) / 2 + TILE_HALF

  return { positionsBy, center, halfWidth, halfDepth }
}

export function cameraDistance(halfWidth, halfDepth, aspect = 1) {
  const halfV = (FOV_DEG * Math.PI) / 360
  const halfH = Math.atan(Math.tan(halfV) * Math.max(aspect, 0.4))
  const horizontal = (halfWidth + FRAME_MARGIN) / Math.tan(halfH)
  const vertical = (halfDepth + FRAME_MARGIN) / Math.tan(halfV)
  return Math.max(horizontal, vertical)
}
