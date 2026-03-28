import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

import { MENU_OPTION_CHAR_MS } from '@/lib/constants/animation'

export function MenuOption({
  text,
  startDelayMs,
  animateOnlyOnMount = false,
  reserveLayout = false,
}: {
  text: string
  startDelayMs: number
  animateOnlyOnMount?: boolean
  reserveLayout?: boolean
}) {
  const prefersReducedMotion = useReducedMotion()
  const [visibleLength, setVisibleLength] = useState(0)
  const [hasAnimatedOnMount, setHasAnimatedOnMount] = useState(false)
  const shouldAnimate = !prefersReducedMotion && (!animateOnlyOnMount || !hasAnimatedOnMount)

  useEffect(() => {
    if (!shouldAnimate) {
      return
    }

    let timer = 0
    let cancelled = false

    const step = (index: number) => {
      if (cancelled) {
        return
      }

      setVisibleLength(index)

      if (index >= text.length) {
        if (animateOnlyOnMount) {
          setHasAnimatedOnMount(true)
        }
        return
      }

      timer = window.setTimeout(() => step(index + 1), MENU_OPTION_CHAR_MS)
    }

    if (startDelayMs <= 0) {
      step(1)
    } else {
      timer = window.setTimeout(() => step(1), startDelayMs)
    }

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [animateOnlyOnMount, shouldAnimate, startDelayMs, text])

  if (!shouldAnimate) {
    return <span>{text}</span>
  }

  if (reserveLayout) {
    return (
      <span className="relative block">
        <span className="invisible block">{text}</span>
        <span className="absolute inset-0 block">{text.slice(0, visibleLength)}</span>
      </span>
    )
  }

  return <span>{text.slice(0, visibleLength)}</span>
}
