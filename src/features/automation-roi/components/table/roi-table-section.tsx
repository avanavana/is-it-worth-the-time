import { useEffect, useRef, useState, type ReactNode } from 'react'
import NumberFlow from '@number-flow/react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { getRunsPerYear, isImpossibleCell } from '../../calculations'
import { MAX_COLUMNS } from '../../constants'
import {
  formatCompactCellDisplay,
  formatExactDaysTooltipText,
  formatForTable,
  formatPreciseTooltipText,
} from '../../formatters'
import { parseFrequencyInput, parseTimeSavedInput } from '../../parsers'
import type { CalendarBasis, DisplayMode, FrequencyColumn, SavingsRow } from '../../types'

interface ROITableSectionProps {
  rows: SavingsRow[]
  columns: FrequencyColumn[]
  lifetimeYears: number
  basis: CalendarBasis
  customDaysPerYear: number
  displayMode: DisplayMode
  significantDigits: number
  onAddRow: (payload: { label: string; seconds: number }) => void
  onUpdateRow: (id: string, payload: { label: string; seconds: number }) => void
  onDeleteRow: (id: string) => void
  onAddColumn: (payload: { label: string; amount: number; unit: 'day' | 'week' | 'month' | 'year' }) => void
  onUpdateColumn: (
    id: string,
    payload: { label: string; amount: number; unit: 'day' | 'week' | 'month' | 'year' },
  ) => void
  onDeleteColumn: (id: string) => void
  headerAction?: ReactNode
}

type EditorState =
  | { kind: 'new-row'; value: string }
  | { kind: 'new-column'; value: string }
  | { kind: 'edit-row'; id: string; value: string }
  | { kind: 'edit-column'; id: string; value: string }
  | null

const CELL_WIDTH = 112
const ROW_HEIGHT = 66
const HEADER_HEIGHT = 42
const HEADER_GAP = 8
const ROW_LABEL_WIDTH = 54
const Y_LABEL_WIDTH = 48
const THIN_SIZE = 26
const ROW_FOOTER_SPACE = THIN_SIZE + 22
const COLUMN_HOVER_ZONE_WIDTH = 64
const ADD_BAR_OUTER_OFFSET = 2
const ADD_BAR_INNER_OFFSET = 2

