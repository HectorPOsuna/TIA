import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const MAX_SAMPLES = 600

export function useHistory() {
  const [samples, setSamples] = useState([])
  const [replayIndex, setReplayIndex] = useState(-1)
  const lengthRef = useRef(0)
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = io()
    socketRef.current = socket
    const onState = (packet) => {
      setSamples((prev) => {
        const next = [...prev, packet.payload]
        return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next
      })
    }
    socket.on('state:update', onState)
    return () => {
      socket.off('state:update', onState)
      socketRef.current = null
    }
  }, [])

  useEffect(() => {
    lengthRef.current = samples.length
  }, [samples])

  const isReplay = replayIndex >= 0 && samples.length > 0
  const replaySnapshot = isReplay ? (samples[replayIndex]?.snapshot ?? null) : null

  const goTo = (i) => {
    if (i < 0) {
      setReplayIndex(-1)
      return
    }
    const max = lengthRef.current - 1
    setReplayIndex(i >= max ? max : i)
  }

  const live = () => setReplayIndex(-1)

  const step = (delta) => {
    if (lengthRef.current === 0) return
    const current = replayIndex < 0 ? lengthRef.current - 1 : replayIndex
    const next = current + delta
    setReplayIndex(next < 0 ? 0 : next >= lengthRef.current ? lengthRef.current - 1 : next)
  }

  const clear = () => {
    setSamples([])
    setReplayIndex(-1)
  }

  return { samples, replayIndex, isReplay, replaySnapshot, goTo, live, step, clear }
}