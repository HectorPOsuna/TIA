import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const socket = io()

async function getJson(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json()
}

export function useRules() {
  const [rules, setRules] = useState([])
  const [triggered, setTriggered] = useState([])

  const refresh = useCallback(() => {
    getJson('/api/rules').then((data) => setRules(data.rules)).catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    const onTrigger = (packet) => {
      setTriggered((prev) => [packet.payload, ...prev].slice(0, 10))
      refresh()
    }
    socket.on('rule:triggered', onTrigger)
    return () => {
      socket.off('rule:triggered', onTrigger)
    }
  }, [refresh])

  const api = {
    refresh,
    toggle: (id, enabled) =>
      getJson(`/api/rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      }).then(() => refresh()),
    remove: (id) =>
      fetch(`/api/rules/${id}`, { method: 'DELETE' }).then(() => refresh()),
  }

  return { rules, triggered, api }
}