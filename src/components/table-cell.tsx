import type { MouseEvent as ReactMouseEvent } from 'react'
import NumberFlow from '@number-flow/react'

import { cn } from '@/lib/utils/display'

import {
  calculateBreakEvenSeconds,
  getRunsPerYear,
  isImpossibleCell,
} from '@/lib/utils/calculations'
import {
  formatCompactCellDisplay,
  formatForTable,
  formatNonApproximateCellTooltipText,
  formatPreciseTooltipText,
} from '@/lib/utils/formatters'
import type { CalendarBasis, FrequencyColumn, SavingsRow } from '@/types'

export function TableCell({
  row,
  columns,
  isLastRow,
  lifetimeYears,
  calendarBasis,
  customDaysPerYear,
  displayMode,
  significantDigits,
  onApproximateCellEnter,
  onApproximateCellMove,
  onApproximateCellLeave,
}: {
  row: SavingsRow
  columns: FrequencyColumn[]
  isLastRow: boolean
  lifetimeYears: number
  calendarBasis: CalendarBasis
  customDaysPerYear: number
  displayMode: 'humanized' | 'exact'
  significantDigits: number
  onApproximateCellEnter: (
    key: string,
    text: string,
    event: ReactMouseEvent<HTMLElement>,
  ) => void
  onApproximateCellMove: (key: string, event: ReactMouseEvent<HTMLElement>) => void
  onApproximateCellLeave: (key: string) => void
}) {
  return (
    <>
      <div className="sticky left-0 z-10 flex h-6 cursor-default select-none items-center justify-end border-r border-border bg-background pr-2 text-[10px] font-bold text-foreground">
        {row.label}
      </div>
      {columns.map((column, columnIndex) => {
        const borderClass = cn(
          'border-t border-border',
          columnIndex > 0 && 'border-l',
          columnIndex === columns.length - 1 && 'border-r',
          isLastRow && 'border-b',
        )
        const impossible = isImpossibleCell(row.seconds, column)

        if (impossible) {
          return (
            <div
              key={`${row.id}-${column.id}`}
              className={cn(
                'flex h-6 cursor-default select-none items-center justify-center bg-hatch',
                borderClass,
              )}
            />
          )
        }

        const runsPerYear = getRunsPerYear(column, calendarBasis, customDaysPerYear)
        const seconds = calculateBreakEvenSeconds(row.seconds, runsPerYear, lifetimeYears)
        if (displayMode === 'exact') {
          const formatted = formatForTable(seconds, displayMode, significantDigits)

          return (
            <div
              key={`${row.id}-${column.id}`}
              className={cn(
                'flex h-6 cursor-default select-none items-center justify-center text-[10px] text-muted-foreground',
                borderClass,
              )}
            >
              <div className="whitespace-nowrap text-center leading-[14px]">
                {formatted.tokens.map((token, index) => (
                  <span key={`${token.unit}-${index}`} className="inline-flex items-baseline gap-0.5">
                    <NumberFlow value={token.value} format={{ maximumSignificantDigits: significantDigits }} />
                    <span>{token.unit}</span>
                  </span>
                ))}
              </div>
            </div>
          )
        }

        const compact = formatCompactCellDisplay(seconds)
        const cellKey = `${row.id}-${column.id}`
        const tooltipText = compact.approx
          ? formatPreciseTooltipText(seconds)
          : formatNonApproximateCellTooltipText(seconds, compact)
        const hasCellTooltip = tooltipText !== null

        return (
          <div
            key={cellKey}
            className={cn(
              'flex h-6 cursor-default select-none items-center justify-center text-[10px] text-muted-foreground',
              borderClass,
            )}
            onMouseEnter={
              hasCellTooltip
                ? (event) => onApproximateCellEnter(cellKey, tooltipText, event)
                : undefined
            }
            onMouseMove={
              hasCellTooltip
                ? (event) => onApproximateCellMove(cellKey, event)
                : undefined
            }
            onMouseLeave={hasCellTooltip ? () => onApproximateCellLeave(cellKey) : undefined}
          >
            <span className="inline-flex items-baseline gap-0.5 whitespace-nowrap text-center leading-[14px]">
              {compact.approx ? <span>~</span> : null}
              <NumberFlow value={compact.value} format={{ maximumFractionDigits: 2 }} />
              <span>{compact.unit}</span>
            </span>
          </div>
        )
      })}
    </>
  )
}
