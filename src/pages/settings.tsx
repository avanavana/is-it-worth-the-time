import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { motion, type Variants } from 'motion/react'

import { cn } from '@/lib/utils/display'

import { Action } from '@/components/action'
import { MenuOption } from '@/components/menu-option'
import { Header } from '@/components/header'
import type { SettingsOption } from '@/types'

export function SettingsScreen({
  screenVariants,
  onKeyDown,
  settingsIndex,
  settingsBackIndex,
  settingsOptions,
  settingsOptionStartIndex,
  onBack,
  onActivateOption,
  onSetSettingsIndex,
  menuOptionStaggerMs,
  interactiveBaseClass,
}: {
  screenVariants: Variants
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  settingsIndex: number
  settingsBackIndex: number
  settingsOptions: SettingsOption[]
  settingsOptionStartIndex: number
  onBack: () => void
  onActivateOption: (index: number) => void
  onSetSettingsIndex: (index: number) => void
  menuOptionStaggerMs: number
  interactiveBaseClass: string
}) {
  return (
    <motion.section
      key="settings"
      variants={screenVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex min-h-[calc(100vh-48px)] w-full max-w-shell flex-col content:min-h-[calc(100vh-96px)]"
    >
      <Header title="Settings" />

      <div
        className="grow max-w-content outline-none"
        tabIndex={0}
        data-screen-autofocus-view="settings"
        onKeyDown={onKeyDown}
      >
        <div className="mb-8 flex items-center gap-4 text-[12px]">
          <Action
            label={<MenuOption text="🡨 Back" startDelayMs={0} animateOnlyOnMount />}
            onClick={onBack}
            active={settingsIndex === settingsBackIndex}
          />
        </div>

        <div className="flex flex-col gap-2 text-[12px]">
          {settingsOptions.map((option, index) => {
            const optionIndex = settingsOptionStartIndex + index
            const isResetOption = option.id === 'reset'
            const settingsOptionAriaLabel = isResetOption
              ? option.label
              : option.id === 'theme'
                ? `${option.label} ${option.value}. Activate to cycle theme.`
                : `${option.label} ${option.value}. Activate to toggle.`

            return (
              <div
                key={option.id}
                className={cn(
                  'grid grid-cols-[12px_minmax(0,1fr)] items-start gap-2',
                  isResetOption && 'mt-6',
                )}
              >
                <div className="w-3 shrink-0 self-start translate-y-[1.5px] leading-none text-foreground">
                  {optionIndex === settingsIndex ? '🡲' : '\u00A0'}
                </div>
                <button
                  type="button"
                  aria-label={settingsOptionAriaLabel}
                  className={cn(
                    isResetOption
                      ? cn(
                          interactiveBaseClass,
                          'inline-flex w-fit cursor-pointer items-center text-left outline-none transition-colors',
                          optionIndex === settingsIndex &&
                            'motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100',
                          optionIndex === settingsIndex
                            ? 'font-bold text-foreground'
                            : 'font-medium text-muted-foreground hover:text-foreground',
                        )
                      : cn(
                          'w-full cursor-pointer text-left outline-none transition-colors',
                          optionIndex === settingsIndex
                            ? 'font-bold text-foreground'
                            : 'font-medium text-muted-foreground hover:text-foreground',
                        ),
                  )}
                  onMouseEnter={() => onSetSettingsIndex(optionIndex)}
                  onClick={() => onActivateOption(index)}
                >
                  {isResetOption ? (
                    <MenuOption
                      text={option.label}
                      startDelayMs={optionIndex * menuOptionStaggerMs}
                      animateOnlyOnMount
                    />
                  ) : (
                    <span
                      className={cn(
                        option.value
                          ? 'grid grid-cols-[24ch_minmax(0,1fr)] items-start gap-x-8'
                          : 'block',
                      )}
                      style={{ lineHeight: 'normal' }}
                    >
                      <span style={{ lineHeight: 'normal' }}>
                        <MenuOption
                          text={option.label}
                          startDelayMs={optionIndex * menuOptionStaggerMs}
                          animateOnlyOnMount
                        />
                      </span>
                      {option.value ? (
                        <span style={{ lineHeight: 'normal' }}>
                          <MenuOption
                            text={option.value}
                            startDelayMs={optionIndex * menuOptionStaggerMs}
                            animateOnlyOnMount
                            reserveLayout
                          />
                        </span>
                      ) : null}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}
