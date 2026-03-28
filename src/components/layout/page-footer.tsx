import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const footerInteractiveBaseClass =
  "relative inline-flex items-center whitespace-nowrap pb-[1px] leading-4 transition-colors before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-px before:w-full before:bg-underline after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-foreground after:opacity-0 motion-safe:after:opacity-100 motion-safe:after:origin-right motion-safe:after:scale-x-0 motion-safe:after:transition-transform motion-safe:after:duration-300 motion-safe:hover:after:origin-left motion-safe:hover:after:scale-x-100 motion-reduce:after:scale-x-100 motion-reduce:after:transition-opacity motion-reduce:after:duration-150 motion-reduce:hover:after:opacity-100 focus-visible:outline-none"

interface PageFooterProps {
  onAction: (index: number) => void
  onToggleCommands?: (nextVisible: boolean) => void
  onCommandToggleAvailabilityChange?: (available: boolean) => void
  activeIndex?: number
  className?: string
  revealCount?: number
  keyboardCommandsEnabled?: boolean
  keyboardCommandsVisible?: boolean
  reserveIntroSpace?: boolean
}

interface FooterActionProps {
  label: ReactNode
  ariaLabel?: string
  active?: boolean
  onClick: () => void
}

type FooterWindow = Window & { __iiwttHasShownInitialCommandPalette?: boolean }

function hasShownInitialCommandPalette() {
  if (typeof window === 'undefined') {
    return false
  }

  return Boolean((window as FooterWindow).__iiwttHasShownInitialCommandPalette)
}

function markInitialCommandPaletteShown() {
  if (typeof window === 'undefined') {
    return
  }

  ;(window as FooterWindow).__iiwttHasShownInitialCommandPalette = true
}

function normalizeCommandKey(key: string) {
  const normalized = key.toLowerCase()

  if (normalized === 'arrowleft' || normalized === 'left') {
    return 'arrowleft'
  }
  if (normalized === 'arrowright' || normalized === 'right') {
    return 'arrowright'
  }
  if (normalized === 'arrowup' || normalized === 'up') {
    return 'arrowup'
  }
  if (normalized === 'arrowdown' || normalized === 'down') {
    return 'arrowdown'
  }
  if (normalized === 'tab') {
    return 'tab'
  }
  if (normalized === 'shift') {
    return 'shift'
  }
  if (normalized === 'meta' || normalized === 'control' || normalized === 'ctrl') {
    return 'meta'
  }
  if (normalized === 'enter' || normalized === 'return') {
    return 'enter'
  }
  if (normalized === ' ' || normalized === 'spacebar' || normalized === 'space') {
    return 'space'
  }
  if (normalized === 'escape' || normalized === 'esc') {
    return 'escape'
  }
  if (normalized === 'k') {
    return 'k'
  }

  return null
}

