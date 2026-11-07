import { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const socket = io()
const MAX_RECENT = 50

const emptyState = {
  generator: { enabled: false, intervalMs: 5000 },
  events: [],
  recent: [],
}

const keyOf = (payload) =>
  `${payload.eventId}|${payload.at}|${payload.source}|${payload.nodeId ?? ''}|${payload.message}`

const applyTriggered = (prev, payload) => {
  if (prev.recent.some((item) => keyOf(item) === keyOf(payload))) return prev
  return {
    ...prev,
    recent: [payload, ...prev.recent].slice(0, MAX_RECENT),
    events: prev.events.map((event) =>
      event.id === payload.eventId
        ? {
            ...event,
            lastTriggeredAt: payload.at,
            triggerCount: event.triggerCount + 1,
          }
        : event,
    ),
  }
}

export function useEvents() {
  const [state, setState] = useState(emptyState)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const mutationVersion = useRef(0)
  const refreshVersion = useRef(0)
  const pendingMutations = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++refreshVersion.current
    const version = mutationVersion.current
    const pending = pendingMutations.current
    try {
      const res = await fetch('/api/events')
      const data = res.ok ? await res.json() : emptyState
      if (
        requestId !== refreshVersion.current ||
        version !== mutationVersion.current ||
        pending !== pendingMutations.current ||
        pending > 0
      ) {
        return
      }
      setState(data)
      setError(null)
    } catch {
      if (
        requestId !== refreshVersion.current ||
        version !== mutationVersion.current ||
        pending !== pendingMutations.current ||
        pending > 0
      ) {
        return
      }
      setState(emptyState)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const requestId = ++refreshVersion.current
    const version = mutationVersion.current
    const pending = pendingMutations.current
    fetch('/api/events')
      .then((res) => (res.ok ? res.json() : emptyState))
      .then((data) => {
        if (
          cancelled ||
          requestId !== refreshVersion.current ||
          version !== mutationVersion.current ||
          pending !== pendingMutations.current ||
          pending > 0
        ) {
          return
        }
        setState(data)
      })
      .catch(() => {
        if (
          cancelled ||
          requestId !== refreshVersion.current ||
          version !== mutationVersion.current ||
          pending !== pendingMutations.current ||
          pending > 0
        ) {
          return
        }
        setState(emptyState)
      })

    const onTriggered = (packet) => {
      setState((prev) => applyTriggered(prev, packet.payload))
    }
    const onConnect = () => {
      void refresh()
    }
    socket.on('event:triggered', onTriggered)
    socket.on('connect', onConnect)
    return () => {
      cancelled = true
      socket.off('event:triggered', onTriggered)
      socket.off('connect', onConnect)
    }
  }, [refresh])

  const patchGenerator = useCallback(async (patch) => {
    mutationVersion.current += 1
    refreshVersion.current += 1
    pendingMutations.current += 1
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'no se pudo actualizar el generador')
      }
      setState(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      pendingMutations.current -= 1
      setBusy(false)
    }
  }, [])

  const patchEvent = useCallback(async (id, patch) => {
    mutationVersion.current += 1
    refreshVersion.current += 1
    pendingMutations.current += 1
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'no se pudo actualizar el evento')
      }
      setState((prev) => ({
        ...prev,
        events: prev.events.map((event) => (event.id === id ? data.event : event)),
      }))
      return data.event
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      pendingMutations.current -= 1
      setBusy(false)
    }
  }, [])

  const trigger = useCallback(async (id, body = {}) => {
    mutationVersion.current += 1
    refreshVersion.current += 1
    pendingMutations.current += 1
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/events/${id}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'no se pudo disparar el evento')
      }
      setState((prev) => applyTriggered(prev, data.event))
      return data.event
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      pendingMutations.current -= 1
      setBusy(false)
    }
  }, [])

  return { state, error, busy, refresh, patchGenerator, patchEvent, trigger }
}
