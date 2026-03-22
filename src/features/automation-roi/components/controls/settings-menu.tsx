import { Menu, RotateCcw } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { CalendarBasis, DisplayMode } from '../../types'

interface SettingsMenuProps {
  calendarBasis: CalendarBasis
  customDaysPerYear: number
  displayMode: DisplayMode
  significantDigits: number
  onCalendarBasisChange: (value: CalendarBasis) => void
  onCustomDaysPerYearChange: (value: number) => void
  onDisplayModeChange: (value: DisplayMode) => void
  onSignificantDigitsChange: (value: number) => void
  onReset: () => void
  showReset?: boolean
  trigger?: ReactNode
}

export function SettingsMenu({
  calendarBasis,
  customDaysPerYear,
  displayMode,
  significantDigits,
  onCalendarBasisChange,
  onCustomDaysPerYearChange,
  onDisplayModeChange,
  onSignificantDigitsChange,
  onReset,
  showReset = true,
  trigger,
}: SettingsMenuProps) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <>
      {typeof document !== 'undefined'
        ? createPortal(
            <div
              aria-hidden="true"
              className={
                open
                  ? 'fixed inset-0 z-40 bg-background/50 opacity-100 backdrop-blur-md transition-[opacity,backdrop-filter] duration-300 ease-out'
                  : 'pointer-events-none fixed inset-0 z-40 bg-background/50 opacity-0 backdrop-blur-[0px] transition-[opacity,backdrop-filter] duration-300 ease-out'
              }
              onClick={() => setOpen(false)}
            />,
            document.body,
          )
        : null}

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="icon" aria-label="Open settings">
              <Menu className="size-5" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-0">
          <div className="space-y-3 p-3 text-sm">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Calendar basis</p>
              <Select
                value={calendarBasis}
                onValueChange={(value) => onCalendarBasisChange(value as CalendarBasis)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calendar">Calendar days (365) (default)</SelectItem>
                  <SelectItem value="workdays">Workdays (250)</SelectItem>
                  <SelectItem value="custom">Custom days/year</SelectItem>
                </SelectContent>
              </Select>
              {calendarBasis === 'custom' ? (
                <Input
                  type="number"
                  min={1}
                  max={366}
                  value={customDaysPerYear}
                  onChange={(event) => onCustomDaysPerYearChange(Number(event.target.value))}
                />
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Show exact values</span>
              <Switch
                checked={displayMode === 'exact'}
                onCheckedChange={(checked) => onDisplayModeChange(checked ? 'exact' : 'humanized')}
                aria-label="Toggle exact mode"
              />
            </div>

            {displayMode === 'exact' ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Significant digits</p>
                <Select
                  value={String(significantDigits)}
                  onValueChange={(value) => onSignificantDigitsChange(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="6">6</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {showReset ? (
              <Button variant="outline" size="sm" className="w-full" onClick={onReset}>
                <RotateCcw className="size-4" />
                Reset to defaults
              </Button>
            ) : null}
          </div>

          <Separator />

          <div className="space-y-1.5 p-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Theme</p>
            <Tabs value={theme ?? 'system'} onValueChange={(value) => setTheme(value)} className="w-full">
              <TabsList className="grid h-9 w-full grid-cols-3">
                <TabsTrigger value="system">System</TabsTrigger>
                <TabsTrigger value="light">Light</TabsTrigger>
                <TabsTrigger value="dark">Dark</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
