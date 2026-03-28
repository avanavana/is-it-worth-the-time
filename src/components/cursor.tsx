import { cn } from '@/lib/utils/display'

export function Cursor({
  className,
  active = true,
}: {
  className?: string
  active?: boolean
}) {
  return (
    <span
      data-terminal-cursor="true"
      className={cn(
        'inline-block h-[12px] w-[8px] bg-foreground transition-opacity',
        active ? 'opacity-100 animate-[terminal-blink_1s_steps(1,end)_infinite]' : 'opacity-0',
        className,
      )}
      aria-hidden="true"
    />
  )
}
