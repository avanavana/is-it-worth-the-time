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
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

import { PageFooter } from '@/components/layout/page-footer'
import { Separator } from '@/components/ui/separator'
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
import type { CompactCellDisplay } from '../formatters'
import { useAutomationROIStore } from '../hooks/use-automation-roi-store'
import { parseDurationInput, parseFrequencyInput, parseTimeSavedInput } from '../parsers'
import { savePersistedState } from '../storage'
import type { CalendarBasis, FrequencyColumn, SavingsRow } from '../types'

type View =
  | 'home'
  | 'table'
  | 'settings'
  | 'menu-frequency'
  | 'menu-time'
  | 'menu-lifetime'
  | 'add-menu-option'
  | 'customize'
  | 'add-column'
  | 'add-row'

type BaseView = 'home' | 'table'
type CustomizeSection = 'columns' | 'rows' | 'actions'
type MenuCustomKind = 'frequency' | 'time' | 'lifetime'

interface FrequencyOption {
  label: string
  value: FrequencyColumn
}

interface TimeOption {
  label: string
  seconds: number
}

interface SettingsOption {
  id: 'exact' | 'calendar' | 'theme' | 'keyboard' | 'reset'
  label: string
  value?: string
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
const reducedMotionScreenVariants = {
  hidden: { opacity: 1, y: 0, filter: 'blur(0px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0 } },
  exit: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0 } },
}

const interactiveBaseClass =
  "relative inline-flex items-center whitespace-nowrap pb-[1px] leading-4 transition-colors before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-px before:w-full before:bg-underline after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-foreground after:opacity-0 motion-safe:after:opacity-100 motion-safe:after:origin-right motion-safe:after:scale-x-0 motion-safe:after:transition-transform motion-safe:after:duration-300 motion-safe:hover:after:origin-left motion-safe:hover:after:scale-x-100 motion-reduce:after:scale-x-100 motion-reduce:after:transition-opacity motion-reduce:after:duration-150 motion-reduce:hover:after:opacity-100 focus-visible:outline-none"

