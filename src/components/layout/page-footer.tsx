import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const footerInteractiveBaseClass =
  "relative inline-flex items-center whitespace-nowrap pb-[1px] leading-4 transition-colors before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-px before:w-full before:bg-underline after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-foreground after:opacity-0 motion-safe:after:opacity-100 motion-safe:after:origin-right motion-safe:after:scale-x-0 motion-safe:after:transition-transform motion-safe:after:duration-300 motion-safe:hover:after:origin-left motion-safe:hover:after:scale-x-100 motion-reduce:after:scale-x-100 motion-reduce:after:transition-opacity motion-reduce:after:duration-150 motion-reduce:hover:after:opacity-100 focus-visible:outline-none"

interface PageFooterProps {
  onAction: (index: number) => void
  activeIndex?: number
  className?: string
  revealCount?: number
  autoHideKeyCommands?: boolean
  keyboardCommandsVisible?: boolean
}

interface FooterActionProps {
  label: string
  active?: boolean
  onClick: () => void
}

function FooterAction({ label, active = false, onClick }: FooterActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        footerInteractiveBaseClass,
        active
          ? 'font-bold text-foreground motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100'
          : 'font-medium text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      <span
        className={cn(
          'absolute left-full ml-1 top-1/2 inline-block h-[12px] w-[8px] -translate-y-1/2 bg-foreground transition-opacity',
          active ? 'opacity-100 animate-[terminal-blink_1s_steps(1,end)_infinite]' : 'opacity-0',
        )}
        aria-hidden="true"
      />
    </button>
  )
}

export function PageFooter({
  onAction,
  activeIndex = -1,
  className,
  revealCount,
  autoHideKeyCommands = true,
  keyboardCommandsVisible = true,
}: PageFooterProps) {
  const prefersReducedMotion = useReducedMotion()
  const BOTTOM_HOTZONE_PX = 120
  const AUTO_HIDE_MS = 10000
  const [keyCommandsVisible, setKeyCommandsVisible] = useState(false)
  const keyCommandsVisibleRef = useRef(false)
  const hideTimerRef = useRef<number | null>(null)
  const wasFooterFocusedRef = useRef(false)
  const actions = [
    'Created by Avana Vana 🡭',
    'Inspired by xkcd 🡭',
    'View on Github 🡭',
    'Settings',
  ]
  const visibleCount =
    revealCount === undefined ? actions.length : Math.max(0, Math.min(actions.length, revealCount))
  const visibleActions = actions.slice(0, visibleCount)

  useEffect(() => {
    keyCommandsVisibleRef.current = keyCommandsVisible
  }, [keyCommandsVisible])

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const showAndAutoHide = useCallback(() => {
    clearHideTimer()
    setKeyCommandsVisible(true)
    hideTimerRef.current = window.setTimeout(() => {
      setKeyCommandsVisible(false)
    }, AUTO_HIDE_MS)
  }, [AUTO_HIDE_MS, clearHideTimer])

  const showWithoutAutoHide = useCallback(() => {
    clearHideTimer()
    setKeyCommandsVisible(true)
  }, [clearHideTimer])

  const hideCommands = useCallback(() => {
    clearHideTimer()
    setKeyCommandsVisible(false)
  }, [clearHideTimer])

  useEffect(() => {
    if (!keyboardCommandsVisible) {
      clearHideTimer()
      wasFooterFocusedRef.current = false
      const hideTimeout = window.setTimeout(() => {
        setKeyCommandsVisible(false)
      }, 0)
      return () => {
        window.clearTimeout(hideTimeout)
      }
    }

    const showTimeout = window.setTimeout(() => {
      if (autoHideKeyCommands) {
        showAndAutoHide()
        return
      }

      showWithoutAutoHide()
    }, 0)

    return () => {
      window.clearTimeout(showTimeout)
    }
  }, [
    autoHideKeyCommands,
    keyboardCommandsVisible,
    clearHideTimer,
    showAndAutoHide,
    showWithoutAutoHide,
  ])

  useEffect(() => {
    if (!autoHideKeyCommands || !keyboardCommandsVisible) {
      wasFooterFocusedRef.current = false
      return
    }

    const isFooterItemFocused = activeIndex >= 0 && activeIndex < visibleActions.length
    if (isFooterItemFocused) {
      wasFooterFocusedRef.current = true
      const focusShowTimeout = window.setTimeout(() => {
        showWithoutAutoHide()
      }, 0)
      return () => {
        window.clearTimeout(focusShowTimeout)
      }
    }

    if (wasFooterFocusedRef.current) {
      wasFooterFocusedRef.current = false
      const focusHideTimeout = window.setTimeout(() => {
        hideCommands()
      }, 0)
      return () => {
        window.clearTimeout(focusHideTimeout)
      }
    }

    return
  }, [
    activeIndex,
    autoHideKeyCommands,
    hideCommands,
    keyboardCommandsVisible,
    visibleActions.length,
    showWithoutAutoHide,
  ])

  useEffect(() => {
    if (!autoHideKeyCommands || !keyboardCommandsVisible) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const fromBottom = window.innerHeight - event.clientY
      if (fromBottom > BOTTOM_HOTZONE_PX) {
        return
      }

      if (keyCommandsVisibleRef.current) {
        return
      }

      showAndAutoHide()
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [BOTTOM_HOTZONE_PX, autoHideKeyCommands, keyboardCommandsVisible, showAndAutoHide])

  useEffect(() => () => clearHideTimer(), [clearHideTimer])

  return (
    <footer
      className={cn(
        'mt-auto flex flex-col gap-12 pt-12 text-[10px] text-muted-foreground',
        className,
      )}
    >
      <AnimatePresence mode="wait">
        {keyboardCommandsVisible && keyCommandsVisible ? (
          <motion.div
            key="key-commands"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.62, ease: [0.22, 1, 0.36, 1] }
            }
            className="pointer-events-none flex flex-wrap items-start gap-12"
          >
            <div className="flex w-[189px] flex-col gap-2">
              <div className="text-[10px] font-medium leading-4 text-muted-foreground">Navigate</div>
              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border px-1">🡨</kbd>
                <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border px-1">🡪</kbd>
                <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border px-1">🡩</kbd>
                <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border px-1">🡫</kbd>
                <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border px-1">tab</kbd>
                <span className="inline-flex items-center gap-0.5">
                  <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border px-1">shift</kbd>
                  <span>+</span>
                  <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border px-1">tab</kbd>
                </span>
              </div>
            </div>

            <div className="flex w-[123px] flex-col gap-2">
              <div className="text-[10px] font-medium leading-4 text-muted-foreground">Select</div>
              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border px-1">enter</kbd>
                <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border px-1">return</kbd>
                <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border px-1">space</kbd>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-[10px] font-medium leading-4 text-muted-foreground">Back/Cancel</div>
              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-border px-1">esc</kbd>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-y-2">
        {visibleActions.map((label, index) => (
          <Fragment key={label}>
            <FooterAction
              label={label}
              onClick={() => onAction(index)}
              active={activeIndex === index}
            />
            {index < visibleActions.length - 1 ? (
              <Separator aria-hidden className="mx-4 shrink-0" />
            ) : null}
          </Fragment>
        ))}
      </div>
    </footer>
  )
}
