import type { PropsWithChildren } from 'react'
import { useTheme } from 'next-themes'
import { Toaster } from 'sonner'

export function ToastProvider({ children }: PropsWithChildren) {
  const { resolvedTheme } = useTheme()

  return (
    <>
      {children}
      <Toaster richColors theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />
    </>
  )
}