const TABLE_CURSOR_BACK_INDEX = 0
const PARSER_YEAR_SECONDS = 365 * 24 * 60 * 60
const DEFAULT_FOCUS_FREQUENCY = DEFAULT_COLUMNS[1]
const DEFAULT_FOCUS_TIME_SAVED_SECONDS = 60
const WORD_REVEAL_STEP_SECONDS = 0.01
const WORD_REVEAL_DURATION_SECONDS = 0.18
const HOME_STAGE_STAGGER_MS = 90
const MENU_OPTION_STAGGER_MS = 85
const MENU_OPTION_CHAR_MS = 14
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
    autoHideKeyCommands,
    setLifetimeYears,
    setCalendarBasis,
    setDisplayMode,
    setAutoHideKeyCommands,
    addCustomRow,
    updateCustomRow,
    deleteCustomRow,
    addCustomColumn,
    updateCustomColumn,
    deleteCustomColumn,
    resetDefaults,
  } = useAutomationROIStore()

  const { resolvedTheme, setTheme, theme } = useTheme()
  const prefersReducedMotion = useReducedMotion()
  const activeScreenVariants = prefersReducedMotion
    ? reducedMotionScreenVariants
    : screenVariants
  const stagedRevealMotionProps = prefersReducedMotion
    ? { initial: false as const, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 4 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.2 },
      }

  const [view, setView] = useState<View>('home')
  const [settingsReturnView, setSettingsReturnView] = useState<Exclude<View, 'settings'>>('home')
  const [settingsIndex, setSettingsIndex] = useState(0)
  const [menuReturnView, setMenuReturnView] = useState<BaseView>('home')
  const [menuIndex, setMenuIndex] = useState(0)
  const [menuCustomKind, setMenuCustomKind] = useState<MenuCustomKind>('frequency')
  const [menuCustomDraft, setMenuCustomDraft] = useState('')

  const [focusFrequency, setFocusFrequency] = useState(() => ({ ...DEFAULT_FOCUS_FREQUENCY }))
  const [focusTimeSavedSeconds, setFocusTimeSavedSeconds] = useState(
    DEFAULT_FOCUS_TIME_SAVED_SECONDS,
  )
  const [homeCursorIndex, setHomeCursorIndex] = useState(HOME_CURSOR_RESULT_INDEX)
  const [resultTypewriterRunId, setResultTypewriterRunId] = useState(0)
  const [resultTypewriterDone, setResultTypewriterDone] = useState(false)
  const [homeRevealStage, setHomeRevealStage] = useState(0)
  const [tableCursorIndex, setTableCursorIndex] = useState(1)
  const previousHasResettableChangesRef = useRef<boolean | null>(null)

  const [customizeSection, setCustomizeSection] = useState<CustomizeSection>('columns')
  const [customizeColumnCursorIndex, setCustomizeColumnCursorIndex] = useState(0)
  const [customizeRowCursorIndex, setCustomizeRowCursorIndex] = useState(0)
  const [customizeActionCursorIndex, setCustomizeActionCursorIndex] = useState(0)
  const [customizeColumnSelectedIndex, setCustomizeColumnSelectedIndex] = useState(0)
  const [customizeRowSelectedIndex, setCustomizeRowSelectedIndex] = useState(0)
  const [customizeBaseline, setCustomizeBaseline] = useState<{
    rows: SavingsRow[]
    columns: FrequencyColumn[]
  } | null>(null)

  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [addColumnCursorIndex, setAddColumnCursorIndex] = useState(0)
  const [addRowCursorIndex, setAddRowCursorIndex] = useState(0)
  const [addMenuOptionCursorIndex, setAddMenuOptionCursorIndex] = useState(0)
  const [columnDraft, setColumnDraft] = useState('')
  const [rowDraft, setRowDraft] = useState('')
  const menuOptionInputRef = useRef<HTMLInputElement | null>(null)
  const addMenuOptionCancelRef = useRef<HTMLButtonElement | null>(null)
  const columnInputRef = useRef<HTMLInputElement | null>(null)
  const rowInputRef = useRef<HTMLInputElement | null>(null)
  const addColumnCancelRef = useRef<HTMLButtonElement | null>(null)
  const addColumnDeleteRef = useRef<HTMLButtonElement | null>(null)
  const addRowCancelRef = useRef<HTMLButtonElement | null>(null)
  const addRowDeleteRef = useRef<HTMLButtonElement | null>(null)
  const tableSliderTrackRef = useRef<HTMLDivElement | null>(null)

  const runsPerYear = getRunsPerYear(focusFrequency, calendarBasis, customDaysPerYear)
  const focusResultSeconds = calculateBreakEvenSeconds(focusTimeSavedSeconds, runsPerYear, lifetimeYears)
  const focusResult = formatCompactCellDisplay(focusResultSeconds)
  const focusResultExactText = formatPreciseLongText(focusResultSeconds)
  const focusResultApproxText = formatFocusApproxText(focusResult, calendarBasis)
  const focusImpossible = isImpossibleCell(focusTimeSavedSeconds, focusFrequency)
  const focusResultTypewriterText = focusImpossible
    ? '—'
    : displayMode === 'exact'
      ? focusResultExactText
      : focusResultApproxText
  const shouldTypeResultText = !prefersReducedMotion && !resultTypewriterDone
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
        autoHideKeyCommands,
      }),
    [
      lifetimeYears,
      calendarBasis,
      customDaysPerYear,
      rows,
      columns,
      displayMode,
      significantDigits,
      autoHideKeyCommands,
    ],
  )
  const hasFocusOverrides =
    !valuesNearlyEqual(focusFrequency.amount, DEFAULT_FOCUS_FREQUENCY.amount) ||
    focusFrequency.unit !== DEFAULT_FOCUS_FREQUENCY.unit ||
    focusTimeSavedSeconds !== DEFAULT_FOCUS_TIME_SAVED_SECONDS
  const hasResettableChanges = hasResettableStoreChanges || hasFocusOverrides

  useEffect(() => {
    const previous = previousHasResettableChangesRef.current
    if (previous === null) {
      previousHasResettableChangesRef.current = hasResettableChanges
      return
    }

    if (previous === hasResettableChanges) {
      return
    }

    previousHasResettableChangesRef.current = hasResettableChanges
    setTableCursorIndex((current) =>
      remapTableCursorIndexForResetSlot(current, previous, hasResettableChanges),
    )
  }, [hasResettableChanges])

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
  const isSettingsView = view === 'settings'

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
  const menuCursorMaxIndex = menuItemCount - 1

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
  const customizeActionItems = [
    ...(hasCustomizePendingChanges ? (['save'] as const) : []),
    'cancel' as const,
  ]
  const clampedCustomizeActionCursorIndex = clampIndex(
    customizeActionCursorIndex,
    customizeActionItems.length,
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
      autoHideKeyCommands,
    })
  }, [
    persistedLifetimeYears,
    calendarBasis,
    customDaysPerYear,
    rows,
    columns,
    displayMode,
    significantDigits,
    autoHideKeyCommands,
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

  function openSettings(returnView: Exclude<View, 'settings'>) {
    setSettingsReturnView(returnView)
    setSettingsIndex(1)
    setView('settings')
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
      setDisplayMode(displayMode === 'exact' ? 'humanized' : 'exact')
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
      if (
        activeHomeCursorIndex === HOME_CURSOR_RESULT_INDEX &&
        hasResettableChanges &&
        homeRevealStage >= HOME_REVEAL_STAGE_RESET
      ) {
        resetAllDefaults()
        return
      }

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
      }
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

  function activateSettingsOption(index: number) {
    const option = settingsOptions[index]
    if (!option) {
      return
    }

    if (option.id === 'reset') {
      resetAllDefaults()
      return
    }

    if (option.id === 'exact') {
      setDisplayMode(displayMode === 'exact' ? 'humanized' : 'exact')
      return
    }

    if (option.id === 'calendar') {
      setCalendarBasis(calendarBasis === 'workdays' ? 'calendar' : 'workdays')
      return
    }

    if (option.id === 'keyboard') {
      setAutoHideKeyCommands(!autoHideKeyCommands)
      return
    }

    cycleTheme()
  }

  function handleSettingsKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!isSettingsView) {
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
      setSettingsIndex((current) => {
        if (moveBackward) {
          return current === 0 ? settingsCursorMaxIndex : current - 1
        }

        return current === settingsCursorMaxIndex ? 0 : current + 1
      })
      return
    }

    if (isActivationKey(event.key)) {
      event.preventDefault()

      if (settingsIndex === settingsBackIndex) {
        setView(settingsReturnView)
        return
      }

      activateSettingsOption(settingsIndex - settingsOptionStartIndex)
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setView(settingsReturnView)
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
    setCustomizeActionCursorIndex(0)
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
        setAddColumnCursorIndex(0)
        setView('add-column')
        return
      }

      if (!item.column.isCustom) {
        toast.error('Preset columns are fixed. Add a new column instead.')
        return
      }

      setEditingColumnId(item.column.id)
      setColumnDraft(`${strip(item.column.amount)}/${item.column.unit}`)
      setAddColumnCursorIndex(0)
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
      setAddRowCursorIndex(0)
      setView('add-row')
      return
    }

    if (!item.row.isCustom) {
      toast.error('Preset rows are fixed. Add a new row instead.')
      return
    }

    setEditingRowId(item.row.id)
    setRowDraft(formatLongDuration(item.row.seconds))
    setAddRowCursorIndex(0)
    setView('add-row')
  }

  function deleteActiveCustomizeItem() {
    if (customizeSection === 'actions') {
      return
    }

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

    if (event.key === 'Tab') {
      event.preventDefault()
      const cancelActionIndex = Math.max(0, customizeActionItems.indexOf('cancel'))

      if (event.shiftKey) {
        if (customizeSection === 'columns') {
          setCustomizeSection('actions')
          setCustomizeActionCursorIndex(cancelActionIndex)
        } else if (customizeSection === 'actions') {
          setCustomizeSection('rows')
          setCustomizeRowCursorIndex(0)
        } else {
          setCustomizeSection('columns')
          setCustomizeColumnCursorIndex(0)
        }
      } else {
        if (customizeSection === 'columns') {
          setCustomizeSection('rows')
          setCustomizeRowCursorIndex(0)
        } else if (customizeSection === 'rows') {
          setCustomizeSection('actions')
          setCustomizeActionCursorIndex(cancelActionIndex)
        } else {
          setCustomizeSection('columns')
          setCustomizeColumnCursorIndex(0)
        }
      }
      return
    }

    const moveBackward =
      event.key === 'ArrowUp' || event.key === 'ArrowLeft'
    const moveForward =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'

    if (moveBackward || moveForward) {
      event.preventDefault()

      const step = moveForward ? 1 : -1
      const actionCount = customizeActionItems.length

      if (customizeSection === 'columns') {
        if (step > 0) {
          if (clampedCustomizeColumnCursorIndex < columnItems.length - 1) {
            setCustomizeColumnCursorIndex((current) =>
              Math.min(current + 1, columnItems.length - 1),
            )
          } else {
            setCustomizeSection('rows')
            setCustomizeRowCursorIndex(0)
          }
        } else if (clampedCustomizeColumnCursorIndex > 0) {
          setCustomizeColumnCursorIndex((current) => Math.max(current - 1, 0))
        } else if (actionCount > 0) {
          setCustomizeSection('actions')
          setCustomizeActionCursorIndex(actionCount - 1)
        } else {
          setCustomizeSection('rows')
          setCustomizeRowCursorIndex(Math.max(0, rowItems.length - 1))
        }
        return
      }

      if (customizeSection === 'rows') {
        if (step > 0) {
          if (clampedCustomizeRowCursorIndex < rowItems.length - 1) {
            setCustomizeRowCursorIndex((current) => Math.min(current + 1, rowItems.length - 1))
          } else if (actionCount > 0) {
            setCustomizeSection('actions')
            setCustomizeActionCursorIndex(0)
          } else {
            setCustomizeSection('columns')
            setCustomizeColumnCursorIndex(0)
          }
        } else if (clampedCustomizeRowCursorIndex > 0) {
          setCustomizeRowCursorIndex((current) => Math.max(current - 1, 0))
        } else {
          setCustomizeSection('columns')
          setCustomizeColumnCursorIndex(Math.max(0, columnItems.length - 1))
        }
        return
      }

      if (step > 0) {
        if (clampedCustomizeActionCursorIndex < actionCount - 1) {
          setCustomizeActionCursorIndex((current) => Math.min(current + 1, actionCount - 1))
        } else {
          setCustomizeSection('columns')
          setCustomizeColumnCursorIndex(0)
        }
      } else if (clampedCustomizeActionCursorIndex > 0) {
        setCustomizeActionCursorIndex((current) => Math.max(current - 1, 0))
      } else {
        setCustomizeSection('rows')
        setCustomizeRowCursorIndex(Math.max(0, rowItems.length - 1))
      }
    }

    if (isActivationKey(event.key)) {
      event.preventDefault()
      if (customizeSection === 'columns') {
        activateCustomizeItem('columns', clampedCustomizeColumnCursorIndex)
        return
      }
      if (customizeSection === 'rows') {
        activateCustomizeItem('rows', clampedCustomizeRowCursorIndex)
        return
      }

      const action = customizeActionItems[clampedCustomizeActionCursorIndex]
      if (action === 'save') {
        setView('table')
        return
      }
      setView('table')
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

  function closeAddColumn() {
    setEditingColumnId(null)
    setColumnDraft('')
    setAddColumnCursorIndex(0)
    setView('customize')
  }

  function closeAddRow() {
    setEditingRowId(null)
    setRowDraft('')
    setAddRowCursorIndex(0)
    setView('customize')
  }

  function focusAddColumnCursor(index: number) {
    if (index === 0) {
      columnInputRef.current?.focus({ preventScroll: true })
      return
    }

    if (index === 1) {
      addColumnCancelRef.current?.focus({ preventScroll: true })
      return
    }

    addColumnDeleteRef.current?.focus({ preventScroll: true })
  }

  function focusAddRowCursor(index: number) {
    if (index === 0) {
      rowInputRef.current?.focus({ preventScroll: true })
      return
    }

    if (index === 1) {
      addRowCancelRef.current?.focus({ preventScroll: true })
      return
    }

    addRowDeleteRef.current?.focus({ preventScroll: true })
  }

  function handleAddColumnKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (view !== 'add-column') {
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
    const maxIndex = editingColumnId ? 2 : 1

    if (moveBackward || moveForward) {
      event.preventDefault()
      const nextIndex = moveForward
        ? addColumnCursorIndex === maxIndex
          ? 0
          : addColumnCursorIndex + 1
        : addColumnCursorIndex === 0
          ? maxIndex
          : addColumnCursorIndex - 1
      setAddColumnCursorIndex(nextIndex)
      focusAddColumnCursor(nextIndex)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeAddColumn()
      return
    }

    if (event.key === 'Enter' && addColumnCursorIndex === 0) {
      event.preventDefault()
      submitColumn()
      return
    }

    if (isActivationKey(event.key) && addColumnCursorIndex !== 0) {
      event.preventDefault()
      if (addColumnCursorIndex === 1) {
        closeAddColumn()
        return
      }

      deleteEditingColumn()
    }
  }

  function handleAddRowKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (view !== 'add-row') {
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
    const maxIndex = editingRowId ? 2 : 1

    if (moveBackward || moveForward) {
      event.preventDefault()
      const nextIndex = moveForward
        ? addRowCursorIndex === maxIndex
          ? 0
          : addRowCursorIndex + 1
        : addRowCursorIndex === 0
          ? maxIndex
          : addRowCursorIndex - 1
      setAddRowCursorIndex(nextIndex)
      focusAddRowCursor(nextIndex)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeAddRow()
      return
    }

    if (event.key === 'Enter' && addRowCursorIndex === 0) {
      event.preventDefault()
      submitRow()
      return
    }

    if (isActivationKey(event.key) && addRowCursorIndex !== 0) {
      event.preventDefault()
      if (addRowCursorIndex === 1) {
        closeAddRow()
        return
      }

      deleteEditingRow()
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

  function getSettingsReturnViewForCurrentView(): Exclude<View, 'settings'> {
    if (view === 'settings') {
      return settingsReturnView
    }

    return view
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
      if (view !== 'settings') {
        openSettings(getSettingsReturnViewForCurrentView())
      }
    }
  }

  const terminalThemeLabel =
    theme === 'system' ? 'System' : resolvedTheme === 'dark' ? 'Dark' : 'Light'
  const settingsOptions: SettingsOption[] = [
    {
      id: 'exact' as const,
      label: 'Show exact values:',
      value: displayMode === 'exact' ? 'Yes' : 'No',
    },
    {
      id: 'calendar' as const,
      label: 'Calendar basis:',
      value:
        calendarBasis === 'workdays'
          ? '8-hour workday/5-day workweek/260-day work year'
          : '24-hour day/7-day week/365-day year',
    },
    { id: 'theme' as const, label: 'Theme:', value: terminalThemeLabel },
    {
      id: 'keyboard' as const,
      label: 'Auto-hide key commands:',
      value: autoHideKeyCommands ? 'Yes' : 'No',
    },
    ...(hasResettableChanges
      ? [{ id: 'reset' as const, label: 'Reset to defaults' }]
      : []),
  ]
  const settingsBackIndex = 0
  const settingsOptionStartIndex = 1
  const settingsCursorMaxIndex = settingsOptions.length

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

    const maxStage = HOME_REVEAL_STAGE_FOOTER_START + FOOTER_ACTION_COUNT - 1
    if (prefersReducedMotion) {
      const reducedTimer = window.setTimeout(() => setHomeRevealStage(maxStage), 0)
      return () => {
        window.clearTimeout(reducedTimer)
      }
    }

    const resetTimer = window.setTimeout(() => setHomeRevealStage(0), 0)
    const baseDelayMs = Math.max(0, Math.round(homeSentenceEndDelaySeconds * 1000))
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
  }, [homeSentenceEndDelaySeconds, prefersReducedMotion, view])

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-12 sm:py-12">
      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <motion.section
            key="home"
            variants={activeScreenVariants}
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
                      label={
                        <InlineSelectTriggerLabel
                          text={formatFrequencyLong(focusFrequency)}
                        />
                      }
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
                      label={
                        <InlineSelectTriggerLabel
                          text={formatLongDuration(focusTimeSavedSeconds)}
                        />
                      }
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
                      label={
                        <InlineSelectTriggerLabel
                          text={formatLifetimePeriod(focusLifetimeYearsRounded(lifetimeYears))}
                        />
                      }
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
                  {...stagedRevealMotionProps}
                  className="mt-12 text-[12px]"
                >
                  <div className="flex items-center">
                    <button
                      type="button"
                      className="relative inline-flex h-6 cursor-pointer items-center whitespace-nowrap pr-[12px] font-bold text-foreground focus-visible:outline-none"
                      onClick={() => handleHomeAction(HOME_CURSOR_RESULT_INDEX)}
                    >
                      {!shouldTypeResultText ? (
                        focusImpossible ? (
                          <span>—</span>
                        ) : displayMode === 'exact' ? (
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
                        active={
                          activeHomeCursorIndex === HOME_CURSOR_RESULT_INDEX &&
                          (prefersReducedMotion || resultTypewriterDone)
                        }
                        className="absolute right-0 top-1/2 -translate-y-1/2"
                      />
                    </button>
                  </div>
                </motion.div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 text-[12px]">
                {homeRevealStage >= HOME_REVEAL_STAGE_SHOW_TABLE ? (
                  <motion.div {...stagedRevealMotionProps}>
                    <InlineAction
                      label="Show full table 🡪"
                      onClick={() => handleHomeAction(4)}
                      active={activeHomeCursorIndex === 4}
                    />
                  </motion.div>
                ) : null}

                {hasResettableChanges && homeRevealStage >= HOME_REVEAL_STAGE_RESET ? (
                  <>
                    <motion.div {...stagedRevealMotionProps}>
                      <Separator aria-hidden />
                    </motion.div>
                    <motion.div {...stagedRevealMotionProps}>
                      <InlineAction
                        label="⟲ Reset to defaults"
                        onClick={() => handleHomeAction(5)}
                        active={activeHomeCursorIndex === 5}
                      />
                    </motion.div>
                  </>
                ) : null}
              </div>

              {hasCustomCalendar && homeRevealStage >= HOME_REVEAL_STAGE_NOTE ? (
                <motion.p
                  {...stagedRevealMotionProps}
                  className="mt-3 text-[10px] text-muted-foreground"
                >
                  * Using {daysPerYear} days per year.
                </motion.p>
              ) : null}
            </div>

            <PageFooter
              activeIndex={
                activeHomeCursorIndex >= homeFooterStartIndex
                  ? activeHomeCursorIndex - homeFooterStartIndex
                  : -1
              }
              onAction={(index) => handleHomeAction(homeFooterStartIndex + index)}
              revealCount={homeFooterRevealCount}
              autoHideKeyCommands={autoHideKeyCommands}
              keyboardCommandsVisible={homeFooterRevealCount > 0}
              className={cn(
                !prefersReducedMotion && 'transition-all duration-200',
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
            variants={activeScreenVariants}
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
                    <Separator aria-hidden />
                    <InlineAction
                      label="⟲ Reset to defaults"
                      onClick={() => handleTableAction(tableResetIndex)}
                      active={activeTableCursorIndex === tableResetIndex}
                    />
                  </>
                ) : null}
              </div>

              <div className="mb-8 flex max-w-[760px] items-start text-[12px]">
                <p className="m-0 text-[12px] font-medium leading-6 text-muted-foreground">
                  <TypedWords text={tableText1} />
                  <TypedInlineSlot delaySteps={tableFlowStep1}>
                    <span className="mr-[12px] inline-flex">
                      <InlineAction
                        label={
                          <InlineSelectTriggerLabel
                            text={formatLifetimeLong(lifetimeYears)}
                          />
                        }
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
                      className={cn(
                        'group absolute top-0 inline-flex -translate-x-1/2 items-center pr-[12px] text-[10px] font-bold text-foreground focus-visible:outline-none',
                      )}
                      style={{ left: `${tableLifetimeSliderPercent}%` }}
                    >
                      <span className="text-underline">←</span>
                      <span
                        className={cn(
                          interactiveBaseClass,
                          'mx-1 group-hover:motion-safe:after:origin-left group-hover:motion-safe:after:scale-x-100 group-hover:motion-reduce:after:opacity-100',
                          activeTableCursorIndex === tableSliderIndicatorCursorIndex &&
                            'motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100',
                        )}
                      >
                        {formatLifetimeShort(lifetimeYears)}
                      </span>
                      <span className="text-underline">→</span>
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
                      className="py-2 **:data-[slot=slider-track]:h-px **:data-[slot=slider-track]:rounded-none **:data-[slot=slider-track]:bg-underline **:data-[slot=slider-range]:bg-foreground"
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

              <div className="mt-2 flex max-w-[640px] flex-wrap items-center gap-x-4 gap-y-2 pl-[46px] text-[10px] text-muted-foreground h-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-[12px] border border-border bg-hatch" />
                  Not Possible
                </span>
                <Separator />
                <span>Rows: Time saved per task</span>
                <Separator />
                <span>Columns: Task frequency</span>
                <Separator />
                <InlineAction
                  label="Customize"
                  onClick={() => handleTableAction(tableCustomizeCursorIndex)}
                  active={activeTableCursorIndex === tableCustomizeCursorIndex}
                  cursorOutside
                />
              </div>

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
              onAction={(index) => handleTableAction(tableFooterStartIndex + index)}
              autoHideKeyCommands={autoHideKeyCommands}
              keyboardCommandsVisible
            />
          </motion.section>
        ) : null}

        {view === 'settings' ? (
          <motion.section
            key="settings"
            variants={activeScreenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] sm:min-h-[calc(100vh-96px)] w-full max-w-[1200px] flex-col"
          >
            <TerminalHeader title="Settings" />

            <div
              className="grow max-w-[640px] outline-none"
              tabIndex={0}
              data-screen-autofocus-view="settings"
              onKeyDown={handleSettingsKeyDown}
            >
              <div className="mb-8 flex items-center gap-4 text-[12px]">
                <InlineAction
                  label={
                    <MenuOptionTypewriter
                      text="🡨 Back"
                      startDelayMs={0}
                      animateOnlyOnMount
                    />
                  }
                  onClick={() => setView(settingsReturnView)}
                  active={settingsIndex === settingsBackIndex}
                />
              </div>

              <div className="text-[12px] leading-6">
                {settingsOptions.map((option, index) => {
                  const optionIndex = settingsOptionStartIndex + index

                  return (
                    <div key={option.id} className="flex items-center gap-2">
                      <div className="w-3 text-foreground">
                        {optionIndex === settingsIndex ? '🡲' : '\u00A0'}
                      </div>
                      <button
                        type="button"
                        className={cn(
                          'cursor-pointer text-left leading-6 outline-none transition-colors',
                          optionIndex === settingsIndex
                            ? 'font-bold text-foreground'
                            : 'font-medium text-muted-foreground hover:text-foreground',
                        )}
                        onMouseEnter={() => setSettingsIndex(optionIndex)}
                        onClick={() => activateSettingsOption(index)}
                      >
                        <span
                          className={cn(
                            option.value
                              ? 'grid grid-cols-[24ch_1fr] items-baseline gap-x-8 leading-normal'
                              : 'block',
                          )}
                        >
                          <span>
                            <MenuOptionTypewriter
                              text={option.label}
                              startDelayMs={optionIndex * MENU_OPTION_STAGGER_MS}
                              animateOnlyOnMount
                            />
                          </span>
                          {option.value ? (
                            <span>
                              <MenuOptionTypewriter
                                text={option.value}
                                startDelayMs={optionIndex * MENU_OPTION_STAGGER_MS}
                                animateOnlyOnMount
                              />
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

          </motion.section>
        ) : null}

        {isMenuView ? (
          <motion.section
            key={view}
            variants={activeScreenVariants}
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
                        index === menuIndex
                          ? 'font-bold text-foreground'
                          : index === menuSelectedIndex
                          ? 'font-bold text-foreground'
                          : 'font-medium text-muted-foreground hover:text-foreground',
                      )}
                      onMouseEnter={() => setMenuIndex(index)}
                      onClick={() => selectMenuItem(index)}
                    >
                      <MenuOptionTypewriter
                        text={label}
                        startDelayMs={index * MENU_OPTION_STAGGER_MS}
                      />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <div className="w-3 text-foreground">{menuIndex === menuNewOptionIndex ? '🡲' : '\u00A0'}</div>
                  <button
                    type="button"
                    className={cn(
                      'cursor-pointer text-left leading-6 outline-none transition-colors',
                      menuIndex === menuNewOptionIndex
                        ? 'font-bold text-foreground'
                        : menuSelectedIndex === menuNewOptionIndex
                        ? 'font-bold text-foreground'
                        : 'font-medium text-muted-foreground hover:text-foreground',
                    )}
                    onMouseEnter={() => setMenuIndex(menuNewOptionIndex)}
                    onClick={openNewMenuOption}
                  >
                    <MenuOptionTypewriter
                      text="New option…"
                      startDelayMs={menuNewOptionIndex * MENU_OPTION_STAGGER_MS}
                    />
                  </button>
                </div>

                <div className="h-4" />

                <div className="flex items-center gap-2">
                  <div className="w-3 text-foreground">{menuIndex === menuCancelIndex ? '🡲' : '\u00A0'}</div>
                    <button
                      type="button"
                      className={cn(
                        interactiveBaseClass,
                        'inline-flex w-fit items-center cursor-pointer text-left outline-none align-top',
                        menuIndex === menuCancelIndex &&
                          'motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100',
                        menuIndex === menuCancelIndex
                        ? 'font-bold text-foreground'
                        : 'font-medium text-muted-foreground hover:text-foreground',
                    )}
                    onMouseEnter={() => setMenuIndex(menuCancelIndex)}
                    onClick={() => setView(menuReturnView)}
                  >
                    <MenuOptionTypewriter
                      text="Cancel"
                      startDelayMs={menuCancelIndex * MENU_OPTION_STAGGER_MS}
                    />
                  </button>
                </div>
              </div>
            </div>

          </motion.section>
        ) : null}

        {view === 'customize' ? (
          <motion.section
            key="customize"
            variants={activeScreenVariants}
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
                  <p className="mb-6 text-[12px] font-bold text-foreground">
                    <MenuOptionTypewriter text="Columns: Task frequency" startDelayMs={0} />
                  </p>
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
                    delayOffsetMs={MENU_OPTION_STAGGER_MS}
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
                  <p className="mb-6 text-[12px] font-bold text-foreground">
                    <MenuOptionTypewriter
                      text="Rows: Time saved per task"
                      startDelayMs={(columnItems.length + 2) * MENU_OPTION_STAGGER_MS}
                    />
                  </p>
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
                    delayOffsetMs={(columnItems.length + 3) * MENU_OPTION_STAGGER_MS}
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
                  <InlineAction
                    label={
                      <MenuOptionTypewriter
                        text="Save changes"
                        startDelayMs={
                          (columnItems.length + rowItems.length + 5) * MENU_OPTION_STAGGER_MS
                        }
                      />
                    }
                    active={
                      customizeSection === 'actions' &&
                      customizeActionItems[clampedCustomizeActionCursorIndex] === 'save'
                    }
                    onMouseEnter={() => {
                      setCustomizeSection('actions')
                      setCustomizeActionCursorIndex(
                        Math.max(0, customizeActionItems.indexOf('save')),
                      )
                    }}
                    onClick={() => setView('table')}
                  />
                ) : null}
                <InlineAction
                  label={
                    <MenuOptionTypewriter
                      text="Cancel"
                      startDelayMs={
                        (columnItems.length + rowItems.length + (hasCustomizePendingChanges ? 6 : 5)) *
                        MENU_OPTION_STAGGER_MS
                      }
                    />
                    }
                  active={
                    customizeSection === 'actions' &&
                    customizeActionItems[clampedCustomizeActionCursorIndex] === 'cancel'
                  }
                  onMouseEnter={() => {
                    setCustomizeSection('actions')
                    setCustomizeActionCursorIndex(
                      Math.max(0, customizeActionItems.indexOf('cancel')),
                    )
                  }}
                  onClick={() => setView('table')}
                />
              </div>
            </div>

          </motion.section>
        ) : null}

        {view === 'add-menu-option' ? (
          <motion.section
            key="add-menu-option"
            variants={activeScreenVariants}
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
                  <MenuOptionTypewriter text={menuCustomFieldLabel} startDelayMs={0} />
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
                      label={
                        <MenuOptionTypewriter
                          text="Cancel"
                          startDelayMs={MENU_OPTION_STAGGER_MS}
                        />
                      }
                      onClick={closeAddMenuOption}
                      active={addMenuOptionCursorIndex === 1}
                      buttonRef={addMenuOptionCancelRef}
                    />
                  </div>
                </div>
              </form>

              <div className="mt-10 text-[12px] leading-5 text-muted-foreground">
                <p className="m-0 font-bold text-foreground">
                  <MenuOptionTypewriter text="Examples" startDelayMs={MENU_OPTION_STAGGER_MS * 2} />
                </p>
                {menuCustomKind === 'frequency' ? (
                  <>
                    <p className="mt-2">
                      <MenuOptionTypewriter text="50/day" startDelayMs={MENU_OPTION_STAGGER_MS * 3} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="10 times per day" startDelayMs={MENU_OPTION_STAGGER_MS * 4} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="Daily" startDelayMs={MENU_OPTION_STAGGER_MS * 5} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="Biweekly" startDelayMs={MENU_OPTION_STAGGER_MS * 6} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="2/y" startDelayMs={MENU_OPTION_STAGGER_MS * 7} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="..." startDelayMs={MENU_OPTION_STAGGER_MS * 8} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="etc" startDelayMs={MENU_OPTION_STAGGER_MS * 9} />
                    </p>
                  </>
                ) : null}
                {menuCustomKind === 'time' ? (
                  <>
                    <p className="mt-2">
                      <MenuOptionTypewriter text="10s" startDelayMs={MENU_OPTION_STAGGER_MS * 3} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="one minute" startDelayMs={MENU_OPTION_STAGGER_MS * 4} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="5 min" startDelayMs={MENU_OPTION_STAGGER_MS * 5} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="2h" startDelayMs={MENU_OPTION_STAGGER_MS * 6} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="five m" startDelayMs={MENU_OPTION_STAGGER_MS * 7} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="..." startDelayMs={MENU_OPTION_STAGGER_MS * 8} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="etc" startDelayMs={MENU_OPTION_STAGGER_MS * 9} />
                    </p>
                  </>
                ) : null}
                {menuCustomKind === 'lifetime' ? (
                  <>
                    <p className="mt-2">
                      <MenuOptionTypewriter text="5 years" startDelayMs={MENU_OPTION_STAGGER_MS * 3} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="18 months" startDelayMs={MENU_OPTION_STAGGER_MS * 4} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="2.5 years" startDelayMs={MENU_OPTION_STAGGER_MS * 5} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="6 mo" startDelayMs={MENU_OPTION_STAGGER_MS * 6} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="..." startDelayMs={MENU_OPTION_STAGGER_MS * 7} />
                    </p>
                    <p>
                      <MenuOptionTypewriter text="etc" startDelayMs={MENU_OPTION_STAGGER_MS * 8} />
                    </p>
                  </>
                ) : null}
              </div>
            </div>

          </motion.section>
        ) : null}

        {view === 'add-column' ? (
          <motion.section
            key="add-column"
            variants={activeScreenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] sm:min-h-[calc(100vh-96px)] w-full max-w-[1200px] flex-col"
            onKeyDown={handleAddColumnKeyDown}
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
                  <MenuOptionTypewriter text="Task frequency:" startDelayMs={0} />
                  <span
                    className="inline-flex items-center"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      setAddColumnCursorIndex(0)
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
                      style={{ width: `${Math.max(1, columnDraft.length)}ch` }}
                      autoComplete="off"
                      spellCheck={false}
                      onFocus={() => setAddColumnCursorIndex(0)}
                    />
                    <TerminalCursor active={addColumnCursorIndex === 0} />
                  </span>
                </label>

                <div className="space-y-3">
                  <InlineAction
                    label={<MenuOptionTypewriter text="Cancel" startDelayMs={MENU_OPTION_STAGGER_MS} />}
                    onClick={closeAddColumn}
                    active={addColumnCursorIndex === 1}
                    buttonRef={addColumnCancelRef}
                    onMouseEnter={() => setAddColumnCursorIndex(1)}
                  />
                  {editingColumnId ? (
                    <div>
                      <InlineAction
                        label={
                          <MenuOptionTypewriter
                            text="Delete column"
                            startDelayMs={MENU_OPTION_STAGGER_MS * 2}
                          />
                        }
                        onClick={deleteEditingColumn}
                        active={addColumnCursorIndex === 2}
                        buttonRef={addColumnDeleteRef}
                        onMouseEnter={() => setAddColumnCursorIndex(2)}
                      />
                    </div>
                  ) : null}
                </div>
              </form>

              <div className="mt-10 text-[12px] leading-5 text-muted-foreground">
                <p className="m-0 font-bold text-foreground">
                  <MenuOptionTypewriter text="Examples" startDelayMs={MENU_OPTION_STAGGER_MS * 2} />
                </p>
                <p className="mt-2">
                  <MenuOptionTypewriter text="50/day" startDelayMs={MENU_OPTION_STAGGER_MS * 3} />
                </p>
                <p>
                  <MenuOptionTypewriter text="10 tasks per day" startDelayMs={MENU_OPTION_STAGGER_MS * 4} />
                </p>
                <p>
                  <MenuOptionTypewriter text="Daily" startDelayMs={MENU_OPTION_STAGGER_MS * 5} />
                </p>
                <p>
                  <MenuOptionTypewriter text="Biweekly" startDelayMs={MENU_OPTION_STAGGER_MS * 6} />
                </p>
                <p>
                  <MenuOptionTypewriter text="2/y" startDelayMs={MENU_OPTION_STAGGER_MS * 7} />
                </p>
                <p>
                  <MenuOptionTypewriter text="..." startDelayMs={MENU_OPTION_STAGGER_MS * 8} />
                </p>
                <p>
                  <MenuOptionTypewriter text="etc" startDelayMs={MENU_OPTION_STAGGER_MS * 9} />
                </p>
              </div>
            </div>

          </motion.section>
        ) : null}

        {view === 'add-row' ? (
          <motion.section
            key="add-row"
            variants={activeScreenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] sm:min-h-[calc(100vh-96px)] w-full max-w-[1200px] flex-col"
            onKeyDown={handleAddRowKeyDown}
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
                  <MenuOptionTypewriter text="Time saved per task:" startDelayMs={0} />
                  <span
                    className="inline-flex items-center"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      setAddRowCursorIndex(0)
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
                      style={{ width: `${Math.max(1, rowDraft.length)}ch` }}
                      autoComplete="off"
                      spellCheck={false}
                      onFocus={() => setAddRowCursorIndex(0)}
                    />
                    <TerminalCursor active={addRowCursorIndex === 0} />
                  </span>
                </label>

                <div className="space-y-3">
                  <InlineAction
                    label={<MenuOptionTypewriter text="Cancel" startDelayMs={MENU_OPTION_STAGGER_MS} />}
                    onClick={closeAddRow}
                    active={addRowCursorIndex === 1}
                    buttonRef={addRowCancelRef}
                    onMouseEnter={() => setAddRowCursorIndex(1)}
                  />
                  {editingRowId ? (
                    <div>
                      <InlineAction
                        label={
                          <MenuOptionTypewriter
                            text="Delete row"
                            startDelayMs={MENU_OPTION_STAGGER_MS * 2}
                          />
                        }
                        onClick={deleteEditingRow}
                        active={addRowCursorIndex === 2}
                        buttonRef={addRowDeleteRef}
                        onMouseEnter={() => setAddRowCursorIndex(2)}
                      />
                    </div>
                  ) : null}
                </div>
              </form>

              <div className="mt-10 text-[12px] leading-5 text-muted-foreground">
                <p className="m-0 font-bold text-foreground">
                  <MenuOptionTypewriter text="Examples" startDelayMs={MENU_OPTION_STAGGER_MS * 2} />
                </p>
                <p className="mt-2">
                  <MenuOptionTypewriter text="10s" startDelayMs={MENU_OPTION_STAGGER_MS * 3} />
                </p>
                <p>
                  <MenuOptionTypewriter text="one minute" startDelayMs={MENU_OPTION_STAGGER_MS * 4} />
                </p>
                <p>
                  <MenuOptionTypewriter text="5 min" startDelayMs={MENU_OPTION_STAGGER_MS * 5} />
                </p>
                <p>
                  <MenuOptionTypewriter text="2h" startDelayMs={MENU_OPTION_STAGGER_MS * 6} />
                </p>
                <p>
                  <MenuOptionTypewriter text="five m" startDelayMs={MENU_OPTION_STAGGER_MS * 7} />
                </p>
                <p>
                  <MenuOptionTypewriter text="..." startDelayMs={MENU_OPTION_STAGGER_MS * 8} />
                </p>
                <p>
                  <MenuOptionTypewriter text="etc" startDelayMs={MENU_OPTION_STAGGER_MS * 9} />
                </p>
              </div>
            </div>

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
  const prefersReducedMotion = useReducedMotion()
  const [visibleLength, setVisibleLength] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion) {
      onComplete()
      return
    }

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
  }, [text, onComplete, prefersReducedMotion])

  return <span className="whitespace-nowrap">{text.slice(0, visibleLength)}</span>
}

function MenuOptionTypewriter({
  text,
  startDelayMs,
  animateOnlyOnMount = false,
}: {
  text: string
  startDelayMs: number
  animateOnlyOnMount?: boolean
}) {
  const prefersReducedMotion = useReducedMotion()
  const [visibleLength, setVisibleLength] = useState(0)
  const [hasAnimatedOnMount, setHasAnimatedOnMount] = useState(false)
  const shouldAnimate =
    !prefersReducedMotion && (!animateOnlyOnMount || !hasAnimatedOnMount)

  useEffect(() => {
    if (!shouldAnimate) {
      return
    }

    let timer = 0
    let cancelled = false

    const step = (index: number) => {
      if (cancelled) {
        return
      }

      setVisibleLength(index)

      if (index >= text.length) {
        if (animateOnlyOnMount) {
          setHasAnimatedOnMount(true)
        }
        return
      }

      timer = window.setTimeout(() => step(index + 1), MENU_OPTION_CHAR_MS)
    }

    timer = window.setTimeout(() => step(1), startDelayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [animateOnlyOnMount, shouldAnimate, startDelayMs, text])

  if (!shouldAnimate) {
    return <span>{text}</span>
  }

  return <span>{text.slice(0, visibleLength)}</span>
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
                'flex h-6 items-center justify-center bg-hatch',
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
  delayOffsetMs = 0,
  onHover,
  onActivate,
}: {
  items: string[]
  active: number
  selected: number
  delayOffsetMs?: number
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
              index === active
                ? 'font-bold text-foreground'
                : index === selected
                ? 'font-bold text-foreground'
                : 'font-medium text-muted-foreground hover:text-foreground',
            )}
            onMouseEnter={() => onHover(index)}
            onClick={() => onActivate(index)}
          >
            <MenuOptionTypewriter
              text={item}
              startDelayMs={delayOffsetMs + index * MENU_OPTION_STAGGER_MS}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

function TypedWords({ text, delaySteps = 0 }: { text: string; delaySteps?: number }) {
  const prefersReducedMotion = useReducedMotion()
  const tokens = text.split(/(\s+)/).filter(Boolean)

  if (prefersReducedMotion) {
    return <span>{text}</span>
  }

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
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <span className="inline-flex">{children}</span>
  }

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
  onMouseEnter,
  onFocus,
}: {
  label: ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  variant?: 'muted' | 'strong'
  cursorClassName?: string
  cursorOutside?: boolean
  underlineTight?: boolean
  className?: string
  buttonRef?: Ref<HTMLButtonElement>
  onMouseEnter?: () => void
  onFocus?: () => void
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      disabled={disabled}
      className={cn(
        interactiveBaseClass,
        'group',
        cursorOutside ? 'pr-0' : 'pr-[12px]',
        underlineTight && 'pb-0 before:bottom-px after:bottom-px',
        active &&
          'motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100',
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

function InlineSelectTriggerLabel({
  text,
}: {
  text: string
}) {
  return (
    <>
      <span>{text}</span>
      <span className="ml-[0.65ch] text-foreground">⏷</span>
    </>
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
    <header className="mb-12 w-full max-w-[640px]">
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

function formatFocusApproxText(result: CompactCellDisplay, basis: CalendarBasis) {
  const prefix = result.approx ? '~' : ''
  const numeric = formatResultNumber(result.value)

  if (basis !== 'workdays') {
    return `${prefix}${numeric} ${result.unit}`
  }

  const lowerUnit = result.unit.toLowerCase()

  if (lowerUnit === 'day' || lowerUnit === 'days') {
    const label = Math.abs(result.value) === 1 ? 'workday' : 'workdays'
    return `${prefix}${numeric} ${label}`
  }

  if (lowerUnit === 'week' || lowerUnit === 'weeks') {
    const label = Math.abs(result.value) === 1 ? 'workweek' : 'workweeks'
    return `${prefix}${numeric} ${label}`
  }

  const fullUnit = expandApproxUnit(result.unit, result.value)
  return `${prefix}${numeric} ${fullUnit}`
}

function expandApproxUnit(unit: string, value: number) {
  const singular = Math.abs(value) === 1
  const key = unit.toLowerCase()

  if (key === 'sec' || key === 'second' || key === 'seconds') {
    return singular ? 'second' : 'seconds'
  }
  if (key === 'min' || key === 'minute' || key === 'minutes') {
    return singular ? 'minute' : 'minutes'
  }
  if (key === 'hr' || key === 'hrs' || key === 'hour' || key === 'hours') {
    return singular ? 'hour' : 'hours'
  }
  if (key === 'day' || key === 'days') {
    return singular ? 'day' : 'days'
  }
  if (key === 'week' || key === 'weeks') {
    return singular ? 'week' : 'weeks'
  }
  if (key === 'mo' || key === 'month' || key === 'months') {
    return singular ? 'month' : 'months'
  }
  if (key === 'yr' || key === 'yrs' || key === 'year' || key === 'years') {
    return singular ? 'year' : 'years'
  }

  return unit
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

function remapTableCursorIndexForResetSlot(
  index: number,
  hadResetSlot: boolean,
  hasResetSlot: boolean,
) {
  if (hadResetSlot === hasResetSlot) {
    return index
  }

  if (!hadResetSlot && hasResetSlot) {
    return index === 0 ? 0 : index + 1
  }

  if (index === 0) {
    return 0
  }

  if (index === 1) {
    return 1
  }

  return index - 1
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
  autoHideKeyCommands: boolean
}) {
  return (
    state.lifetimeYears === DEFAULT_STATE.lifetimeYears &&
    state.calendarBasis === DEFAULT_STATE.calendarBasis &&
    state.customDaysPerYear === DEFAULT_STATE.customDaysPerYear &&
    state.displayMode === DEFAULT_STATE.displayMode &&
    state.significantDigits === DEFAULT_STATE.significantDigits &&
    state.autoHideKeyCommands === DEFAULT_STATE.autoHideKeyCommands &&
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
