import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Menu } from 'lucide-react'
import { toast } from 'sonner'

import { PageFooter } from '@/components/layout/page-footer'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'

import { DEFAULT_COLUMNS, DEFAULT_STATE, LIFETIME_PRESETS_YEARS } from '../defaults'
import { getDaysPerYear } from '../calculations'
import { SECONDS_IN_DAY } from '../constants'
import { parseDurationInput } from '../parsers'
import { savePersistedState } from '../storage'
import { useAutomationROIStore } from '../hooks/use-automation-roi-store'
import { SettingsMenu } from './controls/settings-menu'
import { FocusView } from './focus-view'
import { ROITableSection } from './table/roi-table-section'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function AutomationROIPage() {
  const {
    lifetimeYears,
    calendarBasis,
    customDaysPerYear,
    rows,
    columns,
    displayMode,
    significantDigits,
    setLifetimeYears,
    setCalendarBasis,
    setCustomDaysPerYear,
    setDisplayMode,
    setSignificantDigits,
    addCustomRow,
    updateCustomRow,
    deleteCustomRow,
    addCustomColumn,
    updateCustomColumn,
    deleteCustomColumn,
    resetDefaults,
  } = useAutomationROIStore()

  const [showTable, setShowTable] = useState(false)
  const [showLifetimeSliderTooltip, setShowLifetimeSliderTooltip] = useState(false)
  const [focusFrequency, setFocusFrequency] = useState(() => ({ ...DEFAULT_COLUMNS[1] }))
  const [focusTimeSavedSeconds, setFocusTimeSavedSeconds] = useState(60)
  const daysPerYear = getDaysPerYear(calendarBasis, customDaysPerYear)
  const isDefaultCalendarBasis = calendarBasis === 'calendar'
  const lifetimePresetIndex = getClosestLifetimePresetIndex(lifetimeYears)
  const lifetimeTooltipLabel = formatLifetimeAmount(lifetimeYears).replace(/\s+/g, '\u00A0')
  const lifetimeThumbPercent =
    (lifetimePresetIndex / (LIFETIME_PRESETS_YEARS.length - 1)) * 100
  const menuTrigger = (
    <Button variant="outline" size="icon">
      <Menu className="size-5" />
    </Button>
  )
  const hasResettableChanges = useMemo(
    () =>
      !isDefaultState({
        lifetimeYears,
        calendarBasis,
        customDaysPerYear,
        rows,
        columns,
        displayMode,
        significantDigits,
      }),
    [
      lifetimeYears,
      calendarBasis,
      customDaysPerYear,
      rows,
      columns,
      displayMode,
      significantDigits,
    ],
  )

  useEffect(() => {
    savePersistedState({
      lifetimeYears,
      calendarBasis,
      customDaysPerYear,
      rows,
      columns,
      displayMode,
      significantDigits,
    })
  }, [
    lifetimeYears,
    calendarBasis,
    customDaysPerYear,
    rows,
    columns,
    displayMode,
    significantDigits,
  ])

  return (
    <main className="mx-auto w-full min-h-screen max-w-[1300px] flex flex-col p-8">
      <div
        className={cn('relative grow', {
          'flex flex-col items-center justify-center': !showTable,
        })}
      >
        {!showTable ? (
          <div className="absolute top-0 right-0">
            <SettingsMenu
              calendarBasis={calendarBasis}
              customDaysPerYear={customDaysPerYear}
              displayMode={displayMode}
              significantDigits={significantDigits}
              onCalendarBasisChange={setCalendarBasis}
              onCustomDaysPerYearChange={setCustomDaysPerYear}
              onDisplayModeChange={setDisplayMode}
              onSignificantDigitsChange={setSignificantDigits}
              onReset={resetDefaults}
              showReset={hasResettableChanges}
              trigger={menuTrigger}
            />
          </div>
        ) : null}

        {showTable ? (
          <section className="space-y-12">
            <div className="mx-auto flex w-full max-w-[980px] items-center justify-between">
              <Button variant="outline" size="lg" onClick={() => setShowTable(false)}>
                <ArrowLeft className="size-5" />
                Close table
              </Button>
              <SettingsMenu
                calendarBasis={calendarBasis}
                customDaysPerYear={customDaysPerYear}
                displayMode={displayMode}
                significantDigits={significantDigits}
                onCalendarBasisChange={setCalendarBasis}
                onCustomDaysPerYearChange={setCustomDaysPerYear}
                onDisplayModeChange={setDisplayMode}
                onSignificantDigitsChange={setSignificantDigits}
                onReset={resetDefaults}
                showReset={hasResettableChanges}
                trigger={menuTrigger}
              />
            </div>

            <div className="space-y-12 text-center max-w-4xl mx-auto">
              <h1 className="text-5xl font-bold tracking-tight">Is It Worth the Time?</h1>
              <p className="text-3xl font-medium leading-snug text-muted-foreground">
                How much time can you afford to spend on optimizing or automating a repeated task over a{' '}
                  <InlinePeriodPicker value={lifetimeYears} onChange={setLifetimeYears} /> period?
              </p>
            </div>

            <div className="mx-auto flex w-full max-w-md items-center gap-3">
              <div className="relative flex-1">
                <div
                  className={cn(
                    'pointer-events-none absolute -top-8 z-20 w-max -translate-x-1/2 rounded-md bg-foreground px-3 py-1.5 text-xs text-background whitespace-nowrap shadow-md transition-opacity',
                    showLifetimeSliderTooltip ? 'opacity-100' : 'opacity-0',
                  )}
                  style={{ left: `${lifetimeThumbPercent}%` }}
                >
                  {lifetimeTooltipLabel}
                </div>

                <Slider
                  value={[lifetimePresetIndex]}
                  min={0}
                  max={LIFETIME_PRESETS_YEARS.length - 1}
                  step={1}
                  onValueChange={(value) => {
                    const index = Math.round(value[0] ?? lifetimePresetIndex)
                    const nextLifetime = LIFETIME_PRESETS_YEARS[index]
                    if (nextLifetime !== undefined) {
                      setLifetimeYears(nextLifetime)
                    }
                  }}
                  aria-label="Task lifetime years"
                  className="flex-1"
                  thumbProps={{
                    onPointerEnter: () => setShowLifetimeSliderTooltip(true),
                    onPointerLeave: () => setShowLifetimeSliderTooltip(false),
                    onFocus: () => setShowLifetimeSliderTooltip(true),
                    onBlur: () => setShowLifetimeSliderTooltip(false),
                  }}
                />
              </div>
            </div>

            <ROITableSection
              rows={rows}
              columns={columns}
              lifetimeYears={lifetimeYears}
              basis={calendarBasis}
              customDaysPerYear={customDaysPerYear}
              displayMode={displayMode}
              significantDigits={significantDigits}
              onAddRow={addCustomRow}
              onUpdateRow={updateCustomRow}
              onDeleteRow={deleteCustomRow}
              onAddColumn={addCustomColumn}
              onUpdateColumn={updateCustomColumn}
              onDeleteColumn={deleteCustomColumn}
            />
            {!isDefaultCalendarBasis ? (
              <p className="-mt-12 mb-12 text-center text-sm text-muted-foreground">{`* based on a calendar year of ${daysPerYear} days`}</p>
            ) : null}
          </section>
        ) : (
          <FocusView
            frequency={focusFrequency}
            onFrequencyChange={setFocusFrequency}
            timeSavedSeconds={focusTimeSavedSeconds}
            onTimeSavedSecondsChange={setFocusTimeSavedSeconds}
            lifetimeYears={lifetimeYears}
            onLifetimeYearsChange={setLifetimeYears}
            calendarBasis={calendarBasis}
            customDaysPerYear={customDaysPerYear}
            onShowTable={() => setShowTable(true)}
          />
        )}
      </div>

      <PageFooter />
    </main>
  )
}

