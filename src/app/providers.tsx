import type { PropsWithChildren } from 'react'
import { ThemeProvider } from 'next-themes'
import { useTheme } from 'next-themes'
import { Toaster } from 'sonner'

import { TooltipProvider } from '@/components/ui/tooltip'

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        {children}
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme()

  return <Toaster richColors theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />
}
