import { RotateCcw, Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

import type { CalendarBasis, DisplayMode } from '../../types'

interface ControlsPanelProps {
  lifetimeYears: number
  calendarBasis: CalendarBasis
  customDaysPerYear: number
  displayMode: DisplayMode
  significantDigits: number
  onLifetimeChange: (value: number) => void
  onCalendarBasisChange: (value: CalendarBasis) => void
  onCustomDaysPerYearChange: (value: number) => void
  onDisplayModeChange: (value: DisplayMode) => void
  onSignificantDigitsChange: (value: number) => void
  onReset: () => void
}

export function ControlsPanel({
  lifetimeYears,
  calendarBasis,
  customDaysPerYear,
  displayMode,
  significantDigits,
  onLifetimeChange,
  onCalendarBasisChange,
  onCustomDaysPerYearChange,
  onDisplayModeChange,
  onSignificantDigitsChange,
  onReset,
}: ControlsPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Controls</CardTitle>
          <div className="flex items-center gap-2">
            <DisplaySettingsMenu
              displayMode={displayMode}
              significantDigits={significantDigits}
              onDisplayModeChange={onDisplayModeChange}
              onSignificantDigitsChange={onSignificantDigitsChange}
            />
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw className="size-4" />
              Reset defaults
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="lifetime-input" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Task lifetime (years)
            </label>
            <Input
              id="lifetime-input"
              type="number"
              step={0.1}
              min={0.1}
              max={25}
              value={lifetimeYears}
              onChange={(event) => onLifetimeChange(Number(event.target.value))}
              className="h-8 w-28"
            />
          </div>
          <Slider
            value={[lifetimeYears]}
            min={0.1}
            max={25}
            step={0.1}
            onValueChange={(value) => onLifetimeChange(value[0] ?? lifetimeYears)}
            aria-label="Task lifetime years"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Range: 0.1 to 25 years
          </p>
        </div>

        <div className="space-y-3">
          <label htmlFor="calendar-basis" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Calendar basis
          </label>
          <Select
            value={calendarBasis}
            onValueChange={(value) => onCalendarBasisChange(value as CalendarBasis)}
          >
            <SelectTrigger id="calendar-basis">
              <SelectValue placeholder="Select calendar basis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="calendar">Calendar days (365 runs/yr)</SelectItem>
              <SelectItem value="workdays">Workdays (250 runs/yr)</SelectItem>
              <SelectItem value="custom">Custom days/year</SelectItem>
            </SelectContent>
          </Select>
          {calendarBasis === 'custom' ? (
            <div className="space-y-2">
              <label htmlFor="custom-days" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Custom days per year
              </label>
              <Input
                id="custom-days"
                type="number"
                min={1}
                max={366}
                value={customDaysPerYear}
                onChange={(event) => onCustomDaysPerYearChange(Number(event.target.value))}
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
          <p className="font-medium">Table behavior</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Every cell recomputes in real time when these controls change. Hover or focus any
            value to inspect assumptions and totals.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function DisplaySettingsMenu({
  displayMode,
  significantDigits,
  onDisplayModeChange,
  onSignificantDigitsChange,
}: {
  displayMode: DisplayMode
  significantDigits: number
  onDisplayModeChange: (value: DisplayMode) => void
  onSignificantDigitsChange: (value: number) => void
}) {
  const exactMode = displayMode === 'exact'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="size-4" />
          Display
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <DropdownMenuLabel className="px-0">Display mode</DropdownMenuLabel>
        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
          <div>
            <p className="text-sm font-medium">Exact values</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toggle between exact and humanized formatting.
            </p>
          </div>
          <Switch
            checked={exactMode}
            onCheckedChange={(checked) => onDisplayModeChange(checked ? 'exact' : 'humanized')}
            aria-label="Toggle exact values"
          />
        </div>

        <DropdownMenuSeparator className="my-3" />
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Significant digits</p>
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
