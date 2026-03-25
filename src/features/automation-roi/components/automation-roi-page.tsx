import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type ReactNode,
} from 'react'
import NumberFlow from '@number-flow/react'
import { AnimatePresence, motion } from 'motion/react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

import { PageFooter } from '@/components/layout/page-footer'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

import {
  calculateBreakEvenSeconds,
  getDaysPerYear,
  getRunsPerYear,
  isImpossibleCell,
} from '../calculations'
import { DEFAULT_COLUMNS, DEFAULT_ROWS, DEFAULT_STATE, LIFETIME_PRESETS_YEARS } from '../defaults'
import { formatCompactCellDisplay, formatForTable, formatPreciseLongText } from '../formatters'
import { useAutomationROIStore } from '../hooks/use-automation-roi-store'
import { parseDurationInput, parseFrequencyInput, parseTimeSavedInput } from '../parsers'
import { savePersistedState } from '../storage'
import type { FrequencyColumn, SavingsRow } from '../types'

type View =
  | 'home'
  | 'table'
  | 'menu-frequency'
  | 'menu-time'
  | 'menu-lifetime'
  | 'add-menu-option'
  | 'customize'
  | 'add-column'
  | 'add-row'

type BaseView = 'home' | 'table'
type CustomizeSection = 'columns' | 'rows'
type MenuCustomKind = 'frequency' | 'time' | 'lifetime'

interface FrequencyOption {
  label: string
  value: FrequencyColumn
}

interface TimeOption {
  label: string
  seconds: number
}

const HOME_CURSOR_RESULT_INDEX = 3
const FOOTER_ACTION_COUNT = 4

const frequencyOptions: FrequencyOption[] = [
  { label: '50 times a day', value: { ...DEFAULT_COLUMNS[0] } },
  { label: '5 times a day', value: { ...DEFAULT_COLUMNS[1] } },
  { label: 'Daily', value: { ...DEFAULT_COLUMNS[2] } },
  { label: 'Weekly', value: { ...DEFAULT_COLUMNS[3] } },
  { label: 'Monthly', value: { ...DEFAULT_COLUMNS[4] } },
  { label: 'Yearly', value: { ...DEFAULT_COLUMNS[5] } },
]

const timeOptions: TimeOption[] = DEFAULT_ROWS.map((row) => ({
  label: formatLongDuration(row.seconds),
  seconds: row.seconds,
}))

const lifetimeOptions = LIFETIME_PRESETS_YEARS.map((years) => ({
  years,
  label: formatLifetimeLong(years),
}))

const screenVariants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(1px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.22 } },
  exit: { opacity: 0, y: -6, filter: 'blur(1px)', transition: { duration: 0.16 } },
}

const interactiveBaseClass =
  "relative inline-flex items-center whitespace-nowrap pb-[1px] transition-colors before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-[2px] before:w-full before:bg-[#e6e6e6] dark:before:bg-[#363636] after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-right after:scale-x-0 after:bg-foreground after:transition-transform after:duration-300 hover:after:origin-left hover:after:scale-x-100 focus-visible:outline-none"

