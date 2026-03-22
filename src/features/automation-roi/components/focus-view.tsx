import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import NumberFlow from '@number-flow/react'
import { AudioWaveform, Calendar, Check, Hourglass, ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'

import { calculateBreakEvenSeconds, getDaysPerYear, getRunsPerYear, isImpossibleCell } from '../calculations'
import { DEFAULT_COLUMNS, DEFAULT_ROWS, LIFETIME_PRESETS_YEARS } from '../defaults'
import { formatCompactCellDisplay } from '../formatters'
import { parseDurationInput, parseFrequencyInput, parseTimeSavedInput } from '../parsers'
import type { CalendarBasis, FrequencyColumn } from '../types'

interface FocusViewProps {
  frequency: FrequencyColumn
  onFrequencyChange: (value: FrequencyColumn) => void
  timeSavedSeconds: number
  onTimeSavedSecondsChange: (value: number) => void
  lifetimeYears: number
  onLifetimeYearsChange: (value: number) => void
  calendarBasis: CalendarBasis
  customDaysPerYear: number
  onShowTable: () => void
}

const revealContainerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.04,
    },
  },
}
const revealItemVariants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(2px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.42,
    },
  },
}

export function FocusView({
  frequency,
  onFrequencyChange,
  timeSavedSeconds,
  onTimeSavedSecondsChange,
  lifetimeYears,
  onLifetimeYearsChange,
  calendarBasis,
  customDaysPerYear,
  onShowTable,
}: FocusViewProps) {
  const [openField, setOpenField] = useState<'frequency' | 'time' | 'lifetime' | null>(null)

  const [frequencyText, setFrequencyText] = useState(toFrequencyPhrase(frequency))
  const [timeText, setTimeText] = useState(toTimePhrase(timeSavedSeconds))
  const [lifetimeText, setLifetimeText] = useState(formatLifetimePhrase(lifetimeYears))

  const runsPerYear = getRunsPerYear(frequency, calendarBasis, customDaysPerYear)
  const daysPerYear = getDaysPerYear(calendarBasis, customDaysPerYear)
  const isDefaultCalendarBasis = calendarBasis === 'calendar'
  const impossible = isImpossibleCell(timeSavedSeconds, frequency)
  const breakEvenSeconds = calculateBreakEvenSeconds(timeSavedSeconds, runsPerYear, lifetimeYears)
  const compact = formatCompactCellDisplay(breakEvenSeconds)

  const frequencyOptions = useMemo(
    () => [
      { label: '50 times a day', value: { ...DEFAULT_COLUMNS[0] } },
      { label: '5 times a day', value: { ...DEFAULT_COLUMNS[1] } },
      { label: 'Daily', value: { ...DEFAULT_COLUMNS[2] } },
      { label: 'Weekly', value: { ...DEFAULT_COLUMNS[3] } },
      { label: 'Monthly', value: { ...DEFAULT_COLUMNS[4] } },
      { label: 'Yearly', value: { ...DEFAULT_COLUMNS[5] } },
    ],
    [],
  )

  const timeOptions = useMemo(
    () =>
      DEFAULT_ROWS.map((row) => ({
        label: toTimePhrase(row.seconds),
        seconds: row.seconds,
      })),
    [],
  )

  const currentFrequencyPhrase = toFrequencyPhrase(frequency)
  const currentTimePhrase = toTimePhrase(timeSavedSeconds)
  const currentLifetimePhrase = formatLifetimePhrase(lifetimeYears)

  const filteredFrequencyOptions =
    normalizeForSearch(frequencyText) === normalizeForSearch(currentFrequencyPhrase)
      ? frequencyOptions
      : frequencyOptions.filter((option) =>
          option.label.toLowerCase().includes(frequencyText.toLowerCase()),
        )

  const filteredTimeOptions =
    normalizeForSearch(timeText) === normalizeForSearch(currentTimePhrase)
      ? timeOptions
      : timeOptions.filter((option) => option.label.toLowerCase().includes(timeText.toLowerCase()))

  const filteredLifetimeOptions =
    normalizeForSearch(lifetimeText) === normalizeForSearch(currentLifetimePhrase)
      ? LIFETIME_PRESETS_YEARS
      : LIFETIME_PRESETS_YEARS.filter((years) =>
          formatLifetimePhrase(years).toLowerCase().includes(lifetimeText.toLowerCase()),
        )
  function openToken(field: 'frequency' | 'time' | 'lifetime') {
    if (openField === field) {
      return
    }

    setOpenField(field)

    if (field === 'frequency') {
      setFrequencyText('')
    }

    if (field === 'time') {
      setTimeText('')
    }

    if (field === 'lifetime') {
      setLifetimeText('')
    }
  }

  function commitFrequencyText() {
    if (frequencyText.trim().length === 0) {
      setFrequencyText(toFrequencyPhrase(frequency))
      setOpenField(null)
      return
    }

    const parsed = parseFrequencyInput(frequencyText)

    if (!parsed.ok) {
      toast.error(parsed.error)
      setFrequencyText(toFrequencyPhrase(frequency))
      setOpenField(null)
      return
    }

    onFrequencyChange({
      id: `focus-frequency-${parsed.unit}-${parsed.amount}`,
      label: parsed.label,
      amount: parsed.amount,
      unit: parsed.unit,
      isCustom: true,
    })
    setFrequencyText(toFrequencyPhrase({ ...frequency, amount: parsed.amount, unit: parsed.unit }))
    setOpenField(null)
  }

  function commitTimeText() {
    if (timeText.trim().length === 0) {
      setTimeText(toTimePhrase(timeSavedSeconds))
      setOpenField(null)
      return
    }

    const parsed = parseTimeSavedInput(timeText)

    if (!parsed.ok) {
      toast.error(parsed.error)
      setTimeText(toTimePhrase(timeSavedSeconds))
      setOpenField(null)
      return
    }

    onTimeSavedSecondsChange(parsed.seconds)
    setTimeText(toTimePhrase(parsed.seconds))
    setOpenField(null)
  }

  function commitLifetimeText() {
    if (lifetimeText.trim().length === 0) {
      setLifetimeText(formatLifetimePhrase(lifetimeYears))
      setOpenField(null)
      return
    }

    const parsed = parseDurationInput(lifetimeText, 'year')

    if (!parsed.ok) {
      toast.error(parsed.error)
      setLifetimeText(formatLifetimePhrase(lifetimeYears))
      setOpenField(null)
      return
    }

    const years = parsed.seconds / (86400 * 365)

    if (!Number.isFinite(years) || years < 0.1 || years > 25) {
      toast.error('Enter a period between 0.1 and 25 years.')
      setLifetimeText(formatLifetimePhrase(lifetimeYears))
      setOpenField(null)
      return
    }

    onLifetimeYearsChange(years)
    setLifetimeText(formatLifetimePhrase(years))
    setOpenField(null)
  }

  return (
    <motion.section
      className="mx-auto flex max-w-5xl flex-col items-center gap-12 text-center"
      variants={revealContainerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.h1 variants={revealItemVariants} className="text-5xl font-bold tracking-tight">
        Is It Worth the Time?
      </motion.h1>

      <motion.p
        variants={revealItemVariants}
        className="max-w-5xl text-3xl leading-snug font-regular text-muted-foreground md:px-20"
      >
        If, by optimizing a task that I do{' '}
        <EditableToken
          icon={<AudioWaveform className="size-[0.95em] translate-y-[0.03em]" strokeWidth={2.25} />}
          text={frequencyText}
          placeholder={currentFrequencyPhrase}
          open={openField === 'frequency'}
          onOpen={() => openToken('frequency')}
          onChangeText={setFrequencyText}
          onCommit={commitFrequencyText}
          onCancel={() => {
            setFrequencyText(toFrequencyPhrase(frequency))
            setOpenField(null)
          }}
          options={filteredFrequencyOptions.map((option) => ({
            key: `${option.value.amount}-${option.value.unit}`,
            label: option.label,
            selected: option.value.amount === frequency.amount && option.value.unit === frequency.unit,
            onSelect: () => {
              onFrequencyChange(option.value)
              setFrequencyText(toFrequencyPhrase(option.value))
              setOpenField(null)
            },
          }))}
        />
        {', '}
        I can shave off{' '}
        <EditableToken
          icon={<Hourglass className="size-[0.95em] translate-y-[0.03em]" strokeWidth={2.25} />}
          text={timeText}
          placeholder={currentTimePhrase}
          open={openField === 'time'}
          onOpen={() => openToken('time')}
          onChangeText={setTimeText}
          onCommit={commitTimeText}
          onCancel={() => {
            setTimeText(toTimePhrase(timeSavedSeconds))
            setOpenField(null)
          }}
          options={filteredTimeOptions.map((option) => ({
            key: String(option.seconds),
            label: option.label,
            selected: option.seconds === timeSavedSeconds,
            onSelect: () => {
              onTimeSavedSecondsChange(option.seconds)
              setTimeText(option.label)
              setOpenField(null)
            },
          }))}
        />{' '}
        each time, and I keep doing it over a{' '}
        <EditableToken
          icon={<Calendar className="size-[0.95em] translate-y-[0.03em]" strokeWidth={2.25} />}
          text={lifetimeText}
          placeholder={currentLifetimePhrase}
          open={openField === 'lifetime'}
          onOpen={() => openToken('lifetime')}
          onChangeText={setLifetimeText}
          onCommit={commitLifetimeText}
          onCancel={() => {
            setLifetimeText(formatLifetimePhrase(lifetimeYears))
            setOpenField(null)
          }}
          options={filteredLifetimeOptions.map((years) => ({
            key: String(years),
            label: formatLifetimePhrase(years),
            selected: years === lifetimeYears,
            onSelect: () => {
              onLifetimeYearsChange(years)
              setLifetimeText(formatLifetimePhrase(years))
              setOpenField(null)
            },
          }))}
        />{' '}
        period, it will stop being worth it if it takes longer than:
      </motion.p>

      <motion.div variants={revealItemVariants} className="space-y-1 flex flex-col items-center gap-2">
        <div className="text-5xl font-bold tabular-nums">
          {impossible ? (
            <span className="inline-flex items-baseline gap-2">
              <span>—</span>
              {!isDefaultCalendarBasis ? <span className="text-5xl text-muted-foreground">*</span> : null}
            </span>
          ) : (
            <span className="inline-flex items-baseline gap-2">
              {compact.approx ? <span>~</span> : null}
              <NumberFlow value={compact.value} format={{ maximumFractionDigits: 2 }} />
              <span>{compact.unit}</span>
              {!isDefaultCalendarBasis ? <span className="text-5xl text-muted-foreground -ml-2">*</span> : null}
            </span>
          )}
        </div>
        {!isDefaultCalendarBasis ? (
          <p className="text-sm text-muted-foreground">{`* based on a calendar year of ${daysPerYear} days`}</p>
        ) : null}
        <Button variant="outline" size="lg" onClick={onShowTable}>
        Show full table
        <ArrowRight className="size-5" />
      </Button>
      </motion.div>
    </motion.section>
  )
}

function EditableToken({
  icon,
  text,
  placeholder,
  open,
  onOpen,
  onChangeText,
  onCommit,
  onCancel,
  options,
  suffix,
}: {
  icon: ReactNode
  text: string
  placeholder: string
  open: boolean
  onOpen: () => void
  onChangeText: (text: string) => void
  onCommit: () => void
  onCancel: () => void
  options: Array<{ key: string; label: string; selected: boolean; onSelect: () => void }>
  suffix?: string
}) {
  const editableRef = useRef<HTMLSpanElement | null>(null)
  const hasPlacedCaretRef = useRef(false)
  const skipNextBlurCommitRef = useRef(false)
  const showPlaceholder = open && text.length === 0

  useEffect(() => {
    const node = editableRef.current
    if (!node) {
      return
    }

    if (node.textContent !== text) {
      node.textContent = text
    }

    if (open && !hasPlacedCaretRef.current) {
      placeCaretAtStart(node)
      hasPlacedCaretRef.current = true
    }

    if (!open) {
      hasPlacedCaretRef.current = false
    }
  }, [open, text])

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <span className="inline-flex items-baseline gap-1 whitespace-nowrap font-bold text-foreground align-baseline">
          <span className="shrink-0 self-center hidden">{icon}</span>
          <span className="relative inline-grid min-w-[2ch]">
            {showPlaceholder ? (
              <span className="pointer-events-none col-start-1 row-start-1 select-none whitespace-nowrap text-muted-foreground/20">
                {placeholder}
              </span>
            ) : null}
            <span
              ref={editableRef}
              role="textbox"
              contentEditable
              suppressContentEditableWarning
              onClick={(event) => {
                event.stopPropagation()
                onOpen()
              }}
              onFocus={() => {
                onOpen()
              }}
              onInput={(event) => {
                onChangeText(event.currentTarget.textContent ?? '')
              }}
              onBlur={() => {
                if (skipNextBlurCommitRef.current) {
                  skipNextBlurCommitRef.current = false
                  return
                }

                onCommit()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }

                if (event.key === 'Escape') {
                  event.preventDefault()
                  onCancel()
                  event.currentTarget.blur()
                }
              }}
              className="col-start-1 row-start-1 relative z-10 inline-block min-w-[2ch] cursor-text text-left outline-none after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-1 after:bg-foreground after:origin-right after:transition-transform after:duration-300 after:scale-x-0 hover:after:origin-left hover:after:scale-x-100 focus:after:origin-left focus:after:scale-x-100"
            />
          </span>
          {suffix ? <span>{suffix}</span> : null}
        </span>
      </PopoverAnchor>
      <PopoverContent align="center" className="w-72 p-2" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="space-y-1">
          {(options.length === 0
            ? [
                <div key="empty" className="px-2 py-2 text-sm text-muted-foreground">
                  No matching presets
                </div>,
              ]
            : options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    skipNextBlurCommitRef.current = true
                    editableRef.current?.blur()
                    option.onSelect()
                  }}
                >
                  {option.label}
                  {option.selected ? <Check className="ml-auto size-4" /> : null}
                </button>
              ))) as ReactNode}
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

