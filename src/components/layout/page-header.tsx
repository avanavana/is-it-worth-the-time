import type { ReactNode } from 'react'

export function PageHeader({ actions }: { actions: ReactNode }) {
  return (
    <header className="relative">
      <div className="absolute top-0 right-0">{actions}</div>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Is It Worth the Time?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          How much time can you afford to spend working on optimizing or automating a
          repeated task?
        </p>
      </div>
    </header>
  )
}
