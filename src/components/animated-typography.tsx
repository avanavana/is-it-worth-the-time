import { motion, useReducedMotion } from 'motion/react'

import {
  WORD_REVEAL_DURATION_SECONDS,
  WORD_REVEAL_STEP_SECONDS,
} from '@/lib/constants/animation'

export function AnimatedTypography({ text, delaySteps = 0 }: { text: string; delaySteps?: number }) {
  const prefersReducedMotion = useReducedMotion()
  const tokens = text.split(/(\s+)/).filter(Boolean)

  if (prefersReducedMotion) {
    return <span>{text}</span>
  }

  return (
    <span>
      {tokens.map((token, index) => {
        const whitespace = /^\s+$/.test(token)

        if (whitespace) {
          return <span key={`ws-${index}`}>{token}</span>
        }

        const currentAnimatedIndex =
          tokens.slice(0, index + 1).filter((part) => !/^\s+$/.test(part)).length - 1

        return (
          <motion.span
            key={`word-${token}-${index}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: WORD_REVEAL_DURATION_SECONDS,
              delay: (delaySteps + currentAnimatedIndex) * WORD_REVEAL_STEP_SECONDS,
            }}
          >
            {token}
          </motion.span>
        )
      })}
    </span>
  )
}
