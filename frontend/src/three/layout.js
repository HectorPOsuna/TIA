const CELL_W = 3.0
const CELL_H = 3.0
const GENERAL_BACK = 2.3

export function computeLayout(workerIds, generalId) {
  const ids = [...workerIds].sort()
  const n = ids.length
  const columns = Math.max(1, Math.ceil(Math.sqrt(n)))
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
  const maxSpan = Math.max((columns - 1) * CELL_W, (rows - 1) * CELL_H + GENERAL_BACK) + 0.8
  return { positionsBy, maxSpan }
}

export function cameraDistance(maxSpan) {
  return Math.max(7, maxSpan * 1.35)
}