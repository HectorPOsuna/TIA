const STOPS = [
  [0.0, [37, 99, 235]],
  [0.35, [34, 211, 238]],
  [0.6, [250, 204, 21]],
  [0.8, [249, 115, 22]],
  [1.0, [239, 68, 68]],
]

function lerp(a, b, t) {
  return a + (b - a) * t
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

export function heatColor(t) {
  const value = clamp01(t)
  for (let i = 1; i < STOPS.length; i += 1) {
    const [t0, c0] = STOPS[i - 1]
    const [t1, c1] = STOPS[i]
    if (value <= t1) {
      const k = (value - t0) / (t1 - t0 || 1)
      const r = Math.round(lerp(c0[0], c1[0], k))
      const g = Math.round(lerp(c0[1], c1[1], k))
      const b = Math.round(lerp(c0[2], c1[2], k))
      return `rgb(${r}, ${g}, ${b})`
    }
  }
  const last = STOPS[STOPS.length - 1][1]
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`
}

export function tempBand(value, lo, hi) {
  if (hi <= lo) return 0.5
  return clamp01((value - lo) / (hi - lo))
}