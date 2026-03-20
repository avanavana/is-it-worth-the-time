import { useMemo, useState } from 'react'
import NumberFlow from '@number-flow/react'
import { AlertTriangle } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { SUSPICIOUS_SECONDS_THRESHOLD } from '../../constants'
import { getCellDetails } from '../../calculations'
import {
  formatExactText,
  formatForTable,
  formatHumanizedText,
  formatInspectorSeconds,
} from '../../formatters'
import type { CalendarBasis, CellDetails, DisplayMode, FrequencyColumn, SavingsRow } from '../../types'

interface BreakEvenCellProps {
  row: SavingsRow
  column: FrequencyColumn
  lifetimeYears: number
  basis: CalendarBasis
  customDaysPerYear: number
  displayMode: DisplayMode
  significantDigits: number
  highlighted: boolean
  onHoverChange: (rowId: string | null, columnId: string | null) => void
  onSelect: (details: CellDetails) => void
}

export function BreakEvenCell({
  row,
  column,
  lifetimeYears,
  basis,
  customDaysPerYear,
  displayMode,
  significantDigits,
  highlighted,
  onHoverChange,
  onSelect,
}: BreakEvenCellProps) {
  const [open, setOpen] = useState(false)

  const details = useMemo(
    () => getCellDetails(row, column, lifetimeYears, basis, customDaysPerYear),
    [row, column, lifetimeYears, basis, customDaysPerYear],
  )

  const tableValue = useMemo(
    () => formatForTable(details.totalSavedSeconds, displayMode, significantDigits),
    [details.totalSavedSeconds, displayMode, significantDigits],
  )

  const suspicious = details.totalSavedSeconds > SUSPICIOUS_SECONDS_THRESHOLD

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group relative flex h-20 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1 dark:border-slate-800 dark:bg-slate-950',
            highlighted && 'border-cyan-300 bg-cyan-50/40 dark:border-cyan-700 dark:bg-cyan-950/20',
            suspicious && 'opacity-60',
          )}
          onMouseEnter={() => {
            onHoverChange(row.id, column.id)
            setOpen(true)
          }}
          onMouseLeave={() => {
            onHoverChange(null, null)
            setOpen(false)
          }}
          onFocus={() => {
            onHoverChange(row.id, column.id)
            setOpen(true)
          }}
          onBlur={() => {
            onHoverChange(null, null)
            setOpen(false)
          }}
          onClick={() => {
            onSelect(details)
            setOpen((current) => !current)
          }}
          aria-label={`Break-even value for ${row.label} and ${column.label}: ${tableValue.ariaLabel}`}
        >
          <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {tableValue.tokens.map((token, index) => (
              <span key={`${token.unit}-${index}`} className="inline-flex items-baseline gap-0.5">
                <NumberFlow
                  value={token.value}
                  format={
                    displayMode === 'exact'
                      ? { maximumSignificantDigits: significantDigits }
                      : { maximumFractionDigits: 0 }
                  }
                  className="tabular-nums"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">{token.unit}</span>
              </span>
            ))}
          </span>

          {suspicious ? (
            <span className="absolute top-1 right-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span aria-label="Suspiciously large value">
                    <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  This value exceeds 10 years. Double-check assumptions.
                </TooltipContent>
              </Tooltip>
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="center" className="w-80 space-y-3 text-sm">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">Calculation inspector</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {row.label} saved at {column.label.toLowerCase()} frequency
          </p>
        </div>
        <dl className="space-y-1.5 text-xs">
          <InspectorLine label="Time saved per run" value={formatInspectorSeconds(details.secondsSavedPerRun)} />
          <InspectorLine label="Runs per year" value={formatInteger(details.runsPerYear)} />
          <InspectorLine label="Task lifetime" value={`${strip(details.lifetimeYears)} years`} />
          <InspectorLine label="Total runs" value={formatInteger(details.totalRuns)} />
          <InspectorLine label="Total time saved" value={formatHumanizedText(details.totalSavedSeconds)} />
          <InspectorLine
            label="Break-even optimization time"
            value={
              displayMode === 'exact'
                ? formatExactText(details.totalSavedSeconds, significantDigits)
                : formatHumanizedText(details.totalSavedSeconds)
            }
          />
        </dl>
      </PopoverContent>
    </Popover>
  )
}

function InspectorLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-2">
      <dt className="text-slate-500 dark:text-slate-400">{label}:</dt>
      <dd className="text-right font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  )
}

function formatInteger(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function strip(value: number) {
  return Number.parseFloat(value.toFixed(2)).toString()
}
