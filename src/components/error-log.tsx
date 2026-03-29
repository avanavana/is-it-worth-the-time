import { MenuOption } from '@/components/menu-option'

export interface TerminalErrorEntry {
  id: number
  message: string
}

export function ErrorLog({
  errors,
  startDelayMs = 0,
}: {
  errors: TerminalErrorEntry[]
  startDelayMs?: number
}) {
  if (errors.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      {errors.map((error, index) => (
        <p key={error.id} className="m-0 flex items-center text-[12px] font-medium leading-4 text-error">
          <span>[</span>
          <span className="mx-px inline-flex bg-error px-0.5 text-error-foreground">ERR!</span>
          <span>]</span>
          <span className="ml-1">
            <MenuOption text={error.message} startDelayMs={startDelayMs + index * 32} />
          </span>
        </p>
      ))}
    </div>
  )
}
