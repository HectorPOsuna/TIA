export const TUTORIAL_STORAGE_KEY = 'waitt-tutorial'

export const DEFAULT_PROGRESS = { index: 0, visible: true, explored: [] }

export function clampIndex(index, total) {
  if (total <= 0 || !Number.isInteger(index)) return 0
  return Math.min(Math.max(index, 0), total - 1)
}

export function parseProgress(raw, total, validIds = []) {
  if (typeof raw !== 'string') return { ...DEFAULT_PROGRESS, explored: [] }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_PROGRESS, explored: [] }
  }
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PROGRESS, explored: [] }
  const inRange = Number.isInteger(parsed.index) && parsed.index >= 0 && parsed.index < total
  const valid = new Set(validIds)
  const explored = Array.isArray(parsed.explored)
    ? [...new Set(parsed.explored.filter((id) => typeof id === 'string' && valid.has(id)))]
    : []
  return {
    index: inRange ? parsed.index : 0,
    visible: typeof parsed.visible === 'boolean' ? parsed.visible : true,
    explored,
  }
}

export function nextIndex(index, total) {
  return clampIndex(index + 1, total)
}

export function previousIndex(index, total) {
  return clampIndex(index - 1, total)
}

export function reset() {
  return { index: 0, visible: true, explored: [] }
}

export function toggle(progress) {
  return { ...progress, visible: !progress.visible }
}

export function markExplored(progress, id) {
  if (progress.explored.includes(id)) return progress
  return { ...progress, explored: [...progress.explored, id] }
}

export function serializeProgress(progress) {
  return JSON.stringify({
    index: progress.index,
    visible: progress.visible,
    explored: progress.explored,
  })
}

export function readProgress(storage, total, validIds) {
  try {
    return parseProgress(storage?.getItem(TUTORIAL_STORAGE_KEY), total, validIds)
  } catch {
    return { ...reset() }
  }
}

export function writeProgress(storage, progress) {
  try {
    storage?.setItem(TUTORIAL_STORAGE_KEY, serializeProgress(progress))
  } catch {
    return
  }
}
