import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { motion, type Variants } from 'motion/react'

import { cn } from '@/lib/utils/display'
import { interactiveBaseClass } from '@/lib/constants/view'

import { Action } from '@/components/action'
import { MenuOption } from '@/components/menu-option'
import { Header } from '@/components/header'
import type { View } from '@/types'

export function SelectMenuScreen({
  view,
  screenVariants,
  menuTitle,
  menuOptions,
  menuDefaultOptionCount,
  menuSupportsCustomRemove,
  menuCursorVisible,
  menuIndex,
  menuSelectedIndex,
  menuNewOptionIndex,
  menuCancelIndex,
  cancelLabel,
  menuOptionStaggerMs,
  onKeyDown,
  onSetMenuIndex,
  onActivateMenuItem,
  onOpenNewOption,
  onCancel,
}: {
  view: View
  screenVariants: Variants
  menuTitle: string
  menuOptions: Array<{ id: string; label: string; isCustom: boolean }>
  menuDefaultOptionCount: number
  menuSupportsCustomRemove: boolean
  menuCursorVisible: boolean
  menuIndex: number
  menuSelectedIndex: number
  menuNewOptionIndex: number
  menuCancelIndex: number
  cancelLabel: string
  menuOptionStaggerMs: number
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  onSetMenuIndex: (index: number) => void
  onActivateMenuItem: (index: number) => void
  onOpenNewOption: () => void
  onCancel: () => void
}) {
  const defaultOptions = menuOptions.slice(0, menuDefaultOptionCount)
  const customOptions = menuOptions.slice(menuDefaultOptionCount)

  const renderOptionRow = (option: { id: string; label: string; isCustom: boolean }, index: number) => {
    const isActive = menuIndex === index
    const isCurrent = menuSelectedIndex === index
    const showRemove = menuSupportsCustomRemove && option.isCustom && isActive

    return (
      <div key={option.id} className="flex items-center gap-2">
        <div className="w-3 text-foreground">
          {menuCursorVisible && isActive ? '🡲' : '\u00A0'}
        </div>
        <button
          type="button"
          className={cn(
            'grid w-full max-w-[260px] cursor-pointer grid-cols-[1fr_56px] items-baseline gap-x-8 text-left outline-none transition-colors',
            isActive
              ? 'font-bold text-foreground'
              : 'font-medium text-muted-foreground hover:text-foreground',
          )}
          onMouseEnter={() => onSetMenuIndex(index)}
          onClick={() => onActivateMenuItem(index)}
        >
          <span>
            <MenuOption
              text={isCurrent ? `${option.label} (current)` : option.label}
              startDelayMs={index * menuOptionStaggerMs}
            />
          </span>
          <span className="justify-self-start">
            {showRemove ? (
              <span
                className={cn(
                  interactiveBaseClass,
                  'font-bold text-foreground motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100',
                )}
              >
                <MenuOption text="Remove" startDelayMs={0} />
              </span>
            ) : null}
          </span>
        </button>
      </div>
    )
  }

  return (
    <motion.section
      key={view}
      variants={screenVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex min-h-[calc(100vh-48px)] w-full max-w-shell flex-col content:min-h-[calc(100vh-96px)]"
    >
      <Header title={menuTitle} />

      <div
        className="grow max-w-content outline-none"
        tabIndex={0}
        data-screen-autofocus-view={view}
        onKeyDown={onKeyDown}
      >
        <div className="text-[12px] leading-6">
          {defaultOptions.map((option, index) => renderOptionRow(option, index))}

          <div className="h-4" />

          {customOptions.map((option, customIndex) =>
            renderOptionRow(option, menuDefaultOptionCount + customIndex),
          )}

          <div className="flex items-center gap-2">
            <div className="w-3 text-foreground">
              {menuCursorVisible && menuIndex === menuNewOptionIndex ? '🡲' : '\u00A0'}
            </div>
            <button
              type="button"
              className={cn(
                'cursor-pointer text-left leading-6 outline-none transition-colors',
                menuIndex === menuNewOptionIndex
                  ? 'font-bold text-foreground'
                  : 'font-medium text-muted-foreground hover:text-foreground',
              )}
              onMouseEnter={() => onSetMenuIndex(menuNewOptionIndex)}
              onClick={onOpenNewOption}
            >
              <MenuOption
                text="New option…"
                startDelayMs={menuNewOptionIndex * menuOptionStaggerMs}
              />
            </button>
          </div>

          <div className="h-4" />

          <div className="flex items-center gap-2">
            <div className="w-3 text-foreground">
              {menuCursorVisible && menuIndex === menuCancelIndex ? '🡲' : '\u00A0'}
            </div>
            <Action
              label={
                <MenuOption
                  text={cancelLabel}
                  startDelayMs={menuCancelIndex * menuOptionStaggerMs}
                />
              }
              onClick={onCancel}
              active={menuIndex === menuCancelIndex}
              onMouseEnter={() => onSetMenuIndex(menuCancelIndex)}
            />
          </div>
        </div>
      </div>
    </motion.section>
  )
}
