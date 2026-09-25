import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const socket = io()

async function getJson(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json()
}

const jsonBody = (body) => ({
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export function useSimulation() {
  const [snapshot, setSnapshot] = useState(null)
  const [status, setStatus] = useState(null)
  const [connected, setConnected] = useState(socket.connected)
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onState = (packet) => setSnapshot(packet.payload)
    const onAlert = (packet) =>
      setAlerts((prev) => [packet.payload, ...prev].slice(0, 20))

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('state:update', onState)
    socket.on('alert', onAlert)

    getJson('/api/system').then((data) => setSnapshot(data.system)).catch(() => {})
    getJson('/api/sim/status').then(setStatus).catch(() => {})

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('state:update', onState)
      socket.off('alert', onAlert)
    }
  }, [])

  const api = {
    pause: () => getJson('/api/sim/pause', { method: 'POST' }),
    resume: () => getJson('/api/sim/resume', { method: 'POST' }),
    reset: () => getJson('/api/sim/reset', { method: 'POST' }),
    patchSystem: (body) => getJson('/api/system', jsonBody(body)),
    patchNode: (id, body) => getJson(`/api/nodes/${id}`, jsonBody(body)),
    enqueue: (id, body) =>
      getJson(`/api/nodes/${id}/queue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  }

  return { snapshot, status, connected, alerts, api }
}