function toFrequencyPhrase(value: FrequencyColumn) {
  if (value.unit === 'day') {
    if (value.amount === 1) {
      return 'daily'
    }

    return `${strip(value.amount)} times a day`
  }

  if (value.unit === 'week') {
    if (value.amount === 1) {
      return 'weekly'
    }

    return `${strip(value.amount)} times a week`
  }

  if (value.unit === 'month') {
    if (value.amount === 1) {
      return 'monthly'
    }

    return `${strip(value.amount)} times a month`
  }

  if (value.amount === 1) {
    return 'yearly'
  }

  return `${strip(value.amount)} times a year`
}

function toTimePhrase(seconds: number) {
  if (seconds % 86400 === 0) {
    const value = seconds / 86400
    return `${strip(value)} ${value === 1 ? 'day' : 'days'}`
  }

  if (seconds % 3600 === 0) {
    const value = seconds / 3600
    return `${strip(value)} ${value === 1 ? 'hour' : 'hours'}`
  }

  if (seconds % 60 === 0) {
    const value = seconds / 60
    return `${strip(value)} ${value === 1 ? 'minute' : 'minutes'}`
  }

  return `${strip(seconds)} ${seconds === 1 ? 'second' : 'seconds'}`
}

function formatLifetimePhrase(value: number) {
  if (value < 1) {
    const months = Math.round(value * 12)
    return `${strip(months)}-month`
  }

  return `${strip(value)}-year`
}

function strip(value: number) {
  return Number.parseFloat(value.toFixed(4)).toString()
}

function normalizeForSearch(value: string) {
  return value.trim().toLowerCase()
}