function getClosestLifetimePresetIndex(value: number) {
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < LIFETIME_PRESETS_YEARS.length; index += 1) {
    const distance = Math.abs(LIFETIME_PRESETS_YEARS[index] - value)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  return bestIndex
}

function strip(value: number) {
  return Number.parseFloat(value.toFixed(2)).toString()
}

function formatLifetimePeriod(value: number) {
  if (value < 1) {
    return `${strip(value * 12)}-month`
  }

  return `${strip(value)}-year`
}

function formatLifetimeAmount(value: number) {
  if (value < 1) {
    const months = value * 12
    return `${strip(months)} ${months === 1 ? 'month' : 'months'}`
  }

  return `${strip(value)} ${value === 1 ? 'year' : 'years'}`
}

function isLifetimeUnitAllowedInPicker(unitLabel: string) {
  return unitLabel === 'day' || unitLabel === 'week' || unitLabel === 'mo' || unitLabel === 'yr'
}

function formatLifetimePeriodFromUnit(amount: number, unitLabel: string) {
  const value = strip(amount)

  if (unitLabel === 'day') {
    return `${value}-day`
  }

  if (unitLabel === 'week') {
    return `${value}-week`
  }

  if (unitLabel === 'mo') {
    return `${value}-month`
  }

  return `${value}-year`
}

