import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { motion, type Variants } from 'motion/react'

import { Action } from '@/components/action'
import { Cursor } from '@/components/cursor'
import { Header } from '@/components/header'
import { MenuOption } from '@/components/menu-option'
import type { MenuCustomKind } from '@/types'

export function AddMenuOptionScreen({
  screenVariants,
  title,
  fieldLabel,
  kind,
  draft,
  inputRef,
  cursorIndex,
  cancelRef,
  menuOptionStaggerMs,
  onKeyDown,
  onDraftChange,
  onSetCursorIndex,
  onSubmit,
  onCancel,
}: {
  screenVariants: Variants
  title: string
  fieldLabel: string
  kind: MenuCustomKind
  draft: string
  inputRef: RefObject<HTMLInputElement | null>
  cursorIndex: number
  cancelRef: RefObject<HTMLButtonElement | null>
  menuOptionStaggerMs: number
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  onDraftChange: (value: string) => void
  onSetCursorIndex: (index: number) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <motion.section
      key="add-menu-option"
      variants={screenVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex min-h-[calc(100vh-48px)] w-full max-w-shell flex-col content:min-h-[calc(100vh-96px)]"
      onKeyDown={onKeyDown}
    >
      <Header title={title} />

      <div className="grow max-w-content text-[12px]">
        <form
          className="space-y-10"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <label
            className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground"
            htmlFor="menu-option-input"
          >
            <MenuOption text={fieldLabel} startDelayMs={0} />
            <span
              className="inline-flex items-center"
              onMouseDown={(event) => {
                event.preventDefault()
                onSetCursorIndex(0)
                inputRef.current?.focus()
              }}
            >
              <input
                id="menu-option-input"
                ref={inputRef}
                data-screen-autofocus-view="add-menu-option"
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                className="w-0 border-0 bg-transparent p-0 text-[12px] font-bold text-foreground caret-transparent outline-none"
                style={{ width: `${draft.length}ch` }}
                autoComplete="off"
                spellCheck={false}
                onFocus={() => onSetCursorIndex(0)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    onCancel()
                  }
                }}
              />
              <Cursor active={cursorIndex === 0} />
            </span>
          </label>

          <div className="space-y-3">
            <div onMouseEnter={() => onSetCursorIndex(1)} onFocus={() => onSetCursorIndex(1)}>
              <Action
                label={<MenuOption text="Cancel" startDelayMs={menuOptionStaggerMs} />}
                onClick={onCancel}
                active={cursorIndex === 1}
                buttonRef={cancelRef}
              />
            </div>
          </div>
        </form>

        <div className="mt-10 text-[12px] leading-5 text-muted-foreground">
          <p className="m-0 font-bold text-foreground">
            <MenuOption text="Examples" startDelayMs={menuOptionStaggerMs * 2} />
          </p>
          {kind === 'frequency' ? (
            <>
              <p className="mt-2">
                <MenuOption text="50/day" startDelayMs={menuOptionStaggerMs * 3} />
              </p>
              <p>
                <MenuOption text="10 times per day" startDelayMs={menuOptionStaggerMs * 4} />
              </p>
              <p>
                <MenuOption text="Daily" startDelayMs={menuOptionStaggerMs * 5} />
              </p>
              <p>
                <MenuOption text="Biweekly" startDelayMs={menuOptionStaggerMs * 6} />
              </p>
              <p>
                <MenuOption text="2/y" startDelayMs={menuOptionStaggerMs * 7} />
              </p>
              <p>
                <MenuOption text="..." startDelayMs={menuOptionStaggerMs * 8} />
              </p>
              <p>
                <MenuOption text="etc" startDelayMs={menuOptionStaggerMs * 9} />
              </p>
            </>
          ) : null}
          {kind === 'time' ? (
            <>
              <p className="mt-2">
                <MenuOption text="10s" startDelayMs={menuOptionStaggerMs * 3} />
              </p>
              <p>
                <MenuOption text="one minute" startDelayMs={menuOptionStaggerMs * 4} />
              </p>
              <p>
                <MenuOption text="5 min" startDelayMs={menuOptionStaggerMs * 5} />
              </p>
              <p>
                <MenuOption text="2h" startDelayMs={menuOptionStaggerMs * 6} />
              </p>
              <p>
                <MenuOption text="five m" startDelayMs={menuOptionStaggerMs * 7} />
              </p>
              <p>
                <MenuOption text="..." startDelayMs={menuOptionStaggerMs * 8} />
              </p>
              <p>
                <MenuOption text="etc" startDelayMs={menuOptionStaggerMs * 9} />
              </p>
            </>
          ) : null}
          {kind === 'lifetime' ? (
            <>
              <p className="mt-2">
                <MenuOption text="5 years" startDelayMs={menuOptionStaggerMs * 3} />
              </p>
              <p>
                <MenuOption text="18 months" startDelayMs={menuOptionStaggerMs * 4} />
              </p>
              <p>
                <MenuOption text="2.5 years" startDelayMs={menuOptionStaggerMs * 5} />
              </p>
              <p>
                <MenuOption text="6 mo" startDelayMs={menuOptionStaggerMs * 6} />
              </p>
              <p>
                <MenuOption text="..." startDelayMs={menuOptionStaggerMs * 7} />
              </p>
              <p>
                <MenuOption text="etc" startDelayMs={menuOptionStaggerMs * 8} />
              </p>
            </>
          ) : null}
        </div>
      </div>
    </motion.section>
  )
}
