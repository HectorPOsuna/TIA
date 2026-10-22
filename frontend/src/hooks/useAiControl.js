import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const socket = io()
const MAX_RECENT = 20

const emptyStatus = {
  available: false,
  enabled: false,
  policy: {},
  stats: { actions: 0, actionsLastMinute: 0, lastActionAt: null },
  nodes: [],
  recent: [],
}

export function useAiControl() {
  const [status, setStatus] = useState(null)
  const [recent, setRecent] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/control')
      if (!res.ok) {
        setStatus(emptyStatus)
        return
      }
      const data = await res.json()
      setStatus(data)
      setRecent(data.recent ?? [])
      setError(null)
    } catch {
      setStatus(emptyStatus)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/ai/control')
      .then((res) => (res.ok ? res.json() : emptyStatus))
      .then((data) => {
        if (cancelled) return
        setStatus(data)
        setRecent(data.recent ?? [])
      })
      .catch(() => {
        if (!cancelled) setStatus(emptyStatus)
      })

    const onAction = (packet) => {
      const payload = packet.payload
      setRecent((prev) => [payload, ...prev].slice(0, MAX_RECENT))
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              stats: {
                ...prev.stats,
                actions: prev.stats.actions + 1,
                actionsLastMinute: prev.stats.actionsLastMinute + 1,
                lastActionAt: payload.at,
              },
            }
          : prev,
      )
    }
    const onConnect = () => {
      void refresh()
    }
    socket.on('ai:action', onAction)
    socket.on('connect', onConnect)
    return () => {
      cancelled = true
      socket.off('ai:action', onAction)
      socket.off('connect', onConnect)
    }
  }, [refresh])

  const update = useCallback(async (patch) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/control', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'no se pudo actualizar el control de IA')
      }
      setStatus(data)
      setRecent(data.recent ?? [])
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  return {
    status,
    recent,
    error,
    busy,
    refresh,
    setEnabled: (enabled) => update({ enabled }),
    setPolicy: (policy) => update({ policy }),
  }
}
