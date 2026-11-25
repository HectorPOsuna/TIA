import { useCallback, useEffect, useState } from 'react'
import {
  clampIndex,
  markExplored as markExploredProgress,
  nextIndex,
  previousIndex,
  readProgress,
  reset,
  toggle,
  writeProgress,
} from '../tutorial/progress.js'

function getStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function useTutorial(total, validIds) {
  const [progress, setProgress] = useState(() => readProgress(getStorage(), total, validIds))

  useEffect(() => {
    writeProgress(getStorage(), progress)
  }, [progress])

  const next = useCallback(() => {
    setProgress((current) => ({ ...current, index: nextIndex(current.index, total) }))
  }, [total])

  const previous = useCallback(() => {
    setProgress((current) => ({ ...current, index: previousIndex(current.index, total) }))
  }, [total])

  const resetTutorial = useCallback(() => setProgress(reset()), [])

  const toggleVisible = useCallback(() => {
    setProgress((current) => toggle(current))
  }, [])

  const markExplored = useCallback((id) => {
    setProgress((current) => markExploredProgress(current, id))
  }, [])

  const goTo = useCallback(
    (index) => {
      setProgress((current) => ({ ...current, index: clampIndex(index, total) }))
    },
    [total],
  )

  return {
    index: progress.index,
    visible: progress.visible,
    explored: progress.explored ?? [],
    next,
    previous,
    reset: resetTutorial,
    toggle: toggleVisible,
    markExplored,
    goTo,
  }
}