export function ROITableSection({
  rows,
  columns,
  lifetimeYears,
  basis,
  customDaysPerYear,
  displayMode,
  significantDigits,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onAddColumn,
  onUpdateColumn,
  onDeleteColumn,
  headerAction,
}: ROITableSectionProps) {
  const [editor, setEditor] = useState<EditorState>(null)
  const [hoverRightZone, setHoverRightZone] = useState(false)
  const [hoverBottomZone, setHoverBottomZone] = useState(false)
  const [cellTooltip, setCellTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const newColumnInputRef = useRef<HTMLInputElement | null>(null)
  const newRowInputRef = useRef<HTMLInputElement | null>(null)

  const showDraftColumn = editor?.kind === 'new-column'
  const showDraftRow = editor?.kind === 'new-row'
  const canAddColumn = columns.length < MAX_COLUMNS
  const canDeleteColumn = columns.length > 1
  const canDeleteRow = rows.length > 1
  const showThinColumn = !editor && hoverRightZone && canAddColumn
  const showThinRow = !editor && hoverBottomZone

  const visibleColumns = showDraftColumn
    ? [...columns, ({ id: '__draft-column__', label: '', amount: 1, unit: 'day', isCustom: true } as const)]
    : columns

  const visibleRows = showDraftRow
    ? [...rows, ({ id: '__draft-row__', label: '', seconds: 0, isCustom: true } as const)]
    : rows

  const matrixWidth = visibleColumns.length * CELL_WIDTH
  const matrixHeight = visibleRows.length * ROW_HEIGHT
  const matrixTop = HEADER_HEIGHT + HEADER_GAP
  const editorKind = editor?.kind ?? null

  useEffect(() => {
    if (editorKind === 'new-column' && newColumnInputRef.current) {
      const timer = window.setTimeout(() => {
        newColumnInputRef.current?.focus()
        newColumnInputRef.current?.select()
      }, 0)

      return () => window.clearTimeout(timer)
    }

    if (editorKind === 'new-row' && newRowInputRef.current) {
      const timer = window.setTimeout(() => {
        newRowInputRef.current?.focus()
        newRowInputRef.current?.select()
      }, 0)

      return () => window.clearTimeout(timer)
    }
  }, [editorKind])

  function commitEditor() {
    if (!editor) {
      return
    }

    const trimmed = editor.value.trim()

    if (!trimmed) {
      setEditor(null)
      return
    }

    if (editor.kind === 'new-row' || editor.kind === 'edit-row') {
      const parsed = parseTimeSavedInput(trimmed)

      if (!parsed.ok) {
        toast.error(parsed.error)
        setEditor(null)
        return
      }

      if (editor.kind === 'new-row') {
        onAddRow({ label: parsed.label, seconds: parsed.seconds })
      } else {
        onUpdateRow(editor.id, { label: parsed.label, seconds: parsed.seconds })
      }

      setEditor(null)
      return
    }

    const parsed = parseFrequencyInput(trimmed)

    if (!parsed.ok) {
      toast.error(parsed.error)
      setEditor(null)
      return
    }

    if (editor.kind === 'new-column') {
      if (columns.length >= MAX_COLUMNS) {
        toast.error(`Maximum ${MAX_COLUMNS} columns allowed.`)
        setEditor(null)
        return
      }

      onAddColumn({ label: parsed.label, amount: parsed.amount, unit: parsed.unit })
    } else {
      onUpdateColumn(editor.id, {
        label: parsed.label,
        amount: parsed.amount,
        unit: parsed.unit,
      })
    }

    setEditor(null)
  }

  function cancelEditor() {
    setEditor(null)
  }

  return (
    <div>
      <div className="mx-auto w-fit mb-12">
        <div className="relative mb-2" style={{ width: matrixWidth }}>
          <p className="text-center text-sm font-medium text-muted-foreground">How often do you do it?</p>
          {headerAction ? <div className="absolute top-0 right-0">{headerAction}</div> : null}
        </div>

        <div className="relative pb-[48px]" style={{ width: matrixWidth }}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${visibleColumns.length}, ${CELL_WIDTH}px)`,
              height: HEADER_HEIGHT,
            }}
          >
            {visibleColumns.map((column) => {
              if (column.id === '__draft-column__') {
                return (
                  <div key={column.id} className="px-1">
                    <Input
                      ref={newColumnInputRef}
                      value={editor?.kind === 'new-column' ? editor.value : ''}
                      className="h-8 text-center"
                      placeholder="3/day"
                      onChange={(event) => setEditor({ kind: 'new-column', value: event.target.value })}
                      onBlur={commitEditor}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitEditor()
                        if (event.key === 'Escape') cancelEditor()
                      }}
                    />
                  </div>
                )
              }

              const isEditing = editor?.kind === 'edit-column' && editor.id === column.id

              return (
                <div key={column.id} className="px-1 text-center text-sm font-semibold leading-[42px]">
                  {isEditing ? (
                    <Input
                      autoFocus
                      value={editor.value}
                      className="mt-1 h-8 text-center"
                      onChange={(event) =>
                        setEditor({ kind: 'edit-column', id: column.id, value: event.target.value })
                      }
                      onBlur={commitEditor}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitEditor()
                        if (event.key === 'Escape') cancelEditor()
                      }}
                    />
                  ) : (
                    <div
                      className="group relative mx-auto h-full w-full"
                      onDoubleClick={() => {
                        if (column.isCustom && !editor) {
                          setEditor({
                            kind: 'edit-column',
                            id: column.id,
                            value: `${strip(column.amount)}/${column.unit}`,
                          })
                        }
                      }}
                    >
                      <div
                        className={cn(
                          'flex h-full items-center justify-center text-sm transition-opacity',
                          canDeleteColumn && 'group-hover:opacity-0',
                        )}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{column.label}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {formatRuns(getRunsPerYear(column, basis, customDaysPerYear))} runs per year
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {canDeleteColumn ? (
                        <button
                          type="button"
                          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => onDeleteColumn(column.id)}
                          aria-label={`Delete ${column.label}`}
                        >
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                            <X className="size-3" />
                            Remove
                          </span>
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div
            className="relative mt-2 rounded-md border border-border bg-background overflow-hidden"
            style={{ width: matrixWidth, height: matrixHeight }}
            onMouseLeave={() => setCellTooltip(null)}
          >
            <div
              className="grid h-full"
              style={{
                gridTemplateColumns: `repeat(${visibleColumns.length}, ${CELL_WIDTH}px)`,
                gridTemplateRows: `repeat(${visibleRows.length}, ${ROW_HEIGHT}px)`,
              }}
            >
              {visibleRows.map((row, rowIndex) =>
                visibleColumns.map((column, columnIndex) => {
                  const borderClass = cn(
                    columnIndex < visibleColumns.length - 1 && 'border-r border-border',
                    rowIndex < visibleRows.length - 1 && 'border-b border-border',
                  )

                  if (row.id === '__draft-row__' || column.id === '__draft-column__') {
                    return (
                      <div key={`${row.id}-${column.id}`} className={cn('bg-muted/20', borderClass)} />
                    )
                  }

                  const runsPerYear = getRunsPerYear(column, basis, customDaysPerYear)
                  const impossible = isImpossibleCell(row.seconds, column)

                  if (impossible) {
                    return (
                      <div
                        key={`${row.id}-${column.id}`}
                        className={cn(
                          'flex items-center justify-center bg-muted/30 text-muted',
                          borderClass,
                        )}
                      >
                        —
                      </div>
                    )
                  }

                  const totalSeconds = row.seconds * runsPerYear * lifetimeYears
                  const hoverText = formatPreciseTooltipText(totalSeconds)

                  if (displayMode === 'exact') {
                    const tableValue = formatForTable(totalSeconds, displayMode, significantDigits)

                    return (
                      <div key={`${row.id}-${column.id}`} className={borderClass}>
                        <button
                          type="button"
                          className="flex h-full w-full items-center justify-center bg-background text-sm transition-colors hover:bg-muted/40"
                          aria-label={tableValue.ariaLabel}
                        >
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            {tableValue.tokens.map((token, index) => (
                              <span key={`${token.unit}-${index}`} className="inline-flex items-baseline gap-0.5">
                                <NumberFlow
                                  value={token.value}
                                  format={{ maximumSignificantDigits: significantDigits }}
                                />
                                <span className="text-xs">{token.unit}</span>
                              </span>
                            ))}
                          </span>
                        </button>
                      </div>
                    )
                  }

                  const compact = formatCompactCellDisplay(totalSeconds)
                  const shouldShowDaysTooltip =
                    compact.unit === 'mo' || compact.unit === 'yr' || compact.unit === 'yrs'
                  const shouldShowTooltip = compact.approx || shouldShowDaysTooltip
                  const tooltipText = shouldShowDaysTooltip
                    ? formatExactDaysTooltipText(totalSeconds)
                    : hoverText

                  return (
                    <div key={`${row.id}-${column.id}`} className={borderClass}>
                      <button
                        type="button"
                        className="flex h-full w-full items-center justify-center bg-background text-sm transition-colors hover:bg-muted/40"
                        aria-label={`${compact.approx ? 'approximately ' : ''}${compact.value} ${compact.unit}`}
                        onMouseEnter={
                          shouldShowTooltip
                            ? (event) =>
                                setCellTooltip({ x: event.clientX, y: event.clientY - 10, text: tooltipText })
                            : () => setCellTooltip(null)
                        }
                        onMouseMove={
                          shouldShowTooltip
                            ? (event) =>
                                setCellTooltip((current) =>
                                  current
                                    ? { ...current, x: event.clientX, y: event.clientY - 10, text: tooltipText }
                                    : { x: event.clientX, y: event.clientY - 10, text: tooltipText },
                                )
                            : undefined
                        }
                        onMouseLeave={shouldShowTooltip ? () => setCellTooltip(null) : undefined}
                      >
                        <span className="inline-flex items-baseline gap-0.5 tabular-nums">
                          {compact.approx ? <span>~</span> : null}
                          <NumberFlow value={compact.value} format={{ maximumFractionDigits: 2 }} />
                          <span>{compact.unit}</span>
                        </span>
                      </button>
                    </div>
                  )
                }),
              )}
            </div>
          </div>

          <div
            className="absolute"
            style={{
              left: -ROW_LABEL_WIDTH,
              top: matrixTop,
              width: ROW_LABEL_WIDTH,
            }}
          >
            {visibleRows.map((row) => {
              const isDraftRow = row.id === '__draft-row__'
              const isEditingRow = editor?.kind === 'edit-row' && editor.id === row.id

              return (
                <div
                  key={`row-label-${row.id}`}
                  className="flex items-center justify-end pr-2 text-right text-sm font-semibold whitespace-nowrap"
                  style={{ height: ROW_HEIGHT }}
                >
                  {isDraftRow ? (
                    <Input
                      ref={newRowInputRef}
                      value={editor?.kind === 'new-row' ? editor.value : ''}
                      className="h-8"
                      placeholder="45 sec"
                      onChange={(event) => setEditor({ kind: 'new-row', value: event.target.value })}
                      onBlur={commitEditor}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitEditor()
                        if (event.key === 'Escape') cancelEditor()
                      }}
                    />
                  ) : isEditingRow ? (
                    <Input
                      autoFocus
                      value={editor.value}
                      className="h-8"
                      onChange={(event) =>
                        setEditor({ kind: 'edit-row', id: row.id, value: event.target.value })
                      }
                      onBlur={commitEditor}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitEditor()
                        if (event.key === 'Escape') cancelEditor()
                      }}
                    />
                  ) : (
                    <div
                      className="group relative h-full w-full"
                      onDoubleClick={() => {
                        if (row.isCustom && !editor) {
                          setEditor({ kind: 'edit-row', id: row.id, value: row.label })
                        }
                      }}
                    >
                      <span
                        className={cn(
                          'inline-flex h-full w-full items-center justify-end transition-opacity',
                          canDeleteRow && 'group-hover:opacity-0',
                        )}
                      >
                        {row.label}
                      </span>
                      {canDeleteRow ? (
                        <button
                          type="button"
                          className="absolute inset-0 flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => onDeleteRow(row.id)}
                          aria-label={`Delete ${row.label}`}
                        >
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                            <X className="size-3" />
                            Remove
                          </span>
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div
            className="absolute flex items-center justify-center"
            style={{
              left: -(ROW_LABEL_WIDTH + Y_LABEL_WIDTH + 8),
              top: matrixTop,
              width: Y_LABEL_WIDTH,
              height: matrixHeight,
            }}
          >
            <p className="-rotate-90 whitespace-nowrap text-sm text-muted-foreground">
              How much time will you save every time?
            </p>
          </div>

          {!editor && canAddColumn ? (
            <div
              className="absolute z-10"
              style={{
                left: matrixWidth + ADD_BAR_OUTER_OFFSET,
                top: matrixTop,
                width: COLUMN_HOVER_ZONE_WIDTH,
                height: matrixHeight,
              }}
              onMouseEnter={() => setHoverRightZone(true)}
              onMouseMove={() => setHoverRightZone(true)}
              onMouseLeave={() => setHoverRightZone(false)}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Add column"
                    className={cn(
                      'absolute z-20 flex items-center justify-center rounded-md bg-muted/45 text-muted-foreground transition-all hover:bg-muted/65 hover:text-foreground',
                      showThinColumn ? 'opacity-100' : 'pointer-events-none opacity-0',
                    )}
                    style={{
                      left: ADD_BAR_INNER_OFFSET,
                      top: 0,
                      width: THIN_SIZE,
                      height: matrixHeight,
                    }}
                    onMouseEnter={() => setHoverRightZone(true)}
                    onMouseLeave={() => setHoverRightZone(false)}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      setEditor({ kind: 'new-column', value: '' })
                      setHoverRightZone(false)
                    }}
                  >
                    <Plus className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="pointer-events-none">Add column</TooltipContent>
              </Tooltip>
            </div>
          ) : null}

          {!editor ? (
            <div
              className="absolute z-10"
              style={{
                left: 0,
                top: matrixTop + matrixHeight + ADD_BAR_OUTER_OFFSET,
                width: matrixWidth,
                height: ROW_FOOTER_SPACE,
              }}
              onMouseEnter={() => setHoverBottomZone(true)}
              onMouseMove={() => setHoverBottomZone(true)}
              onMouseLeave={() => setHoverBottomZone(false)}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Add row"
                    className={cn(
                      'absolute z-20 flex items-center justify-center rounded-md bg-muted/45 text-muted-foreground transition-all hover:bg-muted/65 hover:text-foreground',
                      showThinRow ? 'opacity-100' : 'pointer-events-none opacity-0',
                    )}
                    style={{
                      left: 0,
                      top: ADD_BAR_INNER_OFFSET,
                      width: matrixWidth,
                      height: THIN_SIZE,
                    }}
                    onMouseEnter={() => setHoverBottomZone(true)}
                    onMouseLeave={() => setHoverBottomZone(false)}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      setEditor({ kind: 'new-row', value: '' })
                      setHoverBottomZone(false)
                    }}
                  >
                    <Plus className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="pointer-events-none">Add row</TooltipContent>
              </Tooltip>
            </div>
          ) : null}

          {cellTooltip && displayMode !== 'exact' ? (
            <div
              className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md"
              style={{ left: cellTooltip.x, top: cellTooltip.y }}
            >
              {cellTooltip.text}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function strip(value: number) {
  return Number.parseFloat(value.toFixed(4)).toString()
}

function formatRuns(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}