function FooterAction({ label, ariaLabel, active = false, onClick }: FooterActionProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
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
  onToggleCommands,
  onCommandToggleAvailabilityChange,
  activeIndex = -1,
  className,
  revealCount,
  keyboardCommandsEnabled = false,
  keyboardCommandsVisible = true,
  reserveIntroSpace = false,
}: PageFooterProps) {
  const prefersReducedMotion = useReducedMotion()
  const AUTO_HIDE_MS = 10000
  const INITIAL_SHOW_LINK_DELAY_MS = prefersReducedMotion ? 0 : 900
  const INITIAL_KCP_EXIT_DURATION = prefersReducedMotion ? 0 : 0.5
  const INITIAL_KCLS_ENTER_DURATION = prefersReducedMotion ? 0 : 0.55
  const KCL_STANDARD_ENTER_DURATION = prefersReducedMotion ? 0 : 0.24
  const [initialSequenceDone, setInitialSequenceDone] = useState(() =>
    hasShownInitialCommandPalette(),
  )
  const [showInitialPalette, setShowInitialPalette] = useState(false)
  const [animateInitialShowLink, setAnimateInitialShowLink] = useState(false)
  const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({})
  const introTimerRef = useRef<number | null>(null)
  const delayedToggleTimerRef = useRef<number | null>(null)
  const initialExitUnmountTimerRef = useRef<number | null>(null)
  const initialSequenceStartedRef = useRef(false)
  const commandToggleArmedRef = useRef(false)

  const actions = [
    {
      label: 'Created by Avana Vana 🡭',
      ariaLabel: 'Created by Avana Vana (opens in a new tab)',
    },
    {
      label: 'Inspired by xkcd 🡭',
      ariaLabel: 'Inspired by xkcd (opens in a new tab)',
    },
    {
      label: 'View on Github 🡭',
      ariaLabel: 'View on GitHub (opens in a new tab)',
    },
    { label: 'Settings' },
  ]

  const visibleCount =
    revealCount === undefined ? actions.length : Math.max(0, Math.min(actions.length, revealCount))
  const visibleActions = actions.slice(0, visibleCount)

  const clearIntroTimer = useCallback(() => {
    if (introTimerRef.current !== null) {
      window.clearTimeout(introTimerRef.current)
      introTimerRef.current = null
    }
  }, [])

  const clearDelayedToggleTimer = useCallback(() => {
    if (delayedToggleTimerRef.current !== null) {
      window.clearTimeout(delayedToggleTimerRef.current)
      delayedToggleTimerRef.current = null
    }
  }, [])

  const clearInitialExitUnmountTimer = useCallback(() => {
    if (initialExitUnmountTimerRef.current !== null) {
      window.clearTimeout(initialExitUnmountTimerRef.current)
      initialExitUnmountTimerRef.current = null
    }
  }, [])

  useEffect(() => () => clearIntroTimer(), [clearIntroTimer])
  useEffect(() => () => clearDelayedToggleTimer(), [clearDelayedToggleTimer])
  useEffect(() => () => clearInitialExitUnmountTimer(), [clearInitialExitUnmountTimer])

  useEffect(() => {
    if (keyboardCommandsVisible) {
      return
    }

    clearIntroTimer()
    clearDelayedToggleTimer()
    clearInitialExitUnmountTimer()
    const hideTimeout = window.setTimeout(() => {
      setShowInitialPalette(false)
    }, 0)
    return () => {
      window.clearTimeout(hideTimeout)
    }
  }, [
    clearDelayedToggleTimer,
    clearInitialExitUnmountTimer,
    clearIntroTimer,
    keyboardCommandsVisible,
  ])

  useEffect(() => {
    if (!keyboardCommandsVisible || initialSequenceDone || initialSequenceStartedRef.current) {
      return
    }

    initialSequenceStartedRef.current = true
    markInitialCommandPaletteShown()

    const startTimeout = window.setTimeout(() => {
      setShowInitialPalette(true)
    }, 0)

    clearIntroTimer()
    introTimerRef.current = window.setTimeout(() => {
      clearInitialExitUnmountTimer()
      initialExitUnmountTimerRef.current = window.setTimeout(() => {
        setShowInitialPalette(false)
      }, 0)
    }, AUTO_HIDE_MS)

    return () => {
      window.clearTimeout(startTimeout)
      clearIntroTimer()
      clearInitialExitUnmountTimer()
    }
  }, [
    AUTO_HIDE_MS,
    clearInitialExitUnmountTimer,
    clearIntroTimer,
    initialSequenceDone,
    keyboardCommandsVisible,
  ])

  useEffect(
    () => () => {
      onCommandToggleAvailabilityChange?.(false)
    },
    [onCommandToggleAvailabilityChange],
  )

  const commandRowVisible =
    keyboardCommandsVisible &&
    ((!initialSequenceDone && showInitialPalette) ||
      (initialSequenceDone && keyboardCommandsEnabled))
  const showToggleLink = keyboardCommandsVisible && initialSequenceDone
  const footerLinksVisible = visibleActions.length > 0
  const shouldReserveCommandSpace =
    reserveIntroSpace && (!keyboardCommandsVisible || (!commandRowVisible && !showToggleLink))
  const footerLinksLayoutClass =
    'flex flex-col items-start gap-y-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-y-0'
  const commandPaletteVariants = {
    initial: { opacity: 0, y: 4 },
    enter: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { duration: 0.62 },
    },
    exitInitial: {
      opacity: 0,
      y: 4,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { duration: INITIAL_KCP_EXIT_DURATION },
    },
    exitInstant: {
      opacity: 0,
      y: 2,
      transition: { duration: 0 },
    },
  } as const

  useEffect(() => {
    onCommandToggleAvailabilityChange?.(showToggleLink)
  }, [showToggleLink, onCommandToggleAvailabilityChange])

  useEffect(() => {
    if (!commandRowVisible && !showToggleLink) {
      const clearPressedTimeout = window.setTimeout(() => {
        setPressedKeys({})
      }, 0)
      return () => {
        window.clearTimeout(clearPressedTimeout)
      }
    }

    let clearWhenPaletteHiddenTimeout: number | null = null
    if (!commandRowVisible) {
      clearWhenPaletteHiddenTimeout = window.setTimeout(() => {
        setPressedKeys({})
      }, 0)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = normalizeCommandKey(event.key)
      if (!key) {
        return
      }

      setPressedKeys((current) => {
        const nextState = { ...current }

        if (key === 'tab') {
          nextState.tab = true
          nextState.tabWithShift = event.getModifierState('Shift')
          return nextState
        }

        if (key === 'shift') {
          nextState.shift = true
          if (current.tab) {
            nextState.tabWithShift = true
          }
          return nextState
        }

        if (current[key]) {
          return current
        }

        nextState[key] = true
        return nextState
      })
    }

    const onKeyUp = (event: KeyboardEvent) => {
      const key = normalizeCommandKey(event.key)
      if (!key) {
        return
      }

      setPressedKeys((current) => {
        const next = { ...current }

        if (key === 'tab') {
          delete next.tab
          delete next.tabWithShift
          return next
        }

        if (key === 'shift') {
          delete next.shift
          if (next.tab) {
            next.tabWithShift = false
          } else {
            delete next.tabWithShift
          }
          return next
        }

        if (!current[key]) {
          return current
        }

        delete next[key]
        return next
      })
    }

    const clearPressed = () => {
      setPressedKeys({})
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clearPressed)
    document.addEventListener('visibilitychange', clearPressed)

    return () => {
      if (clearWhenPaletteHiddenTimeout !== null) {
        window.clearTimeout(clearWhenPaletteHiddenTimeout)
      }
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearPressed)
      document.removeEventListener('visibilitychange', clearPressed)
    }
  }, [commandRowVisible, showToggleLink])

  useEffect(() => {
    if (!keyboardCommandsVisible || !onToggleCommands || !initialSequenceDone) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        if (!event.repeat) {
          commandToggleArmedRef.current = true
        }
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (!commandToggleArmedRef.current) {
        return
      }

      const key = event.key.toLowerCase()
      if (key !== 'k' && key !== 'meta' && key !== 'control' && key !== 'ctrl') {
        return
      }

      commandToggleArmedRef.current = false
      setPressedKeys((current) => {
        if (!current.k && !current.meta) {
          return current
        }
        const next = { ...current }
        delete next.k
        delete next.meta
        return next
      })
      onToggleCommands(!commandRowVisible)
    }

    const clearArmedToggle = () => {
      commandToggleArmedRef.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clearArmedToggle)
    document.addEventListener('visibilitychange', clearArmedToggle)
    return () => {
      commandToggleArmedRef.current = false
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearArmedToggle)
      document.removeEventListener('visibilitychange', clearArmedToggle)
    }
  }, [
    commandRowVisible,
    initialSequenceDone,
    keyboardCommandsVisible,
    onToggleCommands,
  ])

  function keycapClass(active: boolean, square = false) {
    return cn(
      'inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border px-1 text-[9px]',
      square && 'w-4 min-w-4 px-0',
      active
        ? 'border-foreground font-bold text-foreground'
        : 'border-border font-medium text-muted-foreground',
    )
  }

  const footerLinkStartIndex = showToggleLink ? 1 : 0
  const commandToggleActive = showToggleLink && activeIndex === 0
  const commandModifierActive = commandToggleActive || Boolean(pressedKeys.meta)
  const commandShortcutActive = commandToggleActive || Boolean(pressedKeys.k)
  const animateToggleLinkOnMount = !prefersReducedMotion

  return (
    <footer
      className={cn(
        'mt-auto flex flex-col gap-12 pt-12 text-[10px] text-muted-foreground',
        className,
      )}
    >
      <div className="flex flex-col items-start gap-4">
        {showToggleLink ? (
          <motion.div
            initial={animateToggleLinkOnMount ? { opacity: 0, y: 3 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              animateInitialShowLink
                ? { duration: INITIAL_KCLS_ENTER_DURATION, ease: [0.22, 1, 0.36, 1] }
                : { duration: KCL_STANDARD_ENTER_DURATION, ease: [0.22, 1, 0.36, 1] }
            }
            onAnimationComplete={() => {
              if (animateInitialShowLink) {
                setAnimateInitialShowLink(false)
              }
            }}
            className="flex items-center gap-2"
          >
            <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <kbd className={keycapClass(commandModifierActive, true)}>
                ⌘
              </kbd>
              <span className="font-medium">+</span>
              <kbd className={keycapClass(commandShortcutActive, true)}>
                K
              </kbd>
            </span>
            <FooterAction
              label={commandRowVisible ? 'Hide key commands' : 'Show key commands'}
              ariaLabel={`${commandRowVisible ? 'Hide' : 'Show'} key commands. Shortcut: Command plus K`}
              active={commandToggleActive}
              onClick={() => {
                onToggleCommands?.(!commandRowVisible)
              }}
            />
          </motion.div>
        ) : null}

        <AnimatePresence
          mode="wait"
          onExitComplete={() => {
            if (!keyboardCommandsVisible || commandRowVisible) {
              return
            }

            if (!initialSequenceDone) {
              clearDelayedToggleTimer()
              delayedToggleTimerRef.current = window.setTimeout(
                () => {
                  setInitialSequenceDone(true)
                  setAnimateInitialShowLink(true)
                },
                INITIAL_SHOW_LINK_DELAY_MS,
              )
            }
          }}
        >
          {commandRowVisible ? (
            <motion.div
              key="key-commands"
              variants={commandPaletteVariants}
              initial="initial"
              animate="enter"
              exit={initialSequenceDone ? 'exitInstant' : 'exitInitial'}
              className="pointer-events-none flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:gap-12"
            >
              <div className="flex w-auto flex-col gap-2 sm:w-[189px]">
                <div className="text-[10px] font-medium leading-4 text-muted-foreground">Navigate</div>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <kbd className={keycapClass(Boolean(pressedKeys.arrowup), true)}>🡩</kbd>
                  <kbd className={keycapClass(Boolean(pressedKeys.arrowdown), true)}>🡫</kbd>
                  <kbd className={keycapClass(Boolean(pressedKeys.tab) && !pressedKeys.tabWithShift)}>tab</kbd>
                  <span className="inline-flex items-center gap-0.5">
                    <kbd className={keycapClass(Boolean(pressedKeys.shift))}>shift</kbd>
                    <span>+</span>
                    <kbd className={keycapClass(Boolean(pressedKeys.tab) && Boolean(pressedKeys.tabWithShift))}>tab</kbd>
                  </span>
                </div>
              </div>

              <div className="flex w-auto flex-col gap-2 sm:w-[123px]">
                <div className="text-[10px] font-medium leading-4 text-muted-foreground">Select</div>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <kbd className={keycapClass(Boolean(pressedKeys.enter))}>enter</kbd>
                  <kbd className={keycapClass(Boolean(pressedKeys.enter))}>return</kbd>
                  <kbd className={keycapClass(Boolean(pressedKeys.space))}>space</kbd>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-medium leading-4 text-muted-foreground">Back/Cancel</div>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <kbd className={keycapClass(Boolean(pressedKeys.escape))}>esc</kbd>
                </div>
              </div>
            </motion.div>
          ) : shouldReserveCommandSpace ? (
            <div
              className="pointer-events-none invisible flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:gap-12"
              aria-hidden="true"
            >
              <div className="flex w-auto flex-col gap-2 sm:w-[189px]">
                <div className="text-[10px] font-medium leading-4 text-muted-foreground">Navigate</div>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <kbd className={keycapClass(false, true)}>🡩</kbd>
                  <kbd className={keycapClass(false, true)}>🡫</kbd>
                  <kbd className={keycapClass(false)}>tab</kbd>
                  <span className="inline-flex items-center gap-0.5">
                    <kbd className={keycapClass(false)}>shift</kbd>
                    <span>+</span>
                    <kbd className={keycapClass(false)}>tab</kbd>
                  </span>
                </div>
              </div>

              <div className="flex w-auto flex-col gap-2 sm:w-[123px]">
                <div className="text-[10px] font-medium leading-4 text-muted-foreground">Select</div>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <kbd className={keycapClass(false)}>enter</kbd>
                  <kbd className={keycapClass(false)}>return</kbd>
                  <kbd className={keycapClass(false)}>space</kbd>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-medium leading-4 text-muted-foreground">Back/Cancel</div>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <kbd className={keycapClass(false)}>esc</kbd>
                </div>
              </div>
            </div>
          ) : null}
        </AnimatePresence>
      </div>

      {revealCount === undefined ? (
        <div className={footerLinksLayoutClass}>
          {visibleActions.map((label, index) => (
            <Fragment key={label.label}>
              <FooterAction
                label={label.label}
                ariaLabel={label.ariaLabel}
                onClick={() => onAction(index)}
                active={activeIndex === footerLinkStartIndex + index}
              />
              {index < visibleActions.length - 1 ? (
                <Separator aria-hidden className="hidden sm:mx-4 sm:block sm:shrink-0" />
              ) : null}
            </Fragment>
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {footerLinksVisible ? (
            <motion.div
              key="footer-links"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
              }
              className={footerLinksLayoutClass}
            >
              {visibleActions.map((label, index) => (
                <Fragment key={label.label}>
                  <FooterAction
                    label={label.label}
                    ariaLabel={label.ariaLabel}
                    onClick={() => onAction(index)}
                    active={activeIndex === footerLinkStartIndex + index}
                  />
                  {index < visibleActions.length - 1 ? (
                    <Separator aria-hidden className="hidden sm:mx-4 sm:block sm:shrink-0" />
                  ) : null}
                </Fragment>
              ))}
            </motion.div>
          ) : reserveIntroSpace ? (
            <div className={cn('pointer-events-none invisible', footerLinksLayoutClass)} aria-hidden="true">
              {actions.map((label, index) => (
                <Fragment key={`placeholder-${label.label}`}>
                  <span className="inline-flex items-center whitespace-nowrap pb-px leading-4 font-medium">
                    {label.label}
                  </span>
                  {index < actions.length - 1 ? (
                    <Separator aria-hidden className="hidden sm:mx-4 sm:block sm:shrink-0" />
                  ) : null}
                </Fragment>
              ))}
            </div>
          ) : null}
        </AnimatePresence>
      )}
    </footer>
  )
}
