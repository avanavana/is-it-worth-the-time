import { cn } from '@/lib/utils/display'

function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('text-border font-bold font-mono', className)}
      {...props}
    >
      /
    </div>
  )
}

Separator.displayName = 'Separator'

export { Separator }
