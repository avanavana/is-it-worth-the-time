import type { ReactNode, Ref } from 'react'

import { interactiveBaseClass } from '@/lib/constants/view'
import { cn } from '@/lib/utils/display'

import { Cursor } from '@/components/cursor'

export function Action({
  label,
  onClick,
  active = false,
  disabled = false,
  variant = 'muted',
  cursorClassName,
  cursorOutside = true,
  showCursor = true,
  underlineTight = false,
  className,
  buttonRef,
  onMouseEnter,
  onFocus,
  ariaLabel,
}: {
  label: ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  variant?: 'muted' | 'strong'
  cursorClassName?: string
  cursorOutside?: boolean
  showCursor?: boolean
  underlineTight?: boolean
  className?: string
  buttonRef?: Ref<HTMLButtonElement>
  onMouseEnter?: () => void
  onFocus?: () => void
  ariaLabel?: string
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      disabled={disabled}
      className={cn(
        interactiveBaseClass,
        'group',
        cursorOutside ? 'pr-0' : 'pr-[12px]',
        underlineTight && 'pb-0 before:bottom-px after:bottom-px',
        active &&
          'motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100',
        variant === 'strong' || active
          ? 'font-bold text-foreground'
          : 'font-medium text-muted-foreground hover:text-foreground',
        disabled && 'pointer-events-none opacity-30',
        className,
      )}
    >
      {label}
      {showCursor ? (
        <Cursor
          active={active}
          className={cn(
            cursorOutside
              ? 'absolute left-full ml-1 top-1/2 -translate-y-1/2'
              : 'absolute right-0 top-1/2 -translate-y-1/2',
            cursorClassName,
          )}
        />
      ) : null}
    </button>
  )
}