const TABLE_CURSOR_BACK_INDEX = 0
const PARSER_YEAR_SECONDS = 365 * 24 * 60 * 60
const DEFAULT_FOCUS_FREQUENCY = DEFAULT_COLUMNS[1]
const DEFAULT_FOCUS_TIME_SAVED_SECONDS = 60
const WORD_REVEAL_STEP_SECONDS = 0.01
const WORD_REVEAL_DURATION_SECONDS = 0.18
const HOME_STAGE_STAGGER_MS = 90
const HOME_REVEAL_STAGE_RESULT = 1
const HOME_REVEAL_STAGE_SHOW_TABLE = 2
const HOME_REVEAL_STAGE_RESET = 3
const HOME_REVEAL_STAGE_NOTE = 4
const HOME_REVEAL_STAGE_FOOTER_START = 5

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
    addCustomRow,
    updateCustomRow,
    deleteCustomRow,
    addCustomColumn,
    updateCustomColumn,
    deleteCustomColumn,
    resetDefaults,
  } = useAutomationROIStore()

  const { resolvedTheme, setTheme, theme } = useTheme()

  const [view, setView] = useState<View>('home')
  const [menuReturnView, setMenuReturnView] = useState<BaseView>('home')
  const [menuIndex, setMenuIndex] = useState(0)
  const [menuCustomKind, setMenuCustomKind] = useState<MenuCustomKind>('frequency')
  const [menuCustomDraft, setMenuCustomDraft] = useState('')

  const [focusFrequency, setFocusFrequency] = useState(() => ({ ...DEFAULT_FOCUS_FREQUENCY }))
  const [focusTimeSavedSeconds, setFocusTimeSavedSeconds] = useState(
    DEFAULT_FOCUS_TIME_SAVED_SECONDS,
  )
  const [homeCursorIndex, setHomeCursorIndex] = useState(HOME_CURSOR_RESULT_INDEX)
  const [focusResultMode, setFocusResultMode] = useState<'approx' | 'exact'>('approx')
  const [resultTypewriterRunId, setResultTypewriterRunId] = useState(0)
  const [resultTypewriterDone, setResultTypewriterDone] = useState(false)
  const [homeRevealStage, setHomeRevealStage] = useState(0)
  const [tableCursorIndex, setTableCursorIndex] = useState(1)

  const [customizeSection, setCustomizeSection] = useState<CustomizeSection>('columns')
  const [customizeColumnCursorIndex, setCustomizeColumnCursorIndex] = useState(0)
  const [customizeRowCursorIndex, setCustomizeRowCursorIndex] = useState(0)
  const [customizeColumnSelectedIndex, setCustomizeColumnSelectedIndex] = useState(0)
  const [customizeRowSelectedIndex, setCustomizeRowSelectedIndex] = useState(0)
  const [customizeBaseline, setCustomizeBaseline] = useState<{
    rows: SavingsRow[]
    columns: FrequencyColumn[]
  } | null>(null)

  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [addMenuOptionCursorIndex, setAddMenuOptionCursorIndex] = useState(0)
  const [columnDraft, setColumnDraft] = useState('')
  const [rowDraft, setRowDraft] = useState('')
  const menuOptionInputRef = useRef<HTMLInputElement | null>(null)
  const addMenuOptionCancelRef = useRef<HTMLButtonElement | null>(null)
  const columnInputRef = useRef<HTMLInputElement | null>(null)
  const rowInputRef = useRef<HTMLInputElement | null>(null)
  const tableSliderTrackRef = useRef<HTMLDivElement | null>(null)

  const runsPerYear = getRunsPerYear(focusFrequency, calendarBasis, customDaysPerYear)
  const focusResultSeconds = calculateBreakEvenSeconds(focusTimeSavedSeconds, runsPerYear, lifetimeYears)
  const focusResult = formatCompactCellDisplay(focusResultSeconds)
  const focusResultExactText = formatPreciseLongText(focusResultSeconds)
  const focusResultApproxText = `${focusResult.approx ? '~' : ''}${formatResultNumber(focusResult.value)} ${focusResult.unit}`
  const focusImpossible = isImpossibleCell(focusTimeSavedSeconds, focusFrequency)
  const focusResultTypewriterText = focusImpossible
    ? '—'
    : focusResultMode === 'exact'
      ? focusResultExactText
      : focusResultApproxText
  const handleResultTypewriterComplete = useCallback(() => {
    setResultTypewriterDone(true)
  }, [])

  const hasResettableStoreChanges = useMemo(
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
  const hasFocusOverrides =
    !valuesNearlyEqual(focusFrequency.amount, DEFAULT_FOCUS_FREQUENCY.amount) ||
    focusFrequency.unit !== DEFAULT_FOCUS_FREQUENCY.unit ||
    focusTimeSavedSeconds !== DEFAULT_FOCUS_TIME_SAVED_SECONDS
  const hasResettableChanges = hasResettableStoreChanges || hasFocusOverrides

  const homeContentCursorMaxIndex = hasResettableChanges ? 5 : 4
  const homeFooterStartIndex = homeContentCursorMaxIndex + 1
  const homeCursorMaxIndex = homeFooterStartIndex + FOOTER_ACTION_COUNT - 1
  const homeFooterRevealCount = Math.max(
    0,
    Math.min(
      FOOTER_ACTION_COUNT,
      homeRevealStage - HOME_REVEAL_STAGE_FOOTER_START + 1,
    ),
  )
  let homeVisibleCursorMaxIndex = 2
  if (homeRevealStage >= HOME_REVEAL_STAGE_RESULT) {
    homeVisibleCursorMaxIndex = HOME_CURSOR_RESULT_INDEX
  }
  if (homeRevealStage >= HOME_REVEAL_STAGE_SHOW_TABLE) {
    homeVisibleCursorMaxIndex = Math.max(homeVisibleCursorMaxIndex, 4)
  }
  if (hasResettableChanges && homeRevealStage >= HOME_REVEAL_STAGE_RESET) {
    homeVisibleCursorMaxIndex = Math.max(homeVisibleCursorMaxIndex, 5)
  }
  if (homeFooterRevealCount > 0) {
    homeVisibleCursorMaxIndex = Math.max(
      homeVisibleCursorMaxIndex,
      homeFooterStartIndex + homeFooterRevealCount - 1,
    )
  }
  const activeHomeCursorIndex = Math.min(homeCursorIndex, homeVisibleCursorMaxIndex)
  const tableResetIndex = hasResettableChanges ? 1 : -1
  const tableLifetimeCursorIndex = hasResettableChanges ? 2 : 1
  const tableSliderIndicatorCursorIndex = hasResettableChanges ? 3 : 2
  const tableDecrementCursorIndex = hasResettableChanges ? 4 : 3
  const tableIncrementCursorIndex = hasResettableChanges ? 5 : 4
  const tableCustomizeCursorIndex = hasResettableChanges ? 6 : 5
  const tableFooterStartIndex = tableCustomizeCursorIndex + 1
  const tableCursorMaxIndex = tableFooterStartIndex + FOOTER_ACTION_COUNT - 1
  const activeTableCursorIndex = Math.min(tableCursorIndex, tableCursorMaxIndex)

  const isMenuView =
    view === 'menu-frequency' || view === 'menu-time' || view === 'menu-lifetime'

  const menuTitle =
    view === 'menu-frequency'
      ? 'How often do you do it?'
      : view === 'menu-time'
        ? 'How much time will you save each time?'
        : 'Over how long a period of time?'

  const menuLabels =
    view === 'menu-frequency'
      ? frequencyOptions.map((option) => option.label)
      : view === 'menu-time'
        ? timeOptions.map((option) => option.label)
        : lifetimeOptions.map((option) => option.label)
  const menuOptionsCount = menuLabels.length
  const menuNewOptionIndex = menuOptionsCount
  const menuCancelIndex = menuOptionsCount + 1
  const menuItemCount = menuOptionsCount + 2
  const menuSelectedIndex =
    view === 'menu-frequency'
      ? (() => {
          const index = frequencyOptions.findIndex(
            (option) =>
              option.value.amount === focusFrequency.amount &&
              option.value.unit === focusFrequency.unit,
          )
          return index >= 0 ? index : menuNewOptionIndex
        })()
      : view === 'menu-time'
        ? (() => {
            const index = timeOptions.findIndex((option) => option.seconds === focusTimeSavedSeconds)
            return index >= 0 ? index : menuNewOptionIndex
          })()
        : (() => {
            const index = lifetimeOptions.findIndex((option) =>
              valuesNearlyEqual(option.years, lifetimeYears),
            )
            return index >= 0 ? index : menuNewOptionIndex
          })()
  const menuFooterStartIndex = menuItemCount
  const menuCursorMaxIndex = menuFooterStartIndex + FOOTER_ACTION_COUNT - 1

  const daysPerYear = getDaysPerYear(calendarBasis, customDaysPerYear)
  const hasCustomCalendar = calendarBasis !== 'calendar'

  const tableLifetimeIndex = getClosestLifetimePresetIndex(lifetimeYears)
  const tableCanDecrementLifetime = tableLifetimeIndex > 0
  const tableCanIncrementLifetime = tableLifetimeIndex < LIFETIME_PRESETS_YEARS.length - 1
  const tableLifetimeSliderPercent =
    (tableLifetimeIndex / Math.max(1, LIFETIME_PRESETS_YEARS.length - 1)) * 100

  const columnItems = [...columns.map((column) => ({ kind: 'column' as const, column })), { kind: 'new-column' as const }]
  const rowItems = [...rows.map((row) => ({ kind: 'row' as const, row })), { kind: 'new-row' as const }]
  const clampedCustomizeColumnCursorIndex = clampIndex(
    customizeColumnCursorIndex,
    columnItems.length,
  )
  const clampedCustomizeRowCursorIndex = clampIndex(
    customizeRowCursorIndex,
    rowItems.length,
  )
  const clampedCustomizeColumnSelectedIndex = clampIndex(
    customizeColumnSelectedIndex,
    columnItems.length,
  )
  const clampedCustomizeRowSelectedIndex = clampIndex(
    customizeRowSelectedIndex,
    rowItems.length,
  )
  const hasCustomizePendingChanges = useMemo(
    () =>
      customizeBaseline
        ? !sameRows(rows, customizeBaseline.rows) ||
          !sameColumns(columns, customizeBaseline.columns)
        : false,
    [customizeBaseline, rows, columns],
  )
  const persistedLifetimeYears = useMemo(() => {
    const isPreset = LIFETIME_PRESETS_YEARS.some((preset) =>
      valuesNearlyEqual(preset, lifetimeYears),
    )

    return isPreset ? lifetimeYears : DEFAULT_STATE.lifetimeYears
  }, [lifetimeYears])
  const focusCurrentViewAutofocus = useCallback(() => {
    const target = document.querySelector<HTMLElement>(
      `[data-screen-autofocus-view="${view}"]`,
    )

    if (target) {
      target.focus({ preventScroll: true })
    }
  }, [view])

  useEffect(() => {
    savePersistedState({
      lifetimeYears: persistedLifetimeYears,
      calendarBasis,
      customDaysPerYear,
      rows,
      columns,
      displayMode,
      significantDigits,
    })
  }, [
    persistedLifetimeYears,
    calendarBasis,
    customDaysPerYear,
    rows,
    columns,
    displayMode,
    significantDigits,
  ])

  useEffect(() => {
    let frame = 0
    let attempts = 0
    let cancelled = false

    const tryFocus = () => {
      if (cancelled) {
        return
      }

      const first = document.querySelector<HTMLElement>(
        `[data-screen-autofocus-view="${view}"]`,
      )

      if (first) {
        first.focus({ preventScroll: true })
        return
      }

      attempts += 1
      if (attempts < 120) {
        frame = window.requestAnimationFrame(tryFocus)
      }
    }

    frame = window.requestAnimationFrame(tryFocus)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [view])

  useEffect(() => {
    const handleWindowFocus = () => {
      focusCurrentViewAutofocus()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        focusCurrentViewAutofocus()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [focusCurrentViewAutofocus])

  function openFrequencyMenu(returnView: BaseView) {
    setMenuReturnView(returnView)
    const selectedIndex = frequencyOptions.findIndex(
      (option) =>
        option.value.amount === focusFrequency.amount && option.value.unit === focusFrequency.unit,
    )
    setMenuIndex(selectedIndex >= 0 ? selectedIndex : menuNewOptionIndex)
    setView('menu-frequency')
  }

  function openTimeMenu(returnView: BaseView) {
    setMenuReturnView(returnView)
    const selectedIndex = timeOptions.findIndex(
      (option) => option.seconds === focusTimeSavedSeconds,
    )
    setMenuIndex(selectedIndex >= 0 ? selectedIndex : menuNewOptionIndex)
    setView('menu-time')
  }

  function openLifetimeMenu(returnView: BaseView) {
    setMenuReturnView(returnView)
    const selectedIndex = lifetimeOptions.findIndex((option) =>
      valuesNearlyEqual(option.years, lifetimeYears),
    )
    setMenuIndex(selectedIndex >= 0 ? selectedIndex : menuNewOptionIndex)
    setView('menu-lifetime')
  }

  function selectMenuItem(index: number) {
    if (view === 'menu-frequency') {
      const option = frequencyOptions[index]
      if (option) {
        setFocusFrequency({ ...option.value })
      }
    }

    if (view === 'menu-time') {
      const option = timeOptions[index]
      if (option) {
        setFocusTimeSavedSeconds(option.seconds)
      }
    }

    if (view === 'menu-lifetime') {
      const option = lifetimeOptions[index]
      if (option) {
        setLifetimeYears(option.years)
      }
    }

    setView(menuReturnView)
  }

  function openNewMenuOption() {
    if (view === 'menu-frequency') {
      setMenuCustomKind('frequency')
      setMenuCustomDraft('')
      setAddMenuOptionCursorIndex(0)
      setView('add-menu-option')
      return
    }

    if (view === 'menu-time') {
      setMenuCustomKind('time')
      setMenuCustomDraft('')
      setAddMenuOptionCursorIndex(0)
      setView('add-menu-option')
      return
    }

    if (view === 'menu-lifetime') {
      setMenuCustomKind('lifetime')
      setMenuCustomDraft('')
      setAddMenuOptionCursorIndex(0)
      setView('add-menu-option')
    }
  }

  function closeAddMenuOption() {
    setMenuCustomDraft('')
    setView(getMenuViewForKind(menuCustomKind))
  }

  function handleAddMenuOptionKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (view !== 'add-menu-option') {
      return
    }

    const moveBackward =
      event.key === 'ArrowUp' ||
      event.key === 'ArrowLeft' ||
      (event.key === 'Tab' && event.shiftKey)
    const moveForward =
      event.key === 'ArrowDown' ||
      event.key === 'ArrowRight' ||
      (event.key === 'Tab' && !event.shiftKey)

    if (moveBackward || moveForward) {
      event.preventDefault()
      const nextIndex = moveForward
        ? addMenuOptionCursorIndex === 1
          ? 0
          : 1
        : addMenuOptionCursorIndex === 0
          ? 1
          : 0
      setAddMenuOptionCursorIndex(nextIndex)
      if (nextIndex === 0) {
        menuOptionInputRef.current?.focus({ preventScroll: true })
      } else {
        addMenuOptionCancelRef.current?.focus({ preventScroll: true })
      }
      return
    }

    if (addMenuOptionCursorIndex === 1 && isActivationKey(event.key)) {
      event.preventDefault()
      closeAddMenuOption()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeAddMenuOption()
    }
  }

  function getMenuViewForKind(kind: MenuCustomKind): View {
    if (kind === 'frequency') {
      return 'menu-frequency'
    }

    if (kind === 'time') {
      return 'menu-time'
    }

    return 'menu-lifetime'
  }

  function submitMenuCustomOption() {
    if (menuCustomKind === 'frequency') {
      const parsed = parseFrequencyInput(menuCustomDraft)
      if (!parsed.ok) {
        toast.error(parsed.error)
        return
      }

      setFocusFrequency({
        id: 'focus-custom-frequency',
        label: parsed.label,
        amount: parsed.amount,
        unit: parsed.unit,
        isCustom: true,
      })
      setView(menuReturnView)
      return
    }

    if (menuCustomKind === 'time') {
      const parsed = parseTimeSavedInput(menuCustomDraft)
      if (!parsed.ok) {
        toast.error(parsed.error)
        return
      }

      setFocusTimeSavedSeconds(parsed.seconds)
      setView(menuReturnView)
      return
    }

    const parsed = parseDurationInput(menuCustomDraft, 'year')
    if (!parsed.ok) {
      toast.error(parsed.error)
      return
    }

    setLifetimeYears(parsed.seconds / PARSER_YEAR_SECONDS)
    setView(menuReturnView)
  }

  function handleHomeAction(index: number) {
    setHomeCursorIndex(index)

    if (index === 0) {
      openFrequencyMenu('home')
      return
    }

    if (index === 1) {
      openTimeMenu('home')
      return
    }

    if (index === 2) {
      openLifetimeMenu('home')
      return
    }

    if (index === HOME_CURSOR_RESULT_INDEX) {
      setResultTypewriterDone(false)
      setResultTypewriterRunId((current) => current + 1)
      setFocusResultMode((current) => (current === 'approx' ? 'exact' : 'approx'))
      return
    }

    if (index === 4) {
      setView('table')
      return
    }

    if (index === 5 && hasResettableChanges) {
      resetAllDefaults()
      return
    }

    if (index >= homeFooterStartIndex && index <= homeCursorMaxIndex) {
      const footerIndex = index - homeFooterStartIndex
      if (footerIndex < homeFooterRevealCount) {
        handleFooterAction(footerIndex)
      }
    }
  }

  function handleHomeKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (view !== 'home') {
      return
    }

    const moveBackward =
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowUp' ||
      (event.key === 'Tab' && event.shiftKey)
    const moveForward =
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown' ||
      (event.key === 'Tab' && !event.shiftKey)

    if (moveBackward || moveForward) {
      event.preventDefault()
      setHomeCursorIndex((current) => {
        const clamped = Math.min(current, homeVisibleCursorMaxIndex)
        if (moveBackward) {
          return clamped === 0 ? homeVisibleCursorMaxIndex : clamped - 1
        }

        return clamped === homeVisibleCursorMaxIndex ? 0 : clamped + 1
      })
      return
    }

    if (isActivationKey(event.key)) {
      event.preventDefault()
      handleHomeAction(activeHomeCursorIndex)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setHomeCursorIndex(HOME_CURSOR_RESULT_INDEX)
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!isMenuView) {
      return
    }

    const moveBackward =
      event.key === 'ArrowUp' ||
      event.key === 'ArrowLeft' ||
      (event.key === 'Tab' && event.shiftKey)
    const moveForward =
      event.key === 'ArrowDown' ||
      event.key === 'ArrowRight' ||
      (event.key === 'Tab' && !event.shiftKey)

    if (moveBackward || moveForward) {
      event.preventDefault()
      setMenuIndex((current) => {
        if (moveBackward) {
          return current === 0 ? menuCursorMaxIndex : current - 1
        }

        return current === menuCursorMaxIndex ? 0 : current + 1
      })
      return
    }

    if (isActivationKey(event.key)) {
      event.preventDefault()
      if (menuIndex === menuCancelIndex) {
        setView(menuReturnView)
        return
      }

      if (menuIndex === menuNewOptionIndex) {
        openNewMenuOption()
        return
      }

      if (menuIndex < menuCancelIndex) {
        selectMenuItem(menuIndex)
        return
      }

      handleFooterAction(menuIndex - menuFooterStartIndex)
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setView(menuReturnView)
    }
  }

  function handleTableAction(index: number) {
    setTableCursorIndex(index)

    if (index === TABLE_CURSOR_BACK_INDEX) {
      setView('home')
      return
    }

    if (hasResettableChanges && index === tableResetIndex) {
      resetAllDefaults()
      return
    }

    if (index === tableLifetimeCursorIndex) {
      openLifetimeMenu('table')
      return
    }

    if (index === tableDecrementCursorIndex) {
      if (tableCanDecrementLifetime) {
        incrementLifetime(-1)
      }
      return
    }

    if (index === tableIncrementCursorIndex) {
      if (tableCanIncrementLifetime) {
        incrementLifetime(1)
      }
      return
    }

    if (index === tableCustomizeCursorIndex) {
      openCustomize()
      return
    }

    if (index >= tableFooterStartIndex && index <= tableCursorMaxIndex) {
      handleFooterAction(index - tableFooterStartIndex)
    }
  }

  function handleTableKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (view !== 'table') {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setHomeCursorIndex(HOME_CURSOR_RESULT_INDEX)
      setView('home')
      return
    }

    if (
      activeTableCursorIndex === tableSliderIndicatorCursorIndex &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      event.preventDefault()
      incrementLifetime(event.key === 'ArrowLeft' ? -1 : 1)
      return
    }

    const moveBackward =
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowUp' ||
      (event.key === 'Tab' && event.shiftKey)
    const moveForward =
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown' ||
      (event.key === 'Tab' && !event.shiftKey)

    if (moveBackward || moveForward) {
      event.preventDefault()
      setTableCursorIndex((current) => {
        const clamped = Math.min(current, tableCursorMaxIndex)
        if (moveBackward) {
          return clamped === 0 ? tableCursorMaxIndex : clamped - 1
        }

        return clamped === tableCursorMaxIndex ? 0 : clamped + 1
      })
      return
    }

    if (isActivationKey(event.key)) {
      event.preventDefault()
      handleTableAction(activeTableCursorIndex)
    }
  }

  function openCustomize() {
    const firstCustomColumn = columnItems.findIndex(
      (item) => item.kind === 'column' && item.column.isCustom,
    )
    const defaultColumnIndex = firstCustomColumn >= 0 ? firstCustomColumn : 0
    setCustomizeSection('columns')
    setCustomizeColumnCursorIndex(defaultColumnIndex)
    setCustomizeColumnSelectedIndex(defaultColumnIndex)
    setCustomizeRowCursorIndex((current) => clampIndex(current, rowItems.length))
    setCustomizeRowSelectedIndex((current) => clampIndex(current, rowItems.length))
    setCustomizeBaseline({
      rows: rows.map((row) => ({ ...row })),
      columns: columns.map((column) => ({ ...column })),
    })
    setView('customize')
  }

  function resetAllDefaults() {
    resetDefaults()
    setFocusFrequency({ ...DEFAULT_FOCUS_FREQUENCY })
    setFocusTimeSavedSeconds(DEFAULT_FOCUS_TIME_SAVED_SECONDS)
    setFocusResultMode('approx')
    setResultTypewriterDone(false)
    setResultTypewriterRunId((current) => current + 1)
  }

  function activateCustomizeItem(
    sectionOverride?: CustomizeSection,
    indexOverride?: number,
  ) {
    const activeSection = sectionOverride ?? customizeSection
    const activeIndex =
      indexOverride ??
      (activeSection === 'columns'
        ? clampedCustomizeColumnCursorIndex
        : clampedCustomizeRowCursorIndex)

    if (activeSection === 'columns') {
      setCustomizeColumnSelectedIndex(activeIndex)
    } else {
      setCustomizeRowSelectedIndex(activeIndex)
    }

    if (activeSection === 'columns') {
      const item = columnItems[activeIndex]
      if (!item) {
        return
      }

      if (item.kind === 'new-column') {
        setEditingColumnId(null)
        setColumnDraft('')
        setView('add-column')
        return
      }

      if (!item.column.isCustom) {
        toast.error('Preset columns are fixed. Add a new column instead.')
        return
      }

      setEditingColumnId(item.column.id)
      setColumnDraft(`${strip(item.column.amount)}/${item.column.unit}`)
      setView('add-column')
      return
    }

    const item = rowItems[activeIndex]
    if (!item) {
      return
    }

    if (item.kind === 'new-row') {
      setEditingRowId(null)
      setRowDraft('')
      setView('add-row')
      return
    }

    if (!item.row.isCustom) {
      toast.error('Preset rows are fixed. Add a new row instead.')
      return
    }

    setEditingRowId(item.row.id)
    setRowDraft(formatLongDuration(item.row.seconds))
    setView('add-row')
  }

  function deleteActiveCustomizeItem() {
    if (customizeSection === 'columns') {
      const item = columnItems[clampedCustomizeColumnCursorIndex]
      if (item?.kind === 'column' && item.column.isCustom) {
        deleteCustomColumn(item.column.id)
        setCustomizeColumnCursorIndex((current) => clampIndex(current, columnItems.length - 1))
        setCustomizeColumnSelectedIndex((current) =>
          clampIndex(current, columnItems.length - 1),
        )
      }
      return
    }

    const item = rowItems[clampedCustomizeRowCursorIndex]
    if (item?.kind === 'row' && item.row.isCustom) {
      deleteCustomRow(item.row.id)
      setCustomizeRowCursorIndex((current) => clampIndex(current, rowItems.length - 1))
      setCustomizeRowSelectedIndex((current) => clampIndex(current, rowItems.length - 1))
    }
  }

  function handleCustomizeKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (view !== 'customize') {
      return
    }

    const activeItems = customizeSection === 'columns' ? columnItems : rowItems
    const setActiveCursorIndex =
      customizeSection === 'columns'
        ? setCustomizeColumnCursorIndex
        : setCustomizeRowCursorIndex

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveCursorIndex((current) =>
        Math.min(current + 1, activeItems.length - 1),
      )
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveCursorIndex((current) => Math.max(current - 1, 0))
    }

    if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowLeft' ||
      event.key === 'Tab'
    ) {
      event.preventDefault()
      if (event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)) {
        setCustomizeSection((current) => (current === 'columns' ? 'rows' : 'columns'))
      } else {
        setCustomizeSection((current) => (current === 'rows' ? 'columns' : 'rows'))
      }
    }

    if (isActivationKey(event.key)) {
      event.preventDefault()
      activateCustomizeItem()
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      deleteActiveCustomizeItem()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setView('table')
    }
  }

  function submitColumn() {
    const parsed = parseFrequencyInput(columnDraft)
    if (!parsed.ok) {
      toast.error(parsed.error)
      return
    }

    if (editingColumnId) {
      updateCustomColumn(editingColumnId, {
        label: parsed.label,
        amount: parsed.amount,
        unit: parsed.unit,
      })
    } else {
      addCustomColumn({
        label: parsed.label,
        amount: parsed.amount,
        unit: parsed.unit,
      })
    }

    setEditingColumnId(null)
    setColumnDraft('')
    setView('customize')
  }

  function submitRow() {
    const parsed = parseTimeSavedInput(rowDraft)
    if (!parsed.ok) {
      toast.error(parsed.error)
      return
    }

    if (editingRowId) {
      updateCustomRow(editingRowId, {
        label: parsed.label,
        seconds: parsed.seconds,
      })
    } else {
      addCustomRow({
        label: parsed.label,
        seconds: parsed.seconds,
      })
    }

    setEditingRowId(null)
    setRowDraft('')
    setView('customize')
  }

  function deleteEditingColumn() {
    if (!editingColumnId) {
      return
    }

    deleteCustomColumn(editingColumnId)
    setEditingColumnId(null)
    setColumnDraft('')
    setView('customize')
  }

  function deleteEditingRow() {
    if (!editingRowId) {
      return
    }

    deleteCustomRow(editingRowId)
    setEditingRowId(null)
    setRowDraft('')
    setView('customize')
  }

  function incrementLifetime(step: 1 | -1) {
    const nextIndex = Math.min(
      LIFETIME_PRESETS_YEARS.length - 1,
      Math.max(0, tableLifetimeIndex + step),
    )
    const nextYears = LIFETIME_PRESETS_YEARS[nextIndex]
    if (nextYears !== undefined) {
      setLifetimeYears(nextYears)
    }
  }

  function setLifetimeFromSliderIndex(index: number) {
    const clamped = Math.min(
      LIFETIME_PRESETS_YEARS.length - 1,
      Math.max(0, index),
    )
    const nextYears = LIFETIME_PRESETS_YEARS[clamped]
    if (nextYears !== undefined) {
      setLifetimeYears(nextYears)
    }
  }

  function getSliderIndexFromClientX(clientX: number) {
    const track = tableSliderTrackRef.current
    if (!track) {
      return tableLifetimeIndex
    }

    const rect = track.getBoundingClientRect()
    const ratio = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width
    const clampedRatio = Math.max(0, Math.min(1, ratio))
    return Math.round(clampedRatio * (LIFETIME_PRESETS_YEARS.length - 1))
  }

  function startLifetimeIndicatorDrag(clientX: number) {
    setLifetimeFromSliderIndex(getSliderIndexFromClientX(clientX))

    const handlePointerMove = (event: PointerEvent) => {
      setLifetimeFromSliderIndex(getSliderIndexFromClientX(event.clientX))
    }

    const stopDragging = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)
  }

  function handleLifetimeIndicatorPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault()
    setTableCursorIndex(tableSliderIndicatorCursorIndex)
    startLifetimeIndicatorDrag(event.clientX)
  }

  function cycleTheme() {
    if (theme === 'system') {
      setTheme('light')
      return
    }

    if (theme === 'light') {
      setTheme('dark')
      return
    }

    setTheme('system')
  }

  function openExternal(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleFooterAction(index: number) {
    if (index === 0) {
      openExternal('https://www.avanavana.com')
      return
    }

    if (index === 1) {
      openExternal('https://xkcd.com/1205/')
      return
    }

    if (index === 2) {
      openExternal('https://github.com/avanavana/is-it-worth-the-time')
      return
    }

    if (index === 3) {
      cycleTheme()
    }
  }

  const terminalThemeLabel =
    theme === 'system' ? 'System' : resolvedTheme === 'dark' ? 'Dark' : 'Light'

  const homeText1 = 'If, by optimizing a task that I do '
  const homeText2 = ', I can save'
  const homeText3 = ' each time, and I keep doing it over a '
  const homeText4 = ' period, it will stop being worth it when optimizing it takes longer than:'

  const homeFlowStep1 = getFlowStepCount(homeText1)
  const homeFlowStep2 = homeFlowStep1 + 1
  const homeFlowStep3 = homeFlowStep2 + getFlowStepCount(homeText2) + 1
  const homeFlowStep4 = homeFlowStep3 + getFlowStepCount(homeText3) + 1

  const tableText1 = 'How much time should you spend on automating a recurring task, if done over '
  const tableText2 = '?'
  const tableFlowStep1 = getFlowStepCount(tableText1)
  const tableFlowStep2 = tableFlowStep1 + 1
  const menuCustomTitle =
    menuCustomKind === 'frequency'
      ? 'How often do you do it?'
      : menuCustomKind === 'time'
        ? 'How much time will you save each time?'
        : 'Over how long a period of time?'
  const menuCustomFieldLabel =
    menuCustomKind === 'frequency'
      ? 'Task frequency:'
      : menuCustomKind === 'time'
        ? 'Time saved each time:'
        : 'Task period:'
  const homeSentenceEndDelaySeconds =
    (homeFlowStep4 + getFlowStepCount(homeText4)) * WORD_REVEAL_STEP_SECONDS +
    WORD_REVEAL_DURATION_SECONDS

  useEffect(() => {
    if (view !== 'home') {
      return
    }

    const resetTimer = window.setTimeout(() => setHomeRevealStage(0), 0)
    const baseDelayMs = Math.max(0, Math.round(homeSentenceEndDelaySeconds * 1000))
    const maxStage = HOME_REVEAL_STAGE_FOOTER_START + FOOTER_ACTION_COUNT - 1
    const stageTimers = Array.from({ length: maxStage }, (_, index) =>
      window.setTimeout(
        () => setHomeRevealStage(index + 1),
        baseDelayMs + HOME_STAGE_STAGGER_MS * index,
      ),
    )

    return () => {
      window.clearTimeout(resetTimer)
      stageTimers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [homeSentenceEndDelaySeconds, view])

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-12 sm:py-12">
      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <motion.section
            key="home"
            variants={screenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] sm:min-h-[calc(100vh-96px)] w-full max-w-[1200px] flex-col outline-none"
            onKeyDown={handleHomeKeyDown}
            tabIndex={0}
            data-screen-autofocus-view="home"
          >
            <TerminalHeader title="Is It Worth the Time?" />

            <div className="grow max-w-[500px]">
              <p className="m-0 text-[12px] font-medium leading-6 text-muted-foreground">
                <TypedWords text={homeText1} />
                <TypedInlineSlot delaySteps={homeFlowStep1}>
                  <span className="mr-[12px] inline-flex">
                    <InlineAction
                      label={`${formatFrequencyLong(focusFrequency)} ⏷`}
                      onClick={() => handleHomeAction(0)}
                      active={activeHomeCursorIndex === 0}
                      variant="strong"
                      className="leading-4"
                    />
                  </span>
                </TypedInlineSlot>
                <TypedWords text={homeText2} delaySteps={homeFlowStep2} />
                <br />
                <TypedInlineSlot delaySteps={homeFlowStep2 + getFlowStepCount(homeText2)}>
                  <span className="mr-[12px] inline-flex">
                    <InlineAction
                      label={`${formatLongDuration(focusTimeSavedSeconds)} ⏷`}
                      onClick={() => handleHomeAction(1)}
                      active={activeHomeCursorIndex === 1}
                      variant="strong"
                      className="leading-4"
                    />
                  </span>
                </TypedInlineSlot>
                <TypedWords text={homeText3} delaySteps={homeFlowStep3} />
                <TypedInlineSlot delaySteps={homeFlowStep3 + getFlowStepCount(homeText3)}>
                  <span className="mr-[12px] inline-flex">
                    <InlineAction
                      label={`${formatLifetimePeriod(focusLifetimeYearsRounded(lifetimeYears))} ⏷`}
                      onClick={() => handleHomeAction(2)}
                      active={activeHomeCursorIndex === 2}
                      variant="strong"
                      className="leading-4"
                    />
                  </span>
                </TypedInlineSlot>
                <TypedWords text={homeText4} delaySteps={homeFlowStep4} />
              </p>

              {homeRevealStage >= HOME_REVEAL_STAGE_RESULT ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-12 text-[12px]"
                >
                  <div className="flex items-center">
                    <button
                      type="button"
                      className="relative inline-flex h-6 cursor-pointer items-center whitespace-nowrap pr-[12px] font-bold text-foreground focus-visible:outline-none"
                      onClick={() => handleHomeAction(HOME_CURSOR_RESULT_INDEX)}
                    >
                      {resultTypewriterDone ? (
                        focusImpossible ? (
                          <span>—</span>
                        ) : focusResultMode === 'exact' ? (
                          <ExactResultText text={focusResultExactText} />
                        ) : (
                          <span className="whitespace-nowrap">
                            {focusResult.approx ? '~' : ''}
                            <NumberFlow value={focusResult.value} format={{ maximumFractionDigits: 2 }} /> {focusResult.unit}
                          </span>
                        )
                      ) : (
                        <TypewriterResultText
                          key={resultTypewriterRunId}
                          text={focusResultTypewriterText}
                          onComplete={handleResultTypewriterComplete}
                        />
                      )}
                      <TerminalCursor
                        active={activeHomeCursorIndex === HOME_CURSOR_RESULT_INDEX && resultTypewriterDone}
                        className="absolute right-0 top-1/2 -translate-y-1/2"
                      />
                    </button>
                  </div>
                </motion.div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 text-[12px]">
                {homeRevealStage >= HOME_REVEAL_STAGE_SHOW_TABLE ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <InlineAction
                      label="Show full table 🡪"
                      onClick={() => handleHomeAction(4)}
                      active={activeHomeCursorIndex === 4}
                    />
                  </motion.div>
                ) : null}

                {hasResettableChanges && homeRevealStage >= HOME_REVEAL_STAGE_RESET ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <InlineAction
                      label="⟲ Reset to defaults"
                      onClick={() => handleHomeAction(5)}
                      active={activeHomeCursorIndex === 5}
                    />
                  </motion.div>
                ) : null}
              </div>

              {hasCustomCalendar && homeRevealStage >= HOME_REVEAL_STAGE_NOTE ? (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 text-[10px] text-muted-foreground"
                >
                  * Using {daysPerYear} days per year.
                </motion.p>
              ) : null}
            </div>

            <PageFooter
              themeLabel={terminalThemeLabel}
              activeIndex={
                activeHomeCursorIndex >= homeFooterStartIndex
                  ? activeHomeCursorIndex - homeFooterStartIndex
                  : -1
              }
              onAction={(index) => handleHomeAction(homeFooterStartIndex + index)}
              revealCount={homeFooterRevealCount}
              className={cn(
                'transition-all duration-200',
                homeFooterRevealCount > 0
                  ? 'opacity-100 translate-y-0'
                  : 'pointer-events-none opacity-0 translate-y-1',
              )}
            />
          </motion.section>
        ) : null}

        {view === 'table' ? (
          <motion.section
            key="table"
            variants={screenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] sm:min-h-[calc(100vh-96px)] w-full max-w-[1200px] flex-col outline-none"
            tabIndex={0}
            data-screen-autofocus-view="table"
            onKeyDown={handleTableKeyDown}
          >
            <TerminalHeader title="Is It Worth the Time?" />

            <div className="grow">
              <div className="mb-8 flex items-center gap-4 text-[12px]">
                <InlineAction
                  label="🡨 Back"
                  onClick={() => handleTableAction(TABLE_CURSOR_BACK_INDEX)}
                  active={activeTableCursorIndex === TABLE_CURSOR_BACK_INDEX}
                />
                {hasResettableChanges ? (
                  <>
                    <span className="text-[#dcdcdc]">│</span>
                    <InlineAction
                      label="⟲ Reset to defaults"
                      onClick={() => handleTableAction(tableResetIndex)}
                      active={activeTableCursorIndex === tableResetIndex}
                    />
                  </>
                ) : null}
              </div>

              <div className="mb-8 flex max-w-[760px] items-start text-[12px]">
                <p className="m-0 text-[12px] font-medium leading-4 text-muted-foreground">
                  <TypedWords text={tableText1} />
                  <TypedInlineSlot delaySteps={tableFlowStep1}>
                    <span className="mr-[12px] inline-flex">
                      <InlineAction
                        label={`${formatLifetimeLong(lifetimeYears)} ⏷`}
                        onClick={() => handleTableAction(tableLifetimeCursorIndex)}
                        active={activeTableCursorIndex === tableLifetimeCursorIndex}
                        variant="strong"
                        cursorClassName="-translate-y-[58%]"
                        className="leading-4"
                      />
                    </span>
                  </TypedInlineSlot>
                  <TypedWords text={tableText2} delaySteps={tableFlowStep2} />
                </p>
              </div>

              <div className="mb-8 w-full max-w-[640px]">
                <div className="mb-1 flex items-center gap-3 text-[12px]">
                  <InlineAction
                    label="-"
                    onClick={() => handleTableAction(tableDecrementCursorIndex)}
                    active={activeTableCursorIndex === tableDecrementCursorIndex}
                    disabled={!tableCanDecrementLifetime}
                    variant="strong"
                    cursorOutside
                  />
                  <div ref={tableSliderTrackRef} className="relative flex-1 pt-5">
                    <button
                      type="button"
                      onClick={() => setTableCursorIndex(tableSliderIndicatorCursorIndex)}
                      onPointerDown={handleLifetimeIndicatorPointerDown}
                      className="absolute top-0 inline-flex -translate-x-1/2 items-center pr-[12px] font-bold text-foreground focus-visible:outline-none"
                      style={{ left: `${tableLifetimeSliderPercent}%` }}
                    >
                      <span className="text-[#aaa] dark:text-[#777]">←</span>
                      <span className="mx-1">{formatLifetimeShort(lifetimeYears)}</span>
                      <span className="text-[#aaa] dark:text-[#777]">→</span>
                      <TerminalCursor
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
                        setLifetimeFromSliderIndex(index)
                      }}
                      className="py-2 [&_[data-slot=slider-track]]:h-px [&_[data-slot=slider-track]]:rounded-none [&_[data-slot=slider-track]]:bg-border [&_[data-slot=slider-range]]:bg-foreground"
                      thumbProps={{
                        className:
                          'size-[44px] rounded-none border-0 bg-transparent opacity-0 shadow-none hover:ring-0 active:ring-0 focus-visible:ring-0',
                      }}
                    />
                  </div>
                  <InlineAction
                    label="+"
                    onClick={() => handleTableAction(tableIncrementCursorIndex)}
                    active={activeTableCursorIndex === tableIncrementCursorIndex}
                    disabled={!tableCanIncrementLifetime}
                    variant="strong"
                    cursorOutside
                  />
                </div>
              </div>

              <div className="w-full max-w-[640px] overflow-x-auto pb-2">
                <div className="w-fit text-[10px]">
                  <div className="grid" style={{ gridTemplateColumns: `46px repeat(${columns.length}, 99px)` }}>
                    <div className="h-6" />
                    {columns.map((column) => (
                      <div key={column.id} className="flex h-6 items-center justify-center font-bold text-foreground">
                        {column.label}
                      </div>
                    ))}

                    {rows.map((row, rowIndex) => (
                      <RowCells
                        key={row.id}
                        row={row}
                        columns={columns}
                        isLastRow={rowIndex === rows.length - 1}
                        lifetimeYears={lifetimeYears}
                        calendarBasis={calendarBasis}
                        customDaysPerYear={customDaysPerYear}
                        displayMode={displayMode}
                        significantDigits={significantDigits}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex max-w-[640px] flex-wrap items-center gap-x-4 gap-y-2 pl-[46px] text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-[12px] border border-border bg-[repeating-linear-gradient(-45deg,#ececec,#ececec_2px,#f5f5f5_2px,#f5f5f5_4px)] dark:bg-[repeating-linear-gradient(-45deg,#181818,#181818_2px,#1f1f1f_2px,#1f1f1f_4px)]" />
                  Not Possible
                </span>
                <span className="text-[#dcdcdc]">│</span>
                <span>Rows: Time saved per task</span>
                <span className="text-[#dcdcdc]">│</span>
                <span>Columns: Task frequency</span>
                <span className="text-[#dcdcdc]">│</span>
                <InlineAction
                  label="Customize"
                  onClick={() => handleTableAction(tableCustomizeCursorIndex)}
                  active={activeTableCursorIndex === tableCustomizeCursorIndex}
                  cursorOutside
                />
              </div>

              {hasCustomCalendar ? (
                <p className="mt-2 text-[10px] text-muted-foreground">* Using {daysPerYear} days per year.</p>
              ) : null}
            </div>

            <PageFooter
              themeLabel={terminalThemeLabel}
              activeIndex={
                activeTableCursorIndex >= tableFooterStartIndex
                  ? activeTableCursorIndex - tableFooterStartIndex
                  : -1
              }
              onAction={(index) => handleTableAction(tableFooterStartIndex + index)}
            />
          </motion.section>
        ) : null}

        {isMenuView ? (
          <motion.section
            key={view}
            variants={screenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] sm:min-h-[calc(100vh-96px)] w-full max-w-[1200px] flex-col"
          >
            <TerminalHeader title={menuTitle} />

            <div
              className="grow max-w-[640px] outline-none"
              tabIndex={0}
              data-screen-autofocus-view={view}
              onKeyDown={handleMenuKeyDown}
            >
              <div className="text-[12px] leading-6">
                {menuLabels.map((label, index) => (
                  <div key={`${label}-${index}`} className="flex items-center gap-2">
                    <div className="w-3 text-foreground">{index === menuIndex ? '🡲' : '\u00A0'}</div>
                    <button
                      type="button"
                      className={cn(
                        'cursor-pointer text-left leading-6 outline-none transition-colors',
                        index === menuSelectedIndex
                          ? 'font-bold text-foreground'
                          : index === menuIndex
                            ? 'font-medium text-foreground'
                          : 'font-medium text-muted-foreground hover:text-foreground',
                      )}
                      onMouseEnter={() => setMenuIndex(index)}
                      onClick={() => selectMenuItem(index)}
                    >
                      {label}
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <div className="w-3 text-foreground">{menuIndex === menuNewOptionIndex ? '🡲' : '\u00A0'}</div>
                  <button
                    type="button"
                    className={cn(
                      'cursor-pointer text-left leading-6 outline-none transition-colors',
                      menuSelectedIndex === menuNewOptionIndex
                        ? 'font-bold text-foreground'
                        : menuIndex === menuNewOptionIndex
                          ? 'font-medium text-foreground'
                          : 'font-medium text-muted-foreground hover:text-foreground',
                    )}
                    onMouseEnter={() => setMenuIndex(menuNewOptionIndex)}
                    onClick={openNewMenuOption}
                  >
                    New option…
                  </button>
                </div>

                <div className="h-4" />

                <div className="flex items-center gap-2">
                  <div className="w-3 text-foreground">{menuIndex === menuCancelIndex ? '🡲' : '\u00A0'}</div>
                  <button
                    type="button"
                    className={cn(
                      interactiveBaseClass,
                      'inline-block w-fit cursor-pointer text-left leading-6 outline-none align-top pb-0 before:bottom-[1px] after:bottom-[1px]',
                      menuIndex === menuCancelIndex && 'after:origin-left after:scale-x-100',
                      menuIndex === menuCancelIndex
                        ? 'font-bold text-foreground'
                        : 'font-medium text-muted-foreground hover:text-foreground',
                    )}
                    onMouseEnter={() => setMenuIndex(menuCancelIndex)}
                    onClick={() => setView(menuReturnView)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            <PageFooter
              themeLabel={terminalThemeLabel}
              activeIndex={menuIndex >= menuFooterStartIndex ? menuIndex - menuFooterStartIndex : -1}
              onAction={(index) => {
                setMenuIndex(menuFooterStartIndex + index)
                handleFooterAction(index)
              }}
            />
          </motion.section>
        ) : null}

        {view === 'customize' ? (
          <motion.section
            key="customize"
            variants={screenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] sm:min-h-[calc(100vh-96px)] w-full max-w-[1200px] flex-col"
            onKeyDown={handleCustomizeKeyDown}
          >
            <TerminalHeader title="Customize table" />

            <div
              className="grow max-w-[640px] outline-none"
              tabIndex={0}
              data-screen-autofocus-view="customize"
            >
              <div className="space-y-12">
                <div>
                  <p className="mb-6 text-[12px] font-bold text-foreground">Columns: Task frequency</p>
                  <TerminalChoiceList
                    items={columnItems.map((item) =>
                      item.kind === 'new-column'
                        ? 'New column…'
                        : item.column.isCustom
                          ? `${formatFrequencyLong(item.column)} (Edit)`
                          : formatFrequencyLong(item.column),
                    )}
                    active={
                      customizeSection === 'columns'
                        ? clampedCustomizeColumnCursorIndex
                        : -1
                    }
                    selected={clampedCustomizeColumnSelectedIndex}
                    onHover={(index) => {
                      setCustomizeSection('columns')
                      setCustomizeColumnCursorIndex(index)
                    }}
                    onActivate={(index) => {
                      setCustomizeSection('columns')
                      setCustomizeColumnCursorIndex(index)
                      setCustomizeColumnSelectedIndex(index)
                      activateCustomizeItem('columns', index)
                    }}
                  />
                </div>

                <div>
                  <p className="mb-6 text-[12px] font-bold text-foreground">Rows: Time saved per task</p>
                  <TerminalChoiceList
                    items={rowItems.map((item) =>
                      item.kind === 'new-row'
                        ? 'New row…'
                        : item.row.isCustom
                          ? `${item.row.label} (Edit)`
                          : item.row.label,
                    )}
                    active={
                      customizeSection === 'rows' ? clampedCustomizeRowCursorIndex : -1
                    }
                    selected={clampedCustomizeRowSelectedIndex}
                    onHover={(index) => {
                      setCustomizeSection('rows')
                      setCustomizeRowCursorIndex(index)
                    }}
                    onActivate={(index) => {
                      setCustomizeSection('rows')
                      setCustomizeRowCursorIndex(index)
                      setCustomizeRowSelectedIndex(index)
                      activateCustomizeItem('rows', index)
                    }}
                  />
                </div>
              </div>

              <div className="mt-12 pl-5 text-[12px] space-y-3">
                {hasCustomizePendingChanges ? (
                  <InlineAction label="Save changes" onClick={() => setView('table')} />
                ) : null}
                <InlineAction label="Cancel" onClick={() => setView('table')} />
              </div>
            </div>

            <PageFooter themeLabel={terminalThemeLabel} onAction={handleFooterAction} />
          </motion.section>
        ) : null}

        {view === 'add-menu-option' ? (
          <motion.section
            key="add-menu-option"
            variants={screenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] sm:min-h-[calc(100vh-96px)] w-full max-w-[1200px] flex-col"
            onKeyDown={handleAddMenuOptionKeyDown}
          >
            <TerminalHeader title={menuCustomTitle} />

            <div className="grow max-w-[640px] text-[12px]">
              <form
                className="space-y-10"
                onSubmit={(event) => {
                  event.preventDefault()
                  submitMenuCustomOption()
                }}
              >
                <label
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground"
                  htmlFor="menu-option-input"
                >
                  {menuCustomFieldLabel}
                  <span
                    className="inline-flex items-center"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      setAddMenuOptionCursorIndex(0)
                      menuOptionInputRef.current?.focus()
                    }}
                  >
                    <input
                      id="menu-option-input"
                      ref={menuOptionInputRef}
                      data-screen-autofocus-view="add-menu-option"
                      value={menuCustomDraft}
                      onChange={(event) => setMenuCustomDraft(event.target.value)}
                      className="w-0 border-0 bg-transparent p-0 text-[12px] font-bold text-foreground caret-transparent outline-none"
                      style={{ width: `${menuCustomDraft.length}ch` }}
                      autoComplete="off"
                      spellCheck={false}
                      onFocus={() => setAddMenuOptionCursorIndex(0)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          closeAddMenuOption()
                        }
                      }}
                    />
                    <TerminalCursor active={addMenuOptionCursorIndex === 0} />
                  </span>
                </label>

                <div className="space-y-3">
                  <div
                    onMouseEnter={() => setAddMenuOptionCursorIndex(1)}
                    onFocus={() => setAddMenuOptionCursorIndex(1)}
                  >
                    <InlineAction
                      label="Cancel"
                      onClick={closeAddMenuOption}
                      active={addMenuOptionCursorIndex === 1}
                      buttonRef={addMenuOptionCancelRef}
                    />
                  </div>
                </div>
              </form>

              <div className="mt-10 text-[12px] leading-5 text-muted-foreground">
                <p className="m-0 font-bold text-foreground">Examples</p>
                {menuCustomKind === 'frequency' ? (
                  <>
                    <p className="mt-2">50/day</p>
                    <p>10 times per day</p>
                    <p>Daily</p>
                    <p>Biweekly</p>
                    <p>2/y</p>
                    <p>...</p>
                    <p>etc</p>
                  </>
                ) : null}
                {menuCustomKind === 'time' ? (
                  <>
                    <p className="mt-2">10s</p>
                    <p>one minute</p>
                    <p>5 min</p>
                    <p>2h</p>
                    <p>five m</p>
                    <p>...</p>
                    <p>etc</p>
                  </>
                ) : null}
                {menuCustomKind === 'lifetime' ? (
                  <>
                    <p className="mt-2">5 years</p>
                    <p>18 months</p>
                    <p>2.5 years</p>
                    <p>6 mo</p>
                    <p>...</p>
                    <p>etc</p>
                  </>
                ) : null}
              </div>
            </div>

            <PageFooter themeLabel={terminalThemeLabel} onAction={handleFooterAction} />
          </motion.section>
        ) : null}

        {view === 'add-column' ? (
          <motion.section
            key="add-column"
            variants={screenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] sm:min-h-[calc(100vh-96px)] w-full max-w-[1200px] flex-col"
          >
            <TerminalHeader title={editingColumnId ? 'Edit table column' : 'Add table column'} />

            <div className="grow max-w-[640px] text-[12px]">
              <form
                className="space-y-10"
                onSubmit={(event) => {
                  event.preventDefault()
                  submitColumn()
                }}
              >
                <label className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground" htmlFor="column-input">
                  Task frequency:
                  <span
                    className="inline-flex items-center"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      columnInputRef.current?.focus()
                    }}
                  >
                    <input
                      id="column-input"
                      ref={columnInputRef}
                      data-screen-autofocus-view="add-column"
                      value={columnDraft}
                      onChange={(event) => setColumnDraft(event.target.value)}
                      className="w-0 border-0 bg-transparent p-0 text-[12px] font-bold text-foreground caret-transparent outline-none"
                      style={{ width: `${columnDraft.length}ch` }}
                      autoComplete="off"
                      spellCheck={false}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setEditingColumnId(null)
                          setColumnDraft('')
                          setView('customize')
                        }
                      }}
                    />
                    <TerminalCursor />
                  </span>
                </label>

                <div className="space-y-3">
                  <InlineAction
                    label="Cancel"
                    onClick={() => {
                      setEditingColumnId(null)
                      setColumnDraft('')
                      setView('customize')
                    }}
                  />
                  {editingColumnId ? (
                    <div>
                      <InlineAction label="Delete column" onClick={deleteEditingColumn} />
                    </div>
                  ) : null}
                </div>
              </form>

              <div className="mt-10 text-[12px] leading-5 text-muted-foreground">
                <p className="m-0 font-bold text-foreground">Examples</p>
                <p className="mt-2">50/day</p>
                <p>10 tasks per day</p>
                <p>Daily</p>
                <p>Biweekly</p>
                <p>2/y</p>
                <p>...</p>
                <p>etc</p>
              </div>
            </div>

            <PageFooter themeLabel={terminalThemeLabel} onAction={handleFooterAction} />
          </motion.section>
        ) : null}

        {view === 'add-row' ? (
          <motion.section
            key="add-row"
            variants={screenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] sm:min-h-[calc(100vh-96px)] w-full max-w-[1200px] flex-col"
          >
            <TerminalHeader title={editingRowId ? 'Edit table row' : 'Add table row'} />

            <div className="grow max-w-[640px] text-[12px]">
              <form
                className="space-y-10"
                onSubmit={(event) => {
                  event.preventDefault()
                  submitRow()
                }}
              >
                <label className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground" htmlFor="row-input">
                  Time saved per task:
                  <span
                    className="inline-flex items-center"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      rowInputRef.current?.focus()
                    }}
                  >
                    <input
                      id="row-input"
                      ref={rowInputRef}
                      data-screen-autofocus-view="add-row"
                      value={rowDraft}
                      onChange={(event) => setRowDraft(event.target.value)}
                      className="w-0 border-0 bg-transparent p-0 text-[12px] font-bold text-foreground caret-transparent outline-none"
                      style={{ width: `${rowDraft.length}ch` }}
                      autoComplete="off"
                      spellCheck={false}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setEditingRowId(null)
                          setRowDraft('')
                          setView('customize')
                        }
                      }}
                    />
                    <TerminalCursor />
                  </span>
                </label>

                <div className="space-y-3">
                  <InlineAction
                    label="Cancel"
                    onClick={() => {
                      setEditingRowId(null)
                      setRowDraft('')
                      setView('customize')
                    }}
                  />
                  {editingRowId ? (
                    <div>
                      <InlineAction label="Delete row" onClick={deleteEditingRow} />
                    </div>
                  ) : null}
                </div>
              </form>

              <div className="mt-10 text-[12px] leading-5 text-muted-foreground">
                <p className="m-0 font-bold text-foreground">Examples</p>
                <p className="mt-2">10s</p>
                <p>one minute</p>
                <p>5 min</p>
                <p>2h</p>
                <p>five m</p>
                <p>...</p>
                <p>etc</p>
              </div>
            </div>

            <PageFooter themeLabel={terminalThemeLabel} onAction={handleFooterAction} />
          </motion.section>
        ) : null}
      </AnimatePresence>
    </main>
  )
}

