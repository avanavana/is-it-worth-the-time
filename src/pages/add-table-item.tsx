import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { motion, type Variants } from 'motion/react'

import { Action } from '@/components/action'
import { Cursor } from '@/components/cursor'
import { ErrorLog, type TerminalErrorEntry } from '@/components/error-log'
import { Header } from '@/components/header'
import { MenuOption } from '@/components/menu-option'

export function AddTableItemScreen({
  keyName,
  screenVariants,
  title,
  fieldLabel,
  draft,
  inputId,
  inputRef,
  cursorIndex,
  cancelRef,
  errors,
  examples,
  menuOptionStaggerMs,
  autofocusView,
  onKeyDown,
  onDraftChange,
  onSetCursorIndex,
  onSubmit,
  onCancel,
}: {
  keyName: string
  screenVariants: Variants
  title: string
  fieldLabel: string
  draft: string
  inputId: string
  inputRef: RefObject<HTMLInputElement | null>
  cursorIndex: number
  cancelRef: RefObject<HTMLButtonElement | null>
  errors: TerminalErrorEntry[]
  examples: string[]
  menuOptionStaggerMs: number
  autofocusView: 'add-column' | 'add-row'
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  onDraftChange: (value: string) => void
  onSetCursorIndex: (index: number) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <motion.section
      key={keyName}
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
          <div className="space-y-6">
            <label
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground"
              htmlFor={inputId}
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
                  id={inputId}
                  ref={inputRef}
                  data-screen-autofocus-view={autofocusView}
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  className="w-0 border-0 bg-transparent p-0 text-[12px] font-bold text-foreground caret-transparent outline-none"
                  style={{ width: `${Math.max(1, draft.length)}ch` }}
                  autoComplete="off"
                  spellCheck={false}
                  onFocus={() => onSetCursorIndex(0)}
                />
                <Cursor active={cursorIndex === 0} />
              </span>
            </label>

            <ErrorLog errors={errors} />
          </div>

          <div className="space-y-3">
            <Action
              label={<MenuOption text="Cancel" startDelayMs={menuOptionStaggerMs} />}
              onClick={onCancel}
              active={cursorIndex === 1}
              buttonRef={cancelRef}
              onMouseEnter={() => onSetCursorIndex(1)}
            />
          </div>
        </form>

        <div className="mt-10 text-[12px] leading-5 text-muted-foreground">
          <p className="m-0 font-bold text-foreground">
            <MenuOption text="Examples" startDelayMs={menuOptionStaggerMs * 2} />
          </p>
          {examples.map((example, index) => (
            <p key={example} className={index === 0 ? 'mt-2' : undefined}>
              <MenuOption
                text={example}
                startDelayMs={menuOptionStaggerMs * (index + 3)}
              />
            </p>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
