import { cn } from '@/lib/utils'

const footerInteractiveBaseClass =
  "relative inline-flex items-center whitespace-nowrap pb-[1px] transition-colors before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-[2px] before:w-full before:bg-[#e6e6e6] dark:before:bg-[#363636] after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-right after:scale-x-0 after:bg-foreground after:transition-transform after:duration-300 hover:after:origin-left hover:after:scale-x-100 focus-visible:outline-none"

interface PageFooterProps {
  onAction: (index: number) => void
  themeLabel: string
  activeIndex?: number
  className?: string
  revealCount?: number
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
        active ? 'font-bold text-foreground after:origin-left after:scale-x-100' : 'font-medium text-muted-foreground hover:text-foreground',
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
  themeLabel,
  activeIndex = -1,
  className,
  revealCount,
}: PageFooterProps) {
  const actions = [
    'Created by Avana Vana 🡭',
    'Inspired by xkcd 🡭',
    'View on Github 🡭',
    `Theme: ${themeLabel} ⏷`,
  ]
  const visibleCount = revealCount === undefined ? actions.length : Math.max(0, Math.min(actions.length, revealCount))

  return (
    <footer className={cn('mt-auto flex flex-wrap items-center gap-x-8 gap-y-2 pt-12 text-[10px] text-muted-foreground', className)}>
      {actions.slice(0, visibleCount).map((label, index) => (
        <FooterAction
          key={label}
          label={label}
          onClick={() => onAction(index)}
          active={activeIndex === index}
        />
      ))}
    </footer>
  )
}
