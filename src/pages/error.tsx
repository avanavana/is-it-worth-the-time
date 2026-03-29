import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { motion, type Variants } from 'motion/react'

import { Action } from '@/components/action'
import { MenuOption } from '@/components/menu-option'
import { PageFooter } from '@/components/footer'
import type { View } from '@/types'

export function ErrorScreen({
  view,
  screenVariants,
  message,
  onKeyDown,
  onBackHome,
  errorCursorIndex,
  onSetErrorCursorIndex,
  onErrorAction,
}: {
  view: Extract<View, 'error-404' | 'error-403'>
  screenVariants: Variants
  message: string
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  onBackHome: () => void
  errorCursorIndex: number
  onSetErrorCursorIndex: (index: number) => void
  onErrorAction: (index: number) => void
}) {
  return (
    <motion.section
      key={view}
      variants={screenVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex min-h-[calc(100vh-48px)] content:min-h-[calc(100vh-96px)] w-full max-w-shell flex-col outline-none"
      onKeyDown={onKeyDown}
      tabIndex={0}
      data-screen-autofocus-view={view}
    >
      <div className="grow max-w-content text-[12px]">
        <p className="m-0 mb-12 flex items-center text-[12px] font-medium leading-4 text-error">
          <span>[</span>
          <span className="mx-px inline-flex bg-error px-0.5 text-error-foreground">ERR!</span>
          <span>]</span>
          <span className="ml-1">
            <MenuOption text={message} startDelayMs={0} animateOnlyOnMount />
          </span>
        </p>

        <div onMouseEnter={() => onSetErrorCursorIndex(0)}>
          <Action
            label={<MenuOption text="🡨 Back to home" startDelayMs={0} animateOnlyOnMount />}
            onClick={onBackHome}
            active={errorCursorIndex === 0}
          />
        </div>
      </div>

      <PageFooter
        onAction={(index) => onErrorAction(index + 1)}
        activeIndex={errorCursorIndex > 0 ? errorCursorIndex - 1 : -1}
        revealCount={3}
        keyboardCommandsVisible={false}
      />
    </motion.section>
  )
}
