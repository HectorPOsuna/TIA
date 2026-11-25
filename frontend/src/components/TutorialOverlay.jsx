import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon.jsx'

const CARD_WIDTH = 324
const CARD_HEIGHT = 300
const EDGE = 12
const GAP = 16
const HOVER_DELAY_MS = 500
const HINT_DELAY_MS = 6000
const CONFIRMATION_MS = 2500
const INTERACTIVE_SELECTOR = 'button, input, select, textarea, a[href], [role="button"], [role="tab"]'

function readRect(selector) {
  if (!selector) return null
  const element = document.querySelector(selector)
  if (!element) return null
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  if (
    rect.bottom <= 0 ||
    rect.top >= window.innerHeight ||
    rect.right <= 0 ||
    rect.left >= window.innerWidth
  ) {
    return null
  }
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

function sameRect(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

function placeCard(box) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(CARD_WIDTH, vw - EDGE * 2)
  if (!box) {
    return {
      left: Math.round(Math.max(EDGE, (vw - width) / 2)),
      top: Math.round(Math.max(EDGE, (vh - CARD_HEIGHT) / 2)),
    }
  }
  const fitsRight = box.left + box.width + GAP + width <= vw - EDGE
  const fitsLeft = box.left - GAP - width >= EDGE
  let left
  if (fitsRight) left = box.left + box.width + GAP
  else if (fitsLeft) left = box.left - GAP - width
  else left = Math.max(EDGE, Math.min(box.left, vw - width - EDGE))
  const below = box.top + box.height + GAP
  const above = box.top - GAP - CARD_HEIGHT
  let top
  if (below + CARD_HEIGHT <= vh - EDGE) top = below
  else if (above >= EDGE) top = above
  else top = Math.max(EDGE, Math.min(vh - CARD_HEIGHT - EDGE, box.top))
  return { left: Math.round(left), top: Math.round(top) }
}

function interactiveState(step) {
  if (typeof step.interactive === 'boolean') return step.interactive
  const element = document.querySelector(step.target)
  if (!element) return null
  return Boolean(
    element.matches(INTERACTIVE_SELECTOR) || element.querySelector(INTERACTIVE_SELECTOR),
  )
}

export function TutorialOverlay({
  step,
  index,
  total,
  steps,
  explored,
  onNext,
  onPrevious,
  onReset,
  onMark,
  onJump,
  reducedMotion,
}) {
  const [box, setBox] = useState(null)
  const [showHint, setShowHint] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [trackerOpen, setTrackerOpen] = useState(false)
  const cardRef = useRef(null)
  const hoverTimer = useRef(null)
  const interactive = interactiveState(step)
  const exploredSet = useMemo(() => new Set(explored), [explored])
  const moduleGroups = useMemo(() => {
    const groups = new Map()
    steps.forEach((item, itemIndex) => {
      if (!groups.has(item.module)) groups.set(item.module, [])
      groups.get(item.module).push({ item, itemIndex })
    })
    return Array.from(groups, ([name, entries]) => ({ name, entries }))
  }, [steps])

  const measure = useCallback(() => {
    const next = readRect(step.target)
    setBox((current) => (sameRect(current, next) ? current : next))
  }, [step.target])

  const markStep = useCallback(() => {
    if (exploredSet.has(step.id)) return
    onMark(step.id)
    setConfirmed(true)
    setShowHint(false)
  }, [exploredSet, step.id, onMark])

  useEffect(() => {
    const frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  })

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.querySelector(step.target)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [step.target])

  useEffect(() => {
    window.addEventListener('resize', measure)
    const resizeObserver = new ResizeObserver(measure)
    document.querySelectorAll('[data-tutorial-id]').forEach((element) => {
      resizeObserver.observe(element)
    })
    const mutationObserver = new MutationObserver(measure)
    mutationObserver.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.removeEventListener('resize', measure)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [measure])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setShowHint(false)
      setConfirmed(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [step.id])

  useEffect(() => {
    if (interactive !== false || exploredSet.has(step.id)) return undefined
    const frame = requestAnimationFrame(() => onMark(step.id))
    return () => cancelAnimationFrame(frame)
  }, [interactive, exploredSet, step.id, onMark])

  useEffect(() => {
    const id = setTimeout(() => setShowHint(true), HINT_DELAY_MS)
    return () => clearTimeout(id)
  }, [step.id, confirmed])

  useEffect(() => {
    if (!confirmed) return undefined
    const id = setTimeout(() => setConfirmed(false), CONFIRMATION_MS)
    return () => clearTimeout(id)
  }, [confirmed])

  useEffect(() => {
    const onClick = (event) => {
      if (event.target.closest('.tutorial-card')) return
      const element = document.querySelector(step.target)
      const inside = Boolean(element && (event.target === element || element.contains(event.target)))
      if (inside) markStep()
      else setShowHint(true)
    }
    const onPointerOver = (event) => {
      if (interactive !== true) return
      const element = document.querySelector(step.target)
      if (!element || !(event.target === element || element.contains(event.target))) return
      clearTimeout(hoverTimer.current)
      hoverTimer.current = setTimeout(markStep, HOVER_DELAY_MS)
    }
    const onPointerOut = (event) => {
      const element = document.querySelector(step.target)
      if (!element) return
      if (event.relatedTarget && element.contains(event.relatedTarget)) return
      clearTimeout(hoverTimer.current)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      clearTimeout(hoverTimer.current)
    }
  }, [step.target, interactive, markStep])

  const position = placeCard(box)
  const still = reducedMotion ? ' tutorial-card--still' : ''
  const ringStill = reducedMotion ? ' tutorial-ring--still' : ''

  return (
    <div className="tutorial-layer">
      {box && (
        <div
          className={`tutorial-ring${ringStill}`}
          aria-hidden="true"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}
      <section
        ref={cardRef}
        className={`tutorial-card${still}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tutorial-title"
        style={{ top: position.top, left: position.left }}
      >
        <div className="tutorial-card__eyebrow">
          <span className="tutorial-card__spark" aria-hidden="true" />
          MISIÓN {String(index + 1).padStart(2, '0')} / {total} · {step.eyebrow}
        </div>
        <div className="tutorial-card__segments" aria-hidden="true">
          {steps.map((item, itemIndex) => (
            <span
              key={item.id}
              className={`${itemIndex <= index ? 'is-done' : ''} ${
                exploredSet.has(item.id) ? 'is-explored' : ''
              }`}
            />
          ))}
        </div>
        <div className="tutorial-card__copy" aria-live="polite">
          <h2 id="tutorial-title">{step.title}</h2>
          <p>{step.description}</p>
          <p className="tutorial-card__prompt" data-tutorial-ui="prompt">
            <strong>PRUEBA</strong> {step.prompt}
          </p>
          {showHint && (
            <p className="tutorial-card__hint" data-tutorial-ui="hint">
              <Icon name="alert" size={13} />
              {step.hint}
            </p>
          )}
          {confirmed && (
            <p className="tutorial-card__confirm" data-tutorial-ui="confirmation">
              Paso marcado. Avanza cuando quieras.
            </p>
          )}
        </div>
        <div className="tutorial-tracker">
          <button
            type="button"
            className="tutorial-tracker__toggle"
            onClick={() => setTrackerOpen((open) => !open)}
            aria-expanded={trackerOpen}
            data-tutorial-ui="tracker"
          >
            Explorados {exploredSet.size}/{total}
            <Icon name="chevron" size={14} className={trackerOpen ? 'is-open' : ''} />
          </button>
          {trackerOpen && (
            <div className="tutorial-tracker__body">
              {moduleGroups.map((group) => {
                const done = group.entries.filter(({ item }) => exploredSet.has(item.id)).length
                return (
                  <div key={group.name} className="tutorial-tracker__group">
                    <div className="tutorial-tracker__label">
                      {group.name} {done}/{group.entries.length}
                    </div>
                    <div className="tutorial-tracker__steps">
                      {group.entries.map(({ item, itemIndex }) => (
                        <button
                          key={item.id}
                          type="button"
                          className={exploredSet.has(item.id) ? 'is-explored' : ''}
                          onClick={() => onJump(itemIndex)}
                          aria-label={`Ir al paso ${itemIndex + 1}: ${item.title}`}
                          title={item.title}
                          data-tutorial-ui="jump"
                        >
                          {String(itemIndex + 1).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="tutorial-card__actions">
          <button
            type="button"
            className="btn btn--sm"
            onClick={onPrevious}
            disabled={index === 0}
            data-tutorial-ui="previous"
          >
            <Icon name="step-back" size={14} />
            retroceder
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={onReset}
            data-tutorial-ui="reset"
          >
            <Icon name="reset" size={14} />
            reiniciar
          </button>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={onNext}
            disabled={index === total - 1}
            data-tutorial-ui="next"
          >
            avanzar
            <Icon name="step-forward" size={14} />
          </button>
        </div>
      </section>
    </div>
  )
}
