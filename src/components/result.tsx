import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

export function Result({
  text,
  onComplete,
}: {
  text: string
  onComplete: () => void
}) {
  const prefersReducedMotion = useReducedMotion()
  const [visibleLength, setVisibleLength] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion) {
      onComplete()
      return
    }

    let timer = 0
    let cancelled = false

    if (text.length === 0) {
      onComplete()
      return
    }

    const step = (index: number) => {
      if (cancelled) {
        return
      }

      setVisibleLength(index)

      if (index >= text.length) {
        onComplete()
        return
      }

      timer = window.setTimeout(() => step(index + 1), 16)
    }

    timer = window.setTimeout(() => step(1), 50)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [text, onComplete, prefersReducedMotion])

  return <span className="whitespace-nowrap">{text.slice(0, visibleLength)}</span>
}
