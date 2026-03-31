import { createPortal } from 'react-dom'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react'
import { motion, type Variants } from 'motion/react'

import { LIFETIME_PRESETS_YEARS } from '@/lib/utils/defaults'
import type { CalendarBasis, FrequencyColumn, SavingsRow } from '@/types'
import { cn } from '@/lib/utils/display'
import {
  TABLE_CURSOR_BACK_INDEX,
  TABLE_TOOLTIP_OFFSET_X,
  TABLE_TOOLTIP_OFFSET_Y,
} from '@/lib/constants/table'

import { PageFooter } from '@/components/footer'
import { TableCell } from '@/components/table-cell'
import { Action } from '@/components/action'
import { AnimatedSlot } from '@/components/animated-slot'
import { AnimatedTypography } from '@/components/animated-typography'
import { Cursor } from '@/components/cursor'
import { Header } from '@/components/header'
import { InlineSelectTrigger } from '@/components/inline-select-trigger'
import { Separator } from '@/components/separator'
import { Slider } from '@/components/slider'
import { Tooltip } from '@/components/tooltip'

export function TableScreen({
  screenVariants,
  onKeyDown,
  activeTableCursorIndex,
  onTableAction,
  tableResetIndex,
  hasResettableChanges,
  tableText1,
  tableFlowStep1,
  tableText2,
  tableFlowStep2,
  lifetimeLongLabel,
  lifetimePeriodLabel,
  lifetimeShortLabel,
  tableLifetimeCursorIndex,
  tableDecrementCursorIndex,
  tableIncrementCursorIndex,
  tableCanDecrementLifetime,
  tableCanIncrementLifetime,
  tableSliderTrackRef,
  onLifetimeIndicatorPointerDown,
  tableSliderIndicatorPositionClass,
  tableLifetimeSliderPercent,
  tableSliderLeftKeyActive,
  tableSliderRightKeyActive,
  tableSliderIndicatorCursorIndex,
  tableScrollKeycapClass,
  tableLifetimeIndex,
  onSetLifetimeFromSliderIndex,
  tableScrollViewportRef,
  onHideTableTooltip,
  columns,
  rows,
  lifetimeYears,
  calendarBasis,
  customDaysPerYear,
  displayMode,
  significantDigits,
  onApproximateCellEnter,
  onApproximateCellMove,
  onApproximateCellLeave,
  tableTooltip,
  canShowTableScrollControl,
  tableScrollCursorIndex,
  onSetTableCursorIndex,
  onScrollTableByStep,
  tableCanScrollLeft,
  tableCanScrollRight,
  tableScrollLeftKeyActive,
  tableScrollRightKeyActive,
  tableRowsEditCursorIndex,
  tableColumnsEditCursorIndex,
  tableFooterStartIndex,
  onFooterAction,
  onToggleCommands,
  onCommandToggleAvailabilityChange,
  autoHideKeyCommands,
}: {
  screenVariants: Variants
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  activeTableCursorIndex: number
  onTableAction: (index: number) => void
  tableResetIndex: number
  hasResettableChanges: boolean
  tableText1: string
  tableFlowStep1: number
  tableText2: string
  tableFlowStep2: number
  lifetimeLongLabel: string
  lifetimePeriodLabel: string
  lifetimeShortLabel: string
  tableLifetimeCursorIndex: number
  tableDecrementCursorIndex: number
  tableIncrementCursorIndex: number
  tableCanDecrementLifetime: boolean
  tableCanIncrementLifetime: boolean
  tableSliderTrackRef: RefObject<HTMLDivElement | null>
  onLifetimeIndicatorPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  tableSliderIndicatorPositionClass: string
  tableLifetimeSliderPercent: number
  tableSliderLeftKeyActive: boolean
  tableSliderRightKeyActive: boolean
  tableSliderIndicatorCursorIndex: number
  tableScrollKeycapClass: (active: boolean, disabled: boolean) => string
  tableLifetimeIndex: number
  onSetLifetimeFromSliderIndex: (index: number) => void
  tableScrollViewportRef: RefObject<HTMLDivElement | null>
  onHideTableTooltip: () => void
  columns: FrequencyColumn[]
  rows: SavingsRow[]
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
  tableTooltip: { key: string; text: string; x: number; y: number } | null
  canShowTableScrollControl: boolean
  tableScrollCursorIndex: number
  onSetTableCursorIndex: (index: number) => void
  onScrollTableByStep: (direction: -1 | 1) => void
  tableCanScrollLeft: boolean
  tableCanScrollRight: boolean
  tableScrollLeftKeyActive: boolean
  tableScrollRightKeyActive: boolean
  tableRowsEditCursorIndex: number
  tableColumnsEditCursorIndex: number
  tableFooterStartIndex: number
  onFooterAction: (index: number) => void
  onToggleCommands: (nextVisible: boolean) => void
  onCommandToggleAvailabilityChange: (available: boolean) => void
  autoHideKeyCommands: boolean
}) {
  return (
    <motion.section
      key="table"
      variants={screenVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex min-h-[calc(100vh-48px)] content:min-h-[calc(100vh-96px)] w-full max-w-shell flex-col outline-none"
      tabIndex={0}
      data-screen-autofocus-view="table"
      onKeyDown={onKeyDown}
    >
      <Header title="Is It Worth the Time?" />

      <div className="grow">
        <div className="mb-8 flex min-h-[17px] items-center gap-4 text-[12px]">
          <Action
            label="🡨 Back"
            onClick={() => onTableAction(TABLE_CURSOR_BACK_INDEX)}
            active={activeTableCursorIndex === TABLE_CURSOR_BACK_INDEX}
          />
          {hasResettableChanges ? (
            <>
              <Separator aria-hidden className="leading-4" />
              <Action
                label="⟲ Reset to defaults"
                onClick={() => onTableAction(tableResetIndex)}
                active={activeTableCursorIndex === tableResetIndex}
              />
            </>
          ) : null}
        </div>

        <div className="mb-8 flex max-w-[760px] items-start text-[12px]">
          <p className="m-0 text-[12px] font-medium leading-6 text-muted-foreground">
            <AnimatedTypography text={tableText1} />
            <AnimatedSlot delaySteps={tableFlowStep1}>
              <span className="mr-[12px] inline-flex">
                <Action
                  label={<InlineSelectTrigger text={lifetimeLongLabel} />}
                  onClick={() => onTableAction(tableLifetimeCursorIndex)}
                  active={activeTableCursorIndex === tableLifetimeCursorIndex}
                  variant="strong"
                  cursorClassName="-translate-y-[58%]"
                  className="leading-4"
                />
              </span>
            </AnimatedSlot>
            <AnimatedTypography text={tableText2} delaySteps={tableFlowStep2} />
          </p>
        </div>

        <div className="mb-8 w-full max-w-content">
          <div className="mb-1 flex items-center gap-3 text-[12px]">
            <Action
              label="-"
              ariaLabel="Decrease calculation period"
              onClick={() => onTableAction(tableDecrementCursorIndex)}
              active={activeTableCursorIndex === tableDecrementCursorIndex}
              disabled={!tableCanDecrementLifetime}
              variant="strong"
              cursorOutside
            />
            <div ref={tableSliderTrackRef} className="relative flex-1 pt-5">
              <button
                type="button"
                aria-label={`Current period: ${lifetimePeriodLabel}. Activate and use left or right arrow keys to adjust.`}
                onClick={() => onSetTableCursorIndex(tableSliderIndicatorCursorIndex)}
                onPointerDown={onLifetimeIndicatorPointerDown}
                className={cn(
                  'group absolute top-0 inline-flex cursor-pointer items-center gap-1 pr-[12px] text-[10px] font-bold text-foreground focus-visible:outline-none',
                  tableSliderIndicatorPositionClass,
                )}
                style={{ left: `${tableLifetimeSliderPercent}%` }}
              >
                {tableCanDecrementLifetime ? (
                  <kbd className={tableScrollKeycapClass(tableSliderLeftKeyActive, false)}>🡨</kbd>
                ) : null}
                <span className="relative inline-flex items-center whitespace-nowrap pb-[1px] leading-4 transition-colors before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-px before:w-full before:bg-underline after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-foreground after:opacity-0 motion-safe:after:opacity-100 motion-safe:after:origin-right motion-safe:after:scale-x-0 motion-safe:after:transition-transform motion-safe:after:duration-300 motion-safe:hover:after:origin-left motion-safe:hover:after:scale-x-100 motion-reduce:after:scale-x-100 motion-reduce:after:transition-opacity motion-reduce:after:duration-150 motion-reduce:hover:after:opacity-100 focus-visible:outline-none group-hover:motion-safe:after:origin-left group-hover:motion-safe:after:scale-x-100 group-hover:motion-reduce:after:opacity-100">
                  {lifetimeShortLabel}
                </span>
                {tableCanIncrementLifetime ? (
                  <kbd className={tableScrollKeycapClass(tableSliderRightKeyActive, false)}>🡪</kbd>
                ) : null}
                <Cursor
                  active={activeTableCursorIndex === tableSliderIndicatorCursorIndex}
                  className="absolute right-0 top-1/2 -translate-y-1/2"
                />
              </button>
              <Slider
                aria-label="Lifetime"
                value={[tableLifetimeIndex]}
                min={0}
                max={LIFETIME_PRESETS_YEARS.length - 1}
                step={1}
                onValueChange={(value) => {
                  const index = Math.round(value[0] ?? tableLifetimeIndex)
                  onSetLifetimeFromSliderIndex(index)
                }}
                className="py-2 **:data-[slot=slider-track]:h-px **:data-[slot=slider-track]:rounded-none **:data-[slot=slider-track]:bg-underline **:data-[slot=slider-range]:bg-foreground"
                thumbProps={{
                  'aria-label': 'Lifetime period slider',
                  className:
                    'size-[44px] rounded-none border-0 bg-transparent opacity-0 shadow-none hover:ring-0 active:ring-0 focus-visible:ring-0',
                }}
              />
            </div>
            <Action
              label="+"
              ariaLabel="Increase calculation period"
              onClick={() => onTableAction(tableIncrementCursorIndex)}
              active={activeTableCursorIndex === tableIncrementCursorIndex}
              disabled={!tableCanIncrementLifetime}
              variant="strong"
              cursorOutside
            />
          </div>
        </div>

        <div
          ref={tableScrollViewportRef}
          onMouseLeave={onHideTableTooltip}
          className="w-full max-w-content overflow-x-auto pb-2 max-table:max-w-none max-table:w-[calc(100%+3rem)] max-table:-mr-12 max-content:w-[calc(100%+1.5rem)] max-content:-mr-6"
        >
          <div className="w-fit cursor-default select-none text-[10px] max-table:pr-12 max-content:pr-6">
            <div className="grid" style={{ gridTemplateColumns: `46px repeat(${columns.length}, 99px)` }}>
              <div className="sticky left-0 z-20 h-6 bg-background" />
              {columns.map((column) => (
                <div key={column.id} className="flex h-6 items-center justify-center font-bold text-foreground">
                  {column.label}
                </div>
              ))}

              {rows.map((row, rowIndex) => (
                <TableCell
                  key={row.id}
                  row={row}
                  columns={columns}
                  isLastRow={rowIndex === rows.length - 1}
                  lifetimeYears={lifetimeYears}
                  calendarBasis={calendarBasis}
                  customDaysPerYear={customDaysPerYear}
                  displayMode={displayMode}
                  significantDigits={significantDigits}
                  onApproximateCellEnter={onApproximateCellEnter}
                  onApproximateCellMove={onApproximateCellMove}
                  onApproximateCellLeave={onApproximateCellLeave}
                />
              ))}
            </div>
          </div>
        </div>

        {tableTooltip && typeof document !== 'undefined'
          ? createPortal(
              <div
                className="pointer-events-none fixed z-50 rounded-none border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground"
                style={{
                  left: tableTooltip.x + TABLE_TOOLTIP_OFFSET_X,
                  top: tableTooltip.y + TABLE_TOOLTIP_OFFSET_Y,
                }}
                aria-hidden="true"
              >
                <Tooltip key={`${tableTooltip.key}-${tableTooltip.text}`} text={tableTooltip.text} />
              </div>,
              document.body,
            )
          : null}

        {canShowTableScrollControl ? (
          <div className="mt-2 w-full max-w-content text-[10px] text-muted-foreground max-table:max-w-none max-table:w-[calc(100%+3rem)] max-table:-mr-12 max-table:pr-12 max-content:w-[calc(100%+1.5rem)] max-content:-mr-6 max-content:pr-6">
            <div className="flex items-start justify-between gap-4">
              <div className="grid min-w-0 grow grid-cols-[46px_minmax(0,1fr)] items-baseline gap-x-2">
                <span className="text-right">Rows:</span>
                <span className="relative inline-flex items-center">
                  <span>Time saved per task (</span>
                  <Action
                    label="Edit"
                    onClick={() => onTableAction(tableRowsEditCursorIndex)}
                    onMouseEnter={() => onSetTableCursorIndex(tableRowsEditCursorIndex)}
                    active={activeTableCursorIndex === tableRowsEditCursorIndex}
                    showCursor={false}
                  />
                  <span>)</span>
                  <Cursor
                    active={activeTableCursorIndex === tableRowsEditCursorIndex}
                    className="absolute left-full ml-1 top-1/2 -translate-y-1/2"
                  />
                </span>
              </div>
              <div className="relative inline-flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Scroll table left"
                  onClick={() => {
                    onSetTableCursorIndex(tableScrollCursorIndex)
                    onScrollTableByStep(-1)
                  }}
                  onMouseEnter={() => onSetTableCursorIndex(tableScrollCursorIndex)}
                  disabled={!tableCanScrollLeft}
                  className="focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
                >
                  <kbd className={tableScrollKeycapClass(tableScrollLeftKeyActive, !tableCanScrollLeft)}>🡨</kbd>
                </button>
                <Action
                  label="Scroll"
                  onClick={() => onSetTableCursorIndex(tableScrollCursorIndex)}
                  onMouseEnter={() => onSetTableCursorIndex(tableScrollCursorIndex)}
                  active={activeTableCursorIndex === tableScrollCursorIndex}
                  showCursor={false}
                />
                <button
                  type="button"
                  aria-label="Scroll table right"
                  onClick={() => {
                    onSetTableCursorIndex(tableScrollCursorIndex)
                    onScrollTableByStep(1)
                  }}
                  onMouseEnter={() => onSetTableCursorIndex(tableScrollCursorIndex)}
                  disabled={!tableCanScrollRight}
                  className="focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
                >
                  <kbd className={tableScrollKeycapClass(tableScrollRightKeyActive, !tableCanScrollRight)}>🡪</kbd>
                </button>
                <Cursor
                  active={activeTableCursorIndex === tableScrollCursorIndex}
                  className="absolute left-full top-1/2 ml-1 -translate-y-1/2"
                />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-[46px_minmax(0,1fr)] items-baseline gap-x-2">
              <span className="text-right">Cols:</span>
              <span className="relative inline-flex items-center">
                <span>Task frequency (</span>
                <Action
                  label="Edit"
                  onClick={() => onTableAction(tableColumnsEditCursorIndex)}
                  onMouseEnter={() => onSetTableCursorIndex(tableColumnsEditCursorIndex)}
                  active={activeTableCursorIndex === tableColumnsEditCursorIndex}
                  showCursor={false}
                />
                <span>)</span>
                <Cursor
                  active={activeTableCursorIndex === tableColumnsEditCursorIndex}
                  className="absolute left-full ml-1 top-1/2 -translate-y-1/2"
                />
              </span>
            </div>

            <div className="mt-2 grid grid-cols-[46px_minmax(0,1fr)] items-center gap-x-2">
              <span className="inline-flex justify-end">
                <span className="inline-block size-[12px] border border-border bg-hatch" />
              </span>
              <span>Not Possible</span>
            </div>
          </div>
        ) : (
          <div className="mt-2 w-full max-w-content pl-[46px] text-[10px] text-muted-foreground">
            <div className="grid w-full grid-cols-[max-content_1fr_max-content_1fr_max-content] items-center">
              <span className="relative inline-flex items-center">
                <span>Rows: Time saved per task (</span>
                <Action
                  label="Edit"
                  onClick={() => onTableAction(tableRowsEditCursorIndex)}
                  onMouseEnter={() => onSetTableCursorIndex(tableRowsEditCursorIndex)}
                  active={activeTableCursorIndex === tableRowsEditCursorIndex}
                  showCursor={false}
                />
                <span>)</span>
                <Cursor
                  active={activeTableCursorIndex === tableRowsEditCursorIndex}
                  className="absolute left-full ml-1 top-1/2 -translate-y-1/2"
                />
              </span>
              <span className="flex justify-center">
                <Separator />
              </span>
              <span className="relative inline-flex items-center">
                <span>Columns: Task frequency (</span>
                <Action
                  label="Edit"
                  onClick={() => onTableAction(tableColumnsEditCursorIndex)}
                  onMouseEnter={() => onSetTableCursorIndex(tableColumnsEditCursorIndex)}
                  active={activeTableCursorIndex === tableColumnsEditCursorIndex}
                  showCursor={false}
                />
                <span>)</span>
                <Cursor
                  active={activeTableCursorIndex === tableColumnsEditCursorIndex}
                  className="absolute left-full ml-1 top-1/2 -translate-y-1/2"
                />
              </span>
              <span className="flex justify-center">
                <Separator />
              </span>
              <span className="inline-flex items-center gap-1.5 justify-self-end">
                <span className="inline-block size-[12px] border border-border bg-hatch" />
                Not Possible
              </span>
            </div>
          </div>
        )}

        {calendarBasis === 'workdays' ? (
          <p className="mt-2 text-[10px] text-muted-foreground">
            *based on an 8-hour work day, 40-hour work week, and 260-day work year
          </p>
        ) : null}
      </div>

      <PageFooter
        activeIndex={
          activeTableCursorIndex >= tableFooterStartIndex
            ? activeTableCursorIndex - tableFooterStartIndex
            : -1
        }
        onAction={onFooterAction}
        onToggleCommands={onToggleCommands}
        onCommandToggleAvailabilityChange={onCommandToggleAvailabilityChange}
        keyboardCommandsEnabled={autoHideKeyCommands}
        keyboardCommandsVisible
      />
    </motion.section>
  )
}