function ExactResultText({ text }: { text: string }) {
  return (
    <span className="whitespace-nowrap">
      {text.split(/(\d+(?:\.\d+)?)/).map((part, index) => {
        const numeric = Number(part)
        if (part && Number.isFinite(numeric) && /^\d+(?:\.\d+)?$/.test(part)) {
          return (
            <NumberFlow
              key={`${part}-${index}`}
              value={numeric}
              format={{ maximumFractionDigits: 2 }}
            />
          )
        }

        return part ? <span key={`${part}-${index}`}>{part}</span> : null
      })}
    </span>
  )
}

function TypewriterResultText({
  text,
  onComplete,
}: {
  text: string
  onComplete: () => void
}) {
  const [visibleLength, setVisibleLength] = useState(0)

  useEffect(() => {
    let timer = 0
    let cancelled = false

    if (text.length === 0) {
      onComplete()
      return
    }

    const step = (index: number) => {
      if (cancelled) {
        return
      }

      setVisibleLength(index)

      if (index >= text.length) {
        onComplete()
        return
      }

      timer = window.setTimeout(() => step(index + 1), 16)
    }

    timer = window.setTimeout(() => step(1), 50)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [text, onComplete])

  return <span className="whitespace-nowrap">{text.slice(0, visibleLength)}</span>
}

function RowCells({
  row,
  columns,
  isLastRow,
  lifetimeYears,
  calendarBasis,
  customDaysPerYear,
  displayMode,
  significantDigits,
}: {
  row: SavingsRow
  columns: FrequencyColumn[]
  isLastRow: boolean
  lifetimeYears: number
  calendarBasis: (typeof DEFAULT_STATE)['calendarBasis']
  customDaysPerYear: number
  displayMode: (typeof DEFAULT_STATE)['displayMode']
  significantDigits: number
}) {
  return (
    <>
      <div className="flex h-6 items-center justify-end pr-2 text-[10px] font-bold text-foreground">
        {row.label}
      </div>
      {columns.map((column, columnIndex) => {
        const borderClass = cn(
          'border-l border-t border-border',
          columnIndex === columns.length - 1 && 'border-r',
          isLastRow && 'border-b',
        )
        const impossible = isImpossibleCell(row.seconds, column)

        if (impossible) {
          return (
            <div
              key={`${row.id}-${column.id}`}
              className={cn(
                'flex h-6 items-center justify-center bg-[repeating-linear-gradient(-45deg,#ececec,#ececec_2px,#f5f5f5_2px,#f5f5f5_4px)] dark:bg-[repeating-linear-gradient(-45deg,#181818,#181818_2px,#1f1f1f_2px,#1f1f1f_4px)]',
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
                'flex h-6 items-center justify-center text-[10px] text-muted-foreground',
                borderClass,
              )}
              title={formatted.ariaLabel}
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

        return (
          <div
            key={`${row.id}-${column.id}`}
            className={cn(
              'flex h-6 items-center justify-center text-[10px] text-muted-foreground',
              borderClass,
            )}
            title={`${compact.approx ? 'approximately ' : ''}${compact.value} ${compact.unit}`}
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

function TerminalChoiceList({
  items,
  active,
  selected,
  onHover,
  onActivate,
}: {
  items: string[]
  active: number
  selected: number
  onHover: (index: number) => void
  onActivate: (index: number) => void
}) {
  return (
    <div className="flex gap-2 text-[12px] leading-6">
      <div className="w-3 text-foreground">
        {items.map((_, index) => (
          <div key={String(index)}>{index === active ? '🡲' : '\u00A0'}</div>
        ))}
      </div>
      <div className="text-muted-foreground">
        {items.map((item, index) => (
          <button
            key={`${item}-${index}`}
            type="button"
            className={cn(
              'block cursor-pointer text-left leading-6 outline-none transition-colors',
              index === selected
                ? 'font-bold text-foreground'
                : index === active
                  ? 'font-medium text-foreground'
                  : 'font-medium text-muted-foreground hover:text-foreground',
            )}
            onMouseEnter={() => onHover(index)}
            onClick={() => onActivate(index)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  )
}

function TypedWords({ text, delaySteps = 0 }: { text: string; delaySteps?: number }) {
  const tokens = text.split(/(\s+)/).filter(Boolean)

  return (
    <span>
      {tokens.map((token, index) => {
        const whitespace = /^\s+$/.test(token)

        if (whitespace) {
          return <span key={`ws-${index}`}>{token}</span>
        }

        const currentAnimatedIndex =
          tokens
            .slice(0, index + 1)
            .filter((part) => !/^\s+$/.test(part)).length - 1

        return (
          <motion.span
            key={`word-${token}-${index}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: WORD_REVEAL_DURATION_SECONDS,
              delay: (delaySteps + currentAnimatedIndex) * WORD_REVEAL_STEP_SECONDS,
            }}
          >
            {token}
          </motion.span>
        )
      })}
    </span>
  )
}

function TypedInlineSlot({
  delaySteps,
  children,
}: {
  delaySteps: number
  children: ReactNode
}) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: WORD_REVEAL_DURATION_SECONDS,
        delay: delaySteps * WORD_REVEAL_STEP_SECONDS,
      }}
      className="inline-flex"
    >
      {children}
    </motion.span>
  )
}

function InlineAction({
  label,
  onClick,
  active = false,
  disabled = false,
  variant = 'muted',
  cursorClassName,
  cursorOutside = true,
  underlineTight = false,
  className,
  buttonRef,
}: {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  variant?: 'muted' | 'strong'
  cursorClassName?: string
  cursorOutside?: boolean
  underlineTight?: boolean
  className?: string
  buttonRef?: Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        interactiveBaseClass,
        cursorOutside ? 'pr-0' : 'pr-[12px]',
        underlineTight && 'pb-0 before:bottom-[1px] after:bottom-[1px]',
        active && 'after:origin-left after:scale-x-100',
        variant === 'strong' || active
          ? 'font-bold text-foreground'
          : 'font-medium text-muted-foreground hover:text-foreground',
        disabled && 'pointer-events-none opacity-30',
        className,
      )}
    >
      {label}
      <TerminalCursor
        active={active}
        className={cn(
          cursorOutside
            ? 'absolute left-full ml-1 top-1/2 -translate-y-1/2'
            : 'absolute right-0 top-1/2 -translate-y-1/2',
          cursorClassName,
        )}
      />
    </button>
  )
}

function TerminalCursor({
  className,
  active = true,
}: {
  className?: string
  active?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-block h-[12px] w-[8px] bg-foreground transition-opacity',
        active ? 'opacity-100 animate-[terminal-blink_1s_steps(1,end)_infinite]' : 'opacity-0',
        className,
      )}
      aria-hidden="true"
    />
  )
}

function TerminalHeader({ title }: { title: string }) {
  return (
    <header className="mb-12">
      <h1 className="m-0 text-[12px] font-bold leading-none text-foreground">{title}</h1>
    </header>
  )
}

function focusLifetimeYearsRounded(value: number) {
  return Number.parseFloat(value.toFixed(2))
}

function formatLifetimePeriod(value: number) {
  if (value < 1) {
    const months = value * 12
    return `${strip(months)}-month`
  }

  return `${strip(value)}-year`
}

function formatLifetimeLong(value: number) {
  if (value < 1) {
    const months = value * 12
    return `${strip(months)} ${months === 1 ? 'month' : 'months'}`
  }

  return `${strip(value)} ${value === 1 ? 'year' : 'years'}`
}

function formatLifetimeShort(value: number) {
  if (value < 1) {
    return `${strip(value * 12)}mo`
  }

  return `${strip(value)}y`
}

function formatFrequencyLong(value: FrequencyColumn) {
  if (value.unit === 'day') {
    if (value.amount === 1) {
      return 'Daily'
    }

    return `${strip(value.amount)} times a day`
  }

  if (value.unit === 'week') {
    if (value.amount === 1) {
      return 'Weekly'
    }

    return `${strip(value.amount)} times a week`
  }

  if (value.unit === 'month') {
    if (value.amount === 1) {
      return 'Monthly'
    }

    return `${strip(value.amount)} times a month`
  }

  if (value.amount === 1) {
    return 'Yearly'
  }

  return `${strip(value.amount)} times a year`
}

function formatLongDuration(seconds: number) {
  if (seconds % 86400 === 0) {
    const days = seconds / 86400
    return `${strip(days)} ${days === 1 ? 'day' : 'days'}`
  }

  if (seconds % 3600 === 0) {
    const hours = seconds / 3600
    return `${strip(hours)} ${hours === 1 ? 'hour' : 'hours'}`
  }

  if (seconds % 60 === 0) {
    const minutes = seconds / 60
    return `${strip(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}`
  }

  return `${strip(seconds)} ${seconds === 1 ? 'second' : 'seconds'}`
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
  return Number.parseFloat(value.toFixed(4)).toString()
}

function formatResultNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

function getFlowStepCount(text: string) {
  return text.split(/(\s+)/).filter((token) => token && !/^\s+$/.test(token)).length
}

function isActivationKey(key: string) {
  return key === 'Enter' || key === ' ' || key === 'Spacebar'
}

function clampIndex(index: number, length: number) {
  if (length <= 0) {
    return 0
  }

  return Math.max(0, Math.min(index, length - 1))
}

function valuesNearlyEqual(a: number, b: number) {
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
