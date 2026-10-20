import { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const socket = io()
const FLUSH_MS = 250

export function useInference() {
  const [latest, setLatest] = useState({})
  const [stats, setStats] = useState({ count: 0, lastAt: null })
  const [version, setVersion] = useState(null)
  const [meta, setMeta] = useState(null)
  const [enabled, setEnabled] = useState(null)
  const pending = useRef({})
  const timer = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/inference/version')
      if (!res.ok) {
        setEnabled(false)
        return
      }
      const data = await res.json()
      setVersion(data.version ?? 'unknown')
      setMeta(data.meta ?? null)
      setEnabled(true)
    } catch {
      setEnabled(false)
    }
  }, [])

  useEffect(() => {
    const flush = () => {
      timer.current = null
      const batch = pending.current
      pending.current = {}
      const size = Object.keys(batch).length
      if (size === 0) return
      setLatest((prev) => ({ ...prev, ...batch }))
      setStats((prev) => ({ count: prev.count + size, lastAt: Date.now() }))
    }

    const onInference = (packet) => {
      pending.current[packet.payload.nodeId] = packet.payload
      if (timer.current === null) {
        timer.current = setTimeout(flush, FLUSH_MS)
      }
    }

    const onConnect = () => {
      void refresh()
    }

    socket.on('inference:completed', onInference)
    socket.on('connect', onConnect)
    return () => {
      socket.off('inference:completed', onInference)
      socket.off('connect', onConnect)
      if (timer.current !== null) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    fetch('/api/inference/version')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data === null) {
          setEnabled(false)
          return
        }
        setVersion(data.version ?? 'unknown')
        setMeta(data.meta ?? null)
        setEnabled(true)
      })
      .catch(() => {
        if (!cancelled) setEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { latest, stats, version, meta, enabled, refresh }
}
