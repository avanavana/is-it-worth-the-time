import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

export function Tooltip({ text }: { text: string }) {
  const prefersReducedMotion = useReducedMotion()
  const [visibleLength, setVisibleLength] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion) {
      return
    }

    let timer = 0
    let cancelled = false

    if (text.length === 0) {
      return
    }

    const step = (index: number) => {
      if (cancelled) {
        return
      }

      setVisibleLength(index)

      if (index >= text.length) {
        return
      }

      timer = window.setTimeout(() => step(index + 1), 16)
    }

    timer = window.setTimeout(() => step(1), 45)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [prefersReducedMotion, text])

  if (prefersReducedMotion) {
    return <span>{text}</span>
  }

  return <span>{text.slice(0, visibleLength)}</span>
}
