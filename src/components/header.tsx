import { cn } from '@/lib/utils/display'

import { AnimatedTypography } from '@/components/animated-typography'

export function Header({
  title,
  typewriter = false,
  spacingClassName = 'mb-6',
}: {
  title: string
  typewriter?: boolean
  spacingClassName?: string
}) {
  return (
    <header className={cn('w-full max-w-content', spacingClassName)}>
      <h1 className="m-0 text-[12px] font-bold leading-none text-foreground">
        {typewriter ? <AnimatedTypography text={title} /> : title}
      </h1>
    </header>
  )
}