function formatLifetimeOptionLabel(value: number) {
  if (value < 1) {
    const months = value * 12
    return `${strip(months)} ${months === 1 ? 'month' : 'months'}`
  }

  return `${strip(value)} ${value === 1 ? 'year' : 'years'}`
}

function InlinePeriodPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (next: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(formatLifetimePeriod(value))
  const [customDisplay, setCustomDisplay] = useState<string | null>(null)
  const [customDisplayYears, setCustomDisplayYears] = useState<number | null>(null)
  const editableRef = useRef<HTMLSpanElement | null>(null)
  const hasPlacedCaretRef = useRef(false)
  const skipNextBlurCommitRef = useRef(false)

  const selectedPhrase =
    customDisplay !== null && customDisplayYears !== null && nearlyEqual(value, customDisplayYears)
      ? customDisplay
      : formatLifetimePeriod(value)
  const showPlaceholder = open && text.length === 0
  const options =
    normalizeForSearch(text) === normalizeForSearch(selectedPhrase)
      ? LIFETIME_PRESETS_YEARS
      : LIFETIME_PRESETS_YEARS.filter((years) =>
          formatLifetimeOptionLabel(years).toLowerCase().includes(text.toLowerCase()),
        )
  const displayText = open ? text : selectedPhrase

  useEffect(() => {
    const node = editableRef.current
    if (!node) {
      return
    }

    if (node.textContent !== displayText) {
      node.textContent = displayText
    }

    if (open && !hasPlacedCaretRef.current) {
      placeCaretAtStart(node)
      hasPlacedCaretRef.current = true
    }

    if (!open) {
      hasPlacedCaretRef.current = false
    }
  }, [displayText, open])

  function commit() {
    if (text.trim().length === 0) {
      setText(selectedPhrase)
      setOpen(false)
      return
    }

    const parsed = parseDurationInput(text, 'year')

    if (!parsed.ok) {
      toast.error(parsed.error)
      setText(selectedPhrase)
      setOpen(false)
      return
    }

    if (!isLifetimeUnitAllowedInPicker(parsed.unitLabel)) {
      toast.error('Use days, weeks, months, or years.')
      setText(selectedPhrase)
      setOpen(false)
      return
    }

    const minSeconds = 7 * SECONDS_IN_DAY
    const maxSeconds = 25 * 365 * SECONDS_IN_DAY
    if (!Number.isFinite(parsed.seconds) || parsed.seconds < minSeconds || parsed.seconds > maxSeconds) {
      toast.error('Enter a period between 7 days and 25 years.')
      setText(selectedPhrase)
      setOpen(false)
      return
    }

    const years = parsed.seconds / (365 * SECONDS_IN_DAY)
    const display = formatLifetimePeriodFromUnit(parsed.amount, parsed.unitLabel)

    setCustomDisplay(display)
    setCustomDisplayYears(years)
    onChange(years)
    setText(display)
    setOpen(false)
  }

  function cancel() {
    setText(selectedPhrase)
    setOpen(false)
  }

  function openEditor() {
    if (open) {
      return
    }

    setText('')
    setOpen(true)
  }

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <span className="relative inline-grid min-w-[2ch]">
          {showPlaceholder ? (
            <span className="pointer-events-none col-start-1 row-start-1 select-none whitespace-nowrap text-muted-foreground/20 font-bold">
              {selectedPhrase}
            </span>
          ) : null}
          <span
            ref={editableRef}
            role="textbox"
            contentEditable
            suppressContentEditableWarning
            className="col-start-1 row-start-1 relative z-10 inline-block min-w-[2ch] cursor-text text-left font-bold text-foreground outline-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-1 after:bg-foreground after:origin-right after:transition-transform after:duration-300 after:scale-x-0 hover:after:origin-left hover:after:scale-x-100 focus:after:origin-left focus:after:scale-x-100"
            onClick={(event) => {
              event.stopPropagation()
              openEditor()
            }}
            onFocus={openEditor}
            onInput={(event) => setText(event.currentTarget.textContent ?? '')}
            onBlur={() => {
              if (skipNextBlurCommitRef.current) {
                skipNextBlurCommitRef.current = false
                return
              }

              commit()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                cancel()
                event.currentTarget.blur()
              }
            }}
          />
        </span>
      </PopoverAnchor>
      <PopoverContent align="center" className="w-72 p-2" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="space-y-1">
          {options.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">No matching presets</div>
          ) : (
            options.map((years) => {
              const label = formatLifetimeOptionLabel(years)
              return (
                <button
                  key={String(years)}
                  type="button"
                  className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    skipNextBlurCommitRef.current = true
                    editableRef.current?.blur()
                    onChange(years)
                    setCustomDisplay(null)
                    setCustomDisplayYears(years)
                    setText(formatLifetimePeriod(years))
                    setOpen(false)
                  }}
                >
                  {label}
                  {years === value ? <Check className="ml-auto size-4" /> : null}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function placeCaretAtStart(node: HTMLElement) {
  const selection = window.getSelection()
  if (!selection) {
    return
  }

  const range = document.createRange()
  range.selectNodeContents(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function normalizeForSearch(value: string) {
  return value.trim().toLowerCase()
}

function nearlyEqual(a: number, b: number) {
  return Math.abs(a - b) < 0.0001
}

function isDefaultState(state: {
  lifetimeYears: number
  calendarBasis: (typeof DEFAULT_STATE)['calendarBasis']
  customDaysPerYear: number
  rows: (typeof DEFAULT_STATE)['rows']
  columns: (typeof DEFAULT_STATE)['columns']
  displayMode: (typeof DEFAULT_STATE)['displayMode']
  significantDigits: number
}) {
  return (
    state.lifetimeYears === DEFAULT_STATE.lifetimeYears &&
    state.calendarBasis === DEFAULT_STATE.calendarBasis &&
    state.customDaysPerYear === DEFAULT_STATE.customDaysPerYear &&
    state.displayMode === DEFAULT_STATE.displayMode &&
    state.significantDigits === DEFAULT_STATE.significantDigits &&
    sameRows(state.rows, DEFAULT_STATE.rows) &&
    sameColumns(state.columns, DEFAULT_STATE.columns)
  )
}

function sameRows(a: typeof DEFAULT_STATE.rows, b: typeof DEFAULT_STATE.rows) {
  if (a.length !== b.length) {
    return false
  }

  return a.every(
    (row, index) =>
      row.id === b[index].id &&
      row.label === b[index].label &&
      row.seconds === b[index].seconds &&
      row.isCustom === b[index].isCustom,
  )
}

function sameColumns(a: typeof DEFAULT_STATE.columns, b: typeof DEFAULT_STATE.columns) {
  if (a.length !== b.length) {
    return false
  }

  return a.every(
    (column, index) =>
      column.id === b[index].id &&
      column.label === b[index].label &&
      column.amount === b[index].amount &&
      column.unit === b[index].unit &&
      column.isCustom === b[index].isCustom,
  )
}
