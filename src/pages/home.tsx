import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import NumberFlow from '@number-flow/react'
import { motion, type MotionProps, type Variants } from 'motion/react'

import {
  HOME_CURSOR_RESULT_INDEX,
  HOME_REVEAL_STAGE_KEY_COMMANDS,
  HOME_REVEAL_STAGE_RESULT,
  HOME_REVEAL_STAGE_SHOW_TABLE,
  HOME_SHOW_TABLE_LABEL,
} from '@/lib/constants/home'
import { getFlowStepCount } from '@/lib/utils/display'

import { PageFooter } from '@/components/footer'
import { Action } from '@/components/action'
import { AnimatedSlot } from '@/components/animated-slot'
import { AnimatedTypography } from '@/components/animated-typography'
import { Cursor } from '@/components/cursor'
import { ExactResultText } from '@/components/exact-result-text'
import { Header } from '@/components/header'
import { InlineSelectTrigger } from '@/components/inline-select-trigger'
import { MenuOption } from '@/components/menu-option'
import { Result } from '@/components/result'
import { Separator } from '@/components/separator'

export function HomeScreen({
  screenVariants,
  onKeyDown,
  homeTitle,
  homeText1,
  homeText2,
  homeText3,
  homeText4,
  homeFlowText1Delay,
  homeFlowStep1,
  homeFlowStep2,
  homeFlowStep3,
  homeFlowStep4,
  frequencyLabel,
  timeSavedLabel,
  lifetimeLabel,
  activeHomeCursorIndex,
  onHomeAction,
  homeRevealStage,
  stagedRevealMotionProps,
  prefersReducedMotion,
  resultTypewriterDone,
  shouldTypeResultText,
  focusImpossible,
  displayMode,
  focusResultExactText,
  focusResult,
  focusResultApproxUnitLabel,
  resultTypewriterRunId,
  focusResultTypewriterText,
  onResultTypewriterComplete,
  hasResettableChanges,
  hasCustomCalendar,
  daysPerYear,
  homeFooterStartIndex,
  homeFooterRevealCount,
  autoHideKeyCommands,
  onFooterAction,
  onToggleCommands,
  onCommandToggleAvailabilityChange,
}: {
  screenVariants: Variants
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  homeTitle: string
  homeText1: string
  homeText2: string
  homeText3: string
  homeText4: string
  homeFlowText1Delay: number
  homeFlowStep1: number
  homeFlowStep2: number
  homeFlowStep3: number
  homeFlowStep4: number
  frequencyLabel: string
  timeSavedLabel: string
  lifetimeLabel: string
  activeHomeCursorIndex: number
  onHomeAction: (index: number) => void
  homeRevealStage: number
  stagedRevealMotionProps: MotionProps
  prefersReducedMotion: boolean | null
  resultTypewriterDone: boolean
  shouldTypeResultText: boolean
  focusImpossible: boolean
  displayMode: 'humanized' | 'exact'
  focusResultExactText: string
  focusResult: { approx: boolean; value: number; unit: string }
  focusResultApproxUnitLabel: string
  resultTypewriterRunId: number
  focusResultTypewriterText: string
  onResultTypewriterComplete: () => void
  hasResettableChanges: boolean
  hasCustomCalendar: boolean
  daysPerYear: number
  homeFooterStartIndex: number
  homeFooterRevealCount: number
  autoHideKeyCommands: boolean
  onFooterAction: (index: number) => void
  onToggleCommands: (nextVisible: boolean) => void
  onCommandToggleAvailabilityChange: (available: boolean) => void
}) {
  return (
    <motion.section
      key="home"
      variants={screenVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex min-h-[calc(100vh-48px)] content:min-h-[calc(100vh-96px)] w-full max-w-shell flex-col outline-none"
      onKeyDown={onKeyDown}
      tabIndex={0}
      data-screen-autofocus-view="home"
    >
      <Header title={homeTitle} typewriter spacingClassName="mb-12" />

      <div className="grow max-w-[500px]">
        <p className="m-0 text-[12px] font-medium leading-6 text-muted-foreground">
          <AnimatedTypography text={homeText1} delaySteps={homeFlowText1Delay} />
          <AnimatedSlot delaySteps={homeFlowStep1}>
            <span className="mr-2 inline-flex">
              <Action
                label={<InlineSelectTrigger text={frequencyLabel} />}
                onClick={() => onHomeAction(0)}
                active={activeHomeCursorIndex === 0}
                variant="strong"
                className="leading-4"
              />
            </span>
          </AnimatedSlot>
          <AnimatedTypography text={homeText2} delaySteps={homeFlowStep2} />
          <AnimatedSlot delaySteps={homeFlowStep2 + getFlowStepCount(homeText2)}>
            <span className="mr-2 inline-flex">
              <Action
                label={<InlineSelectTrigger text={timeSavedLabel} />}
                onClick={() => onHomeAction(1)}
                active={activeHomeCursorIndex === 1}
                variant="strong"
                className="leading-4"
              />
            </span>
          </AnimatedSlot>
          <AnimatedTypography text={homeText3} delaySteps={homeFlowStep3} />
          <AnimatedSlot delaySteps={homeFlowStep3 + getFlowStepCount(homeText3)}>
            <span className="mr-2 inline-flex">
              <Action
                label={<InlineSelectTrigger text={lifetimeLabel} />}
                onClick={() => onHomeAction(2)}
                active={activeHomeCursorIndex === 2}
                variant="strong"
                className="leading-4"
              />
            </span>
          </AnimatedSlot>
          <AnimatedTypography text={homeText4} delaySteps={homeFlowStep4} />
        </p>

        {homeRevealStage >= HOME_REVEAL_STAGE_RESULT ? (
          <motion.div {...stagedRevealMotionProps} className="mt-12 text-[12px]">
            <div className="flex items-center">
              <button
                type="button"
                aria-label={
                  displayMode === 'exact'
                    ? 'Result is showing exact value. Activate to show approximate value.'
                    : 'Result is showing approximate value. Activate to show exact value.'
                }
                className="relative inline-flex h-6 cursor-pointer items-center whitespace-nowrap pr-[12px] font-bold text-foreground focus-visible:outline-none"
                onClick={() => onHomeAction(HOME_CURSOR_RESULT_INDEX)}
              >
                {!shouldTypeResultText ? (
                  focusImpossible ? (
                    <span>—</span>
                  ) : displayMode === 'exact' ? (
                    <ExactResultText text={focusResultExactText} />
                  ) : (
                    <span className="whitespace-nowrap">
                      {focusResult.approx ? '~' : ''}
                      <NumberFlow value={focusResult.value} format={{ maximumFractionDigits: 2 }} />{' '}
                      {focusResultApproxUnitLabel}
                    </span>
                  )
                ) : (
                  <Result
                    key={resultTypewriterRunId}
                    text={focusResultTypewriterText}
                    onComplete={onResultTypewriterComplete}
                  />
                )}
                <Cursor
                  active={
                    activeHomeCursorIndex === HOME_CURSOR_RESULT_INDEX &&
                    (prefersReducedMotion || resultTypewriterDone)
                  }
                  className="absolute right-0 top-1/2 -translate-y-1/2"
                />
              </button>
            </div>
          </motion.div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 text-[12px]">
          {homeRevealStage >= HOME_REVEAL_STAGE_SHOW_TABLE ? (
            <motion.div {...stagedRevealMotionProps}>
              <Action
                label={<MenuOption text={HOME_SHOW_TABLE_LABEL} startDelayMs={0} />}
                onClick={() => onHomeAction(4)}
                active={activeHomeCursorIndex === 4}
              />
            </motion.div>
          ) : null}

          {hasResettableChanges && homeRevealStage >= HOME_REVEAL_STAGE_SHOW_TABLE ? (
            <>
              <motion.div {...stagedRevealMotionProps}>
                <Separator aria-hidden />
              </motion.div>
              <motion.div {...stagedRevealMotionProps}>
                <Action
                  label="⟲ Reset to defaults"
                  onClick={() => onHomeAction(5)}
                  active={activeHomeCursorIndex === 5}
                />
              </motion.div>
            </>
          ) : null}
        </div>

        {hasCustomCalendar && homeRevealStage >= HOME_REVEAL_STAGE_SHOW_TABLE ? (
          <motion.p
            {...stagedRevealMotionProps}
            className="mt-3 text-[10px] text-muted-foreground"
          >
            * Using {daysPerYear} days per year.
          </motion.p>
        ) : null}
      </div>

      <PageFooter
        activeIndex={
          activeHomeCursorIndex >= homeFooterStartIndex
            ? activeHomeCursorIndex - homeFooterStartIndex
            : -1
        }
        onAction={onFooterAction}
        onToggleCommands={onToggleCommands}
        onCommandToggleAvailabilityChange={onCommandToggleAvailabilityChange}
        revealCount={homeFooterRevealCount}
        keyboardCommandsEnabled={autoHideKeyCommands}
        keyboardCommandsVisible={homeRevealStage >= HOME_REVEAL_STAGE_KEY_COMMANDS}
        reserveIntroSpace
      />
    </motion.section>
  )
}
