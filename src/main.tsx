import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { AppThemeProvider } from '@/lib/context/theme-context'
import { TooltipProvider } from '@/lib/context/tooltip-context'
import '@/styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </AppThemeProvider>
  </StrictMode>,
)
