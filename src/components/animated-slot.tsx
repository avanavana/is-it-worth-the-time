import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import {
  WORD_REVEAL_DURATION_SECONDS,
  WORD_REVEAL_STEP_SECONDS,
} from '@/lib/constants/animation'

export function AnimatedSlot({
  delaySteps,
  children,
}: {
  delaySteps: number
  children: ReactNode
}) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <span className="inline-flex">{children}</span>
  }

  return (
    <motion.span
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: WORD_REVEAL_DURATION_SECONDS,
        delay: delaySteps * WORD_REVEAL_STEP_SECONDS,
      }}
      className="inline-flex"
    >
      {children}
    </motion.span>
  )
}
