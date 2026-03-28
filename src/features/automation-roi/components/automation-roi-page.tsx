import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type ReactNode,
} from 'react'
import NumberFlow from '@number-flow/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTheme } from 'next-themes'
import { createPortal } from 'react-dom'
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
import {
  formatCompactCellDisplay,
  formatForTable,
  formatNonApproximateCellTooltipText,
  formatPreciseTooltipText,
  formatPreciseLongText,
} from '../formatters'
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
  | 'menu-edit-columns'
  | 'menu-edit-rows'
  | 'add-menu-option'
  | 'add-column'
  | 'add-row'

type BaseView = 'home' | 'table'
type MenuCustomKind = 'frequency' | 'time' | 'lifetime'
type TableEditMenuKind = 'columns' | 'rows'
type NonSettingsView = Exclude<View, 'settings'>
type NavigationUrlState = {
  view: View
  menuReturnView: BaseView
  settingsReturnView: NonSettingsView
  tableEditMenuKind: TableEditMenuKind
  menuCustomKind: MenuCustomKind
}

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

type TableEditMenuItem =
  | { kind: 'default-row'; row: SavingsRow }
  | { kind: 'default-column'; column: FrequencyColumn }
  | { kind: 'custom-row'; row: SavingsRow }
  | { kind: 'custom-column'; column: FrequencyColumn }
  | { kind: 'new' }
  | { kind: 'cancel' }

const HOME_CURSOR_RESULT_INDEX = 3
const FOOTER_LINK_COUNT = 4

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
const HOME_REVEAL_STAGE_KEY_COMMANDS = 3
const HOME_REVEAL_STAGE_FOOTER_START = 4
const HOME_RESULT_TYPEWRITER_DURATION_MS = 260
const HOME_SHOW_TABLE_TYPEWRITER_DURATION_MS = 280
const HOME_KEY_COMMANDS_TO_FOOTER_DELAY_MS = 760
const HOME_KEY_COMMANDS_LINK_TO_FOOTER_DELAY_MS = 220
const HOME_SHOW_TABLE_LABEL = 'Show full table 🡪'
const TABLE_LAYOUT_BREAKPOINT_PX = 736
const TABLE_SCROLL_STEP_PX = 99
const TABLE_SCROLL_EPSILON_PX = 0.25
const TABLE_TOOLTIP_SHOW_DELAY_MS = 500
const TABLE_TOOLTIP_OFFSET_X = 8
const TABLE_TOOLTIP_OFFSET_Y = 8
const MENU_CURSOR_REVEAL_DELAY_MS = 90
const MENU_ID_FREQUENCY = 'frequency'
const MENU_ID_SAVINGS = 'savings'
const MENU_ID_PERIOD = 'period'
const NAVIGATION_HISTORY_STATE_KEY = 'iitwtNavIndex'

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
    deleteCustomRow,
    toggleDefaultRow,
    addCustomColumn,
    deleteCustomColumn,
    toggleDefaultColumn,
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
  const [initialNavigationState] = useState<NavigationUrlState>(() =>
    parseNavigationStateFromPath(
      typeof window === 'undefined' ? '/' : window.location.pathname,
    ),
  )

  const [view, setView] = useState<View>(initialNavigationState.view)
  const [settingsReturnView, setSettingsReturnView] = useState<NonSettingsView>(
    initialNavigationState.settingsReturnView,
  )
  const [settingsIndex, setSettingsIndex] = useState(0)
  const [menuReturnView, setMenuReturnView] = useState<BaseView>(
    initialNavigationState.menuReturnView,
  )
  const [menuIndex, setMenuIndex] = useState(0)
  const [menuCursorVisible, setMenuCursorVisible] = useState(false)
  const [menuCustomKind, setMenuCustomKind] = useState<MenuCustomKind>(
    initialNavigationState.menuCustomKind,
  )
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
  const [homeFooterCommandToggleAvailable, setHomeFooterCommandToggleAvailable] = useState(false)
  const [tableFooterCommandToggleAvailable, setTableFooterCommandToggleAvailable] = useState(false)
  const autoHideKeyCommandsRef = useRef(autoHideKeyCommands)
  const previousHasResettableChangesRef = useRef<boolean | null>(null)
  const previousHomeFooterCommandToggleAvailableRef = useRef(false)
  const previousTableFooterCommandToggleAvailableRef = useRef(false)
  const hasInitializedUrlHistoryRef = useRef(false)
  const isApplyingHistoryNavigationRef = useRef(false)
  const lastNavigationPathRef = useRef('')
  const navigationHistoryIndexRef = useRef(0)

  const [addColumnCursorIndex, setAddColumnCursorIndex] = useState(0)
  const [addRowCursorIndex, setAddRowCursorIndex] = useState(0)
  const [addMenuOptionCursorIndex, setAddMenuOptionCursorIndex] = useState(0)
  const [tableEditMenuIndex, setTableEditMenuIndex] = useState(0)
  const [tableEditMenuCursorVisible, setTableEditMenuCursorVisible] = useState(false)
  const [tableEditMenuKind, setTableEditMenuKind] = useState<TableEditMenuKind>(
    initialNavigationState.tableEditMenuKind,
  )
  const [tableEditMenuHasInteracted, setTableEditMenuHasInteracted] = useState<{
    rows: boolean
    columns: boolean
  }>({
    rows: false,
    columns: false,
  })
  const [columnDraft, setColumnDraft] = useState('')
  const [rowDraft, setRowDraft] = useState('')
  const menuOptionInputRef = useRef<HTMLInputElement | null>(null)
  const addMenuOptionCancelRef = useRef<HTMLButtonElement | null>(null)
  const columnInputRef = useRef<HTMLInputElement | null>(null)
  const rowInputRef = useRef<HTMLInputElement | null>(null)
  const addColumnCancelRef = useRef<HTMLButtonElement | null>(null)
  const addRowCancelRef = useRef<HTMLButtonElement | null>(null)
  const tableSliderTrackRef = useRef<HTMLDivElement | null>(null)
  const tableScrollViewportRef = useRef<HTMLDivElement | null>(null)
  const [isTableNarrow, setIsTableNarrow] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia(`(max-width: ${TABLE_LAYOUT_BREAKPOINT_PX - 1}px)`).matches,
  )
  const [tableCanScrollLeft, setTableCanScrollLeft] = useState(false)
  const [tableCanScrollRight, setTableCanScrollRight] = useState(false)
  const [tableArrowPressed, setTableArrowPressed] = useState({ left: false, right: false })
  const [tableTooltip, setTableTooltip] = useState<{
    key: string
    text: string
    x: number
    y: number
  } | null>(null)
  const tableTooltipDelayRef = useRef<number | null>(null)
  const hoveredApproxCellRef = useRef<string | null>(null)
  const pendingTableTooltipRef = useRef<{
    key: string
    text: string
    x: number
    y: number
  } | null>(null)

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
  const homeFooterRevealCount =
    homeRevealStage >= HOME_REVEAL_STAGE_FOOTER_START ? FOOTER_LINK_COUNT : 0
  const homeFooterInteractiveCount =
    homeFooterRevealCount + (homeFooterCommandToggleAvailable ? 1 : 0)
  const homeCursorMaxIndex = homeContentCursorMaxIndex + homeFooterInteractiveCount
  let homeVisibleCursorMaxIndex = 2
  if (homeRevealStage >= HOME_REVEAL_STAGE_RESULT) {
    homeVisibleCursorMaxIndex = HOME_CURSOR_RESULT_INDEX
  }
  if (homeRevealStage >= HOME_REVEAL_STAGE_SHOW_TABLE) {
    homeVisibleCursorMaxIndex = Math.max(homeVisibleCursorMaxIndex, 4)
  }
  if (hasResettableChanges && homeRevealStage >= HOME_REVEAL_STAGE_SHOW_TABLE) {
    homeVisibleCursorMaxIndex = Math.max(homeVisibleCursorMaxIndex, 5)
  }
  if (homeFooterInteractiveCount > 0) {
    homeVisibleCursorMaxIndex = Math.max(
      homeVisibleCursorMaxIndex,
      homeFooterStartIndex + homeFooterInteractiveCount - 1,
    )
  }
  const activeHomeCursorIndex = Math.min(homeCursorIndex, homeVisibleCursorMaxIndex)
  const tableResetIndex = hasResettableChanges ? 1 : -1
  const tableLifetimeCursorIndex = hasResettableChanges ? 2 : 1
  const tableSliderIndicatorCursorIndex = hasResettableChanges ? 3 : 2
  const tableDecrementCursorIndex = hasResettableChanges ? 4 : 3
  const tableIncrementCursorIndex = hasResettableChanges ? 5 : 4
  const tableScrollCursorIndex = isTableNarrow ? (hasResettableChanges ? 6 : 5) : -1
  const tableRowsEditCursorIndex = isTableNarrow
    ? hasResettableChanges
      ? 7
      : 6
    : hasResettableChanges
      ? 6
      : 5
  const tableColumnsEditCursorIndex = tableRowsEditCursorIndex + 1
  const tableFooterStartIndex = tableColumnsEditCursorIndex + 1
  const tableFooterInteractiveCount =
    FOOTER_LINK_COUNT + (tableFooterCommandToggleAvailable ? 1 : 0)
  const tableCursorMaxIndex = tableFooterStartIndex + tableFooterInteractiveCount - 1
  const activeTableCursorIndex = Math.min(tableCursorIndex, tableCursorMaxIndex)

  useEffect(() => {
    const previous = previousHomeFooterCommandToggleAvailableRef.current
    if (previous === homeFooterCommandToggleAvailable) {
      return
    }

    previousHomeFooterCommandToggleAvailableRef.current = homeFooterCommandToggleAvailable
    const remapTimeout = window.setTimeout(() => {
      setHomeCursorIndex((current) => {
        const firstLinkIndex = homeFooterStartIndex + (homeFooterCommandToggleAvailable ? 1 : 0)
        const lastLinkIndex = firstLinkIndex + Math.max(0, homeFooterRevealCount - 1)

        if (!previous && homeFooterCommandToggleAvailable) {
          if (current >= homeFooterStartIndex && current <= lastLinkIndex - 1) {
            return current + 1
          }
          return current
        }

        if (previous && !homeFooterCommandToggleAvailable) {
          if (current > homeFooterStartIndex && current <= lastLinkIndex) {
            return current - 1
          }
        }

        return current
      })
    }, 0)
    return () => {
      window.clearTimeout(remapTimeout)
    }
  }, [homeFooterCommandToggleAvailable, homeFooterRevealCount, homeFooterStartIndex])

  useEffect(() => {
    const previous = previousTableFooterCommandToggleAvailableRef.current
    if (previous === tableFooterCommandToggleAvailable) {
      return
    }

    previousTableFooterCommandToggleAvailableRef.current = tableFooterCommandToggleAvailable
    const remapTimeout = window.setTimeout(() => {
      setTableCursorIndex((current) => {
        const firstLinkIndex = tableFooterStartIndex + (tableFooterCommandToggleAvailable ? 1 : 0)
        const lastLinkIndex = firstLinkIndex + FOOTER_LINK_COUNT - 1

        if (!previous && tableFooterCommandToggleAvailable) {
          if (current >= tableFooterStartIndex && current <= lastLinkIndex - 1) {
            return current + 1
          }
          return current
        }

        if (previous && !tableFooterCommandToggleAvailable) {
          if (current > tableFooterStartIndex && current <= lastLinkIndex) {
            return current - 1
          }
        }

        return current
      })
    }, 0)
    return () => {
      window.clearTimeout(remapTimeout)
    }
  }, [tableFooterCommandToggleAvailable, tableFooterStartIndex])

  const isMenuView =
    view === 'menu-frequency' || view === 'menu-time' || view === 'menu-lifetime'
  const isTableEditMenuView = view === 'menu-edit-columns' || view === 'menu-edit-rows'
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
  const activeTableEditMenuKind =
    view === 'menu-edit-rows' || tableEditMenuKind === 'rows' ? 'rows' : 'columns'
  const tableEditMenuTitle =
    activeTableEditMenuKind === 'rows' ? 'Edit table rows' : 'Edit table columns'
  const enabledDefaultRowIds = useMemo(
    () => new Set(rows.filter((row) => !row.isCustom).map((row) => row.id)),
    [rows],
  )
  const enabledDefaultColumnIds = useMemo(
    () => new Set(columns.filter((column) => !column.isCustom).map((column) => column.id)),
    [columns],
  )
  const customRows = useMemo(() => rows.filter((row) => row.isCustom), [rows])
  const customColumns = useMemo(() => columns.filter((column) => column.isCustom), [columns])
  const tableEditMenuItems = useMemo<TableEditMenuItem[]>(() => {
    if (activeTableEditMenuKind === 'rows') {
      return [
        ...DEFAULT_ROWS.map((row) => ({ kind: 'default-row' as const, row })),
        ...customRows.map((row) => ({ kind: 'custom-row' as const, row })),
        { kind: 'new' as const },
        { kind: 'cancel' as const },
      ]
    }

    return [
      ...DEFAULT_COLUMNS.map((column) => ({ kind: 'default-column' as const, column })),
      ...customColumns.map((column) => ({ kind: 'custom-column' as const, column })),
      { kind: 'new' as const },
      { kind: 'cancel' as const },
    ]
  }, [activeTableEditMenuKind, customColumns, customRows])
  const tableEditMenuCursorMaxIndex = Math.max(0, tableEditMenuItems.length - 1)
  const tableEditDefaultItemCount =
    activeTableEditMenuKind === 'rows' ? DEFAULT_ROWS.length : DEFAULT_COLUMNS.length
  const tableEditMenuNewLabel =
    activeTableEditMenuKind === 'rows' ? 'New row…' : 'New column…'
  const activeTableEditMenuHasInteracted =
    activeTableEditMenuKind === 'rows'
      ? tableEditMenuHasInteracted.rows
      : tableEditMenuHasInteracted.columns
  const tableEditMenuExitLabel =
    activeTableEditMenuHasInteracted ? 'Back' : 'Cancel'

  useEffect(() => {
    if (!isMenuView) {
      return
    }

    if (prefersReducedMotion) {
      const showMenuCursorImmediatelyTimeout = window.setTimeout(() => {
        setMenuCursorVisible(true)
      }, 0)
      return () => {
        window.clearTimeout(showMenuCursorImmediatelyTimeout)
      }
    }

    const revealMenuCursorTimeout = window.setTimeout(() => {
      setMenuCursorVisible(true)
    }, MENU_CURSOR_REVEAL_DELAY_MS)

    return () => {
      window.clearTimeout(revealMenuCursorTimeout)
    }
  }, [isMenuView, prefersReducedMotion, view])

  useEffect(() => {
    if (!isTableEditMenuView) {
      return
    }

    if (prefersReducedMotion) {
      const showTableEditMenuCursorTimeout = window.setTimeout(() => {
        setTableEditMenuCursorVisible(true)
      }, 0)
      return () => {
        window.clearTimeout(showTableEditMenuCursorTimeout)
      }
    }

    const revealTableEditMenuCursorTimeout = window.setTimeout(() => {
      setTableEditMenuCursorVisible(true)
    }, MENU_CURSOR_REVEAL_DELAY_MS)

    return () => {
      window.clearTimeout(revealTableEditMenuCursorTimeout)
    }
  }, [isTableEditMenuView, prefersReducedMotion, view])

  useEffect(() => {
    if (!isTableEditMenuView) {
      return
    }

    const clamped = clampIndex(tableEditMenuIndex, tableEditMenuItems.length)
    if (clamped === tableEditMenuIndex) {
      return
    }

    const clampTableEditMenuCursorTimeout = window.setTimeout(() => {
      setTableEditMenuIndex(clamped)
    }, 0)

    return () => {
      window.clearTimeout(clampTableEditMenuCursorTimeout)
    }
  }, [isTableEditMenuView, tableEditMenuIndex, tableEditMenuItems.length])

  const daysPerYear = getDaysPerYear(calendarBasis, customDaysPerYear)
  const hasCustomCalendar = calendarBasis !== 'calendar'

  const tableLifetimeIndex = getClosestLifetimePresetIndex(lifetimeYears)
  const tableCanDecrementLifetime = tableLifetimeIndex > 0
  const tableCanIncrementLifetime = tableLifetimeIndex < LIFETIME_PRESETS_YEARS.length - 1
  const tableLifetimeSliderPercent =
    (tableLifetimeIndex / Math.max(1, LIFETIME_PRESETS_YEARS.length - 1)) * 100
  const tableLifetimeAtMin = !tableCanDecrementLifetime
  const tableLifetimeAtMax = !tableCanIncrementLifetime
  const tableSliderIndicatorPositionClass = tableLifetimeAtMin
    ? 'translate-x-0'
    : tableLifetimeAtMax
      ? '-translate-x-full'
      : '-translate-x-1/2'
  const canShowTableScrollControl = isTableNarrow
  const tableSliderControlSelected = activeTableCursorIndex === tableSliderIndicatorCursorIndex
  const tableSliderLeftKeyActive =
    tableSliderControlSelected && tableArrowPressed.left && tableCanDecrementLifetime
  const tableSliderRightKeyActive =
    tableSliderControlSelected && tableArrowPressed.right && tableCanIncrementLifetime
  const tableScrollControlSelected = activeTableCursorIndex === tableScrollCursorIndex
  const tableScrollLeftKeyActive =
    tableScrollControlSelected && tableArrowPressed.left && tableCanScrollLeft
  const tableScrollRightKeyActive =
    tableScrollControlSelected && tableArrowPressed.right && tableCanScrollRight
  const tableScrollKeycapClass = (active: boolean, disabled: boolean) =>
    cn(
      'inline-flex h-4 w-4 min-w-4 items-center justify-center rounded-[3px] border px-0 text-[9px]',
      active
        ? 'border-foreground font-bold text-foreground'
        : disabled
          ? 'border-border font-medium text-border'
          : 'border-border font-medium text-muted-foreground',
    )
  const clearTableTooltipDelay = useCallback(() => {
    if (tableTooltipDelayRef.current !== null) {
      window.clearTimeout(tableTooltipDelayRef.current)
      tableTooltipDelayRef.current = null
    }
  }, [])

  const hideTableTooltip = useCallback(() => {
    hoveredApproxCellRef.current = null
    pendingTableTooltipRef.current = null
    clearTableTooltipDelay()
    setTableTooltip(null)
  }, [clearTableTooltipDelay])

  const scheduleTableTooltip = useCallback(
    (key: string, text: string, x: number, y: number) => {
      hoveredApproxCellRef.current = key
      pendingTableTooltipRef.current = { key, text, x, y }
      clearTableTooltipDelay()
      setTableTooltip(null)
      tableTooltipDelayRef.current = window.setTimeout(() => {
        const pending = pendingTableTooltipRef.current
        if (!pending || hoveredApproxCellRef.current !== pending.key) {
          return
        }
        setTableTooltip(pending)
      }, TABLE_TOOLTIP_SHOW_DELAY_MS)
    },
    [clearTableTooltipDelay],
  )

  const handleApproximateCellEnter = useCallback(
    (
      key: string,
      text: string,
      event: ReactMouseEvent<HTMLElement>,
    ) => {
      scheduleTableTooltip(key, text, event.clientX, event.clientY)
    },
    [scheduleTableTooltip],
  )

  const handleApproximateCellMove = useCallback(
    (key: string, event: ReactMouseEvent<HTMLElement>) => {
      const pointer = { x: event.clientX, y: event.clientY }
      const pending = pendingTableTooltipRef.current
      if (pending && pending.key === key) {
        pendingTableTooltipRef.current = { ...pending, ...pointer }
      }

      setTableTooltip((current) =>
        current && current.key === key ? { ...current, ...pointer } : current,
      )
    },
    [],
  )

  const handleApproximateCellLeave = useCallback(
    (key: string) => {
      if (hoveredApproxCellRef.current !== key) {
        return
      }

      hideTableTooltip()
    },
    [hideTableTooltip],
  )

  const updateTableScrollAvailability = useCallback(() => {
    const viewport = tableScrollViewportRef.current
    if (!viewport) {
      setTableCanScrollLeft(false)
      setTableCanScrollRight(false)
      return
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const nextCanScrollLeft = viewport.scrollLeft > TABLE_SCROLL_EPSILON_PX
    const nextCanScrollRight =
      maxScrollLeft - viewport.scrollLeft > TABLE_SCROLL_EPSILON_PX
    setTableCanScrollLeft(nextCanScrollLeft)
    setTableCanScrollRight(nextCanScrollRight)
  }, [])

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
    autoHideKeyCommandsRef.current = autoHideKeyCommands
  }, [autoHideKeyCommands])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const query = `(max-width: ${TABLE_LAYOUT_BREAKPOINT_PX - 1}px)`
    const mediaQueryList = window.matchMedia(query)
    const handleChange = () => {
      setIsTableNarrow(mediaQueryList.matches)
    }

    handleChange()
    mediaQueryList.addEventListener('change', handleChange)
    return () => {
      mediaQueryList.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (view !== 'table') {
      const clearPressedTimeout = window.setTimeout(() => {
        setTableArrowPressed({ left: false, right: false })
      }, 0)
      return () => {
        window.clearTimeout(clearPressedTimeout)
      }
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setTableArrowPressed((current) => (current.left ? current : { ...current, left: true }))
        return
      }

      if (event.key === 'ArrowRight') {
        setTableArrowPressed((current) => (current.right ? current : { ...current, right: true }))
      }
    }

    const onKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setTableArrowPressed((current) => (current.left ? { ...current, left: false } : current))
        return
      }

      if (event.key === 'ArrowRight') {
        setTableArrowPressed((current) => (current.right ? { ...current, right: false } : current))
      }
    }

    const clearPressed = () => {
      setTableArrowPressed({ left: false, right: false })
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clearPressed)
    document.addEventListener('visibilitychange', clearPressed)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearPressed)
      document.removeEventListener('visibilitychange', clearPressed)
    }
  }, [view])

  useEffect(() => {
    const viewport = tableScrollViewportRef.current
    if (!viewport) {
      return
    }

    const handleScroll = () => {
      updateTableScrollAvailability()
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    const observer = new ResizeObserver(handleScroll)
    observer.observe(viewport)
    const tableContent = viewport.firstElementChild
    if (tableContent instanceof HTMLElement) {
      observer.observe(tableContent)
    }

    const raf = window.requestAnimationFrame(handleScroll)

    return () => {
      viewport.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      window.cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [columns.length, rows.length, view, updateTableScrollAvailability])

  useEffect(() => {
    if (view !== 'table' || !isTableNarrow) {
      return
    }

    // Re-measure after table view transitions complete to avoid stale disabled keycaps.
    const raf = window.requestAnimationFrame(() => {
      updateTableScrollAvailability()
    })
    const t1 = window.setTimeout(() => updateTableScrollAvailability(), 80)
    const t2 = window.setTimeout(() => updateTableScrollAvailability(), 220)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [isTableNarrow, updateTableScrollAvailability, view])

  useEffect(() => () => clearTableTooltipDelay(), [clearTableTooltipDelay])

  useEffect(() => {
    if (view === 'table' && displayMode !== 'exact') {
      return
    }

    const hideTimer = window.setTimeout(() => {
      hideTableTooltip()
    }, 0)
    return () => {
      window.clearTimeout(hideTimer)
    }
  }, [displayMode, hideTableTooltip, view])

  useEffect(() => {
    const payload = {
      lifetimeYears: persistedLifetimeYears,
      calendarBasis,
      customDaysPerYear,
      rows,
      columns,
      displayMode,
      significantDigits,
      autoHideKeyCommands,
    }

    let timeoutId: number | null = null
    let idleId: number | null = null
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number
      cancelIdleCallback?: (handle: number) => void
    }

    const persist = () => {
      savePersistedState(payload)
    }

    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleId = idleWindow.requestIdleCallback(() => {
        persist()
      }, { timeout: 800 })
    } else {
      timeoutId = window.setTimeout(() => {
        persist()
      }, 180)
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      if (idleId !== null && typeof idleWindow.cancelIdleCallback === 'function') {
        idleWindow.cancelIdleCallback(idleId)
      }
    }
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

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const nextNavigation = parseNavigationStateFromPath(window.location.pathname)
      navigationHistoryIndexRef.current = getNavigationHistoryIndex(event.state)
      isApplyingHistoryNavigationRef.current = true
      setMenuReturnView(nextNavigation.menuReturnView)
      setSettingsReturnView(nextNavigation.settingsReturnView)
      setTableEditMenuKind(nextNavigation.tableEditMenuKind)
      setMenuCustomKind(nextNavigation.menuCustomKind)
      setView(nextNavigation.view)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    const currentPath = window.location.pathname
    const nextPath = buildNavigationPath({
      view,
      menuReturnView,
      settingsReturnView,
      tableEditMenuKind,
      menuCustomKind,
    })

    if (!hasInitializedUrlHistoryRef.current) {
      hasInitializedUrlHistoryRef.current = true
      navigationHistoryIndexRef.current = getNavigationHistoryIndex(window.history.state)
      lastNavigationPathRef.current = writeNavigationPathToUrl(
        nextPath,
        'replace',
        navigationHistoryIndexRef.current,
      )
      return
    }

    if (isApplyingHistoryNavigationRef.current) {
      isApplyingHistoryNavigationRef.current = false
      if (nextPath !== currentPath) {
        lastNavigationPathRef.current = writeNavigationPathToUrl(
          nextPath,
          'replace',
          navigationHistoryIndexRef.current,
        )
        return
      }

      lastNavigationPathRef.current = currentPath
      return
    }

    if (nextPath === lastNavigationPathRef.current) {
      return
    }

    navigationHistoryIndexRef.current += 1
    lastNavigationPathRef.current = writeNavigationPathToUrl(
      nextPath,
      'push',
      navigationHistoryIndexRef.current,
    )
  }, [menuCustomKind, menuReturnView, settingsReturnView, tableEditMenuKind, view])

  function openFrequencyMenu(returnView: BaseView) {
    setMenuReturnView(returnView)
    setMenuIndex(0)
    setMenuCursorVisible(false)
    setView('menu-frequency')
  }

  function openTimeMenu(returnView: BaseView) {
    setMenuReturnView(returnView)
    setMenuIndex(0)
    setMenuCursorVisible(false)
    setView('menu-time')
  }

  function openLifetimeMenu(returnView: BaseView) {
    setMenuReturnView(returnView)
    setMenuIndex(0)
    setMenuCursorVisible(false)
    setView('menu-lifetime')
  }

  function openTableEditMenu(kind: TableEditMenuKind) {
    setTableEditMenuKind(kind)
    setTableEditMenuIndex(0)
    setTableEditMenuCursorVisible(false)
    setTableEditMenuHasInteracted((current) => ({ ...current, [kind]: false }))
    setView(kind === 'rows' ? 'menu-edit-rows' : 'menu-edit-columns')
  }

  function openSettings(returnView: Exclude<View, 'settings'>) {
    setSettingsReturnView(returnView)
    setSettingsIndex(1)
    setView('settings')
  }

  function navigateBackFromSettings() {
    if (navigationHistoryIndexRef.current > 0) {
      window.history.back()
      return
    }

    isApplyingHistoryNavigationRef.current = true
    navigationHistoryIndexRef.current = 0
    lastNavigationPathRef.current = writeNavigationPathToUrl('/', 'replace', 0)
    setView('home')
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
    setMenuIndex(0)
    setMenuCursorVisible(false)
    setView(getMenuViewForKind(menuCustomKind))
  }

  function returnToTableEditMenu(cursorIndex = 0) {
    setTableEditMenuIndex(Math.max(0, cursorIndex))
    setTableEditMenuCursorVisible(false)
    setView(tableEditMenuKind === 'rows' ? 'menu-edit-rows' : 'menu-edit-columns')
  }

  function activateTableEditMenuItem(index: number) {
    const item = tableEditMenuItems[index]
    if (!item) {
      return
    }

    if (item.kind === 'cancel') {
      setView('table')
      return
    }

    if (item.kind === 'new') {
      if (activeTableEditMenuKind === 'rows') {
        setTableEditMenuKind('rows')
        setRowDraft('')
        setAddRowCursorIndex(0)
        setView('add-row')
        return
      }

      setTableEditMenuKind('columns')
      setColumnDraft('')
      setAddColumnCursorIndex(0)
      setView('add-column')
      return
    }

    if (item.kind === 'default-row') {
      toggleDefaultRow(item.row.id)
      setTableEditMenuHasInteracted((current) => ({ ...current, rows: true }))
      return
    }

    if (item.kind === 'default-column') {
      toggleDefaultColumn(item.column.id)
      setTableEditMenuHasInteracted((current) => ({ ...current, columns: true }))
      return
    }

    if (item.kind === 'custom-row') {
      deleteCustomRow(item.row.id)
      setTableEditMenuHasInteracted((current) => ({ ...current, rows: true }))
      return
    }

    if (item.kind === 'custom-column') {
      deleteCustomColumn(item.column.id)
      setTableEditMenuHasInteracted((current) => ({ ...current, columns: true }))
    }
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
      if (homeFooterCommandToggleAvailable && footerIndex === 0) {
        setAutoHideKeyCommands(!autoHideKeyCommands)
        return
      }

      const linkIndex = footerIndex - (homeFooterCommandToggleAvailable ? 1 : 0)
      if (linkIndex >= 0 && linkIndex < homeFooterRevealCount) {
        handleFooterAction(linkIndex)
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
        homeRevealStage >= HOME_REVEAL_STAGE_SHOW_TABLE
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

  function handleTableEditMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!isTableEditMenuView) {
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
      setTableEditMenuIndex((current) => {
        if (moveBackward) {
          return current === 0 ? tableEditMenuCursorMaxIndex : current - 1
        }

        return current === tableEditMenuCursorMaxIndex ? 0 : current + 1
      })
      return
    }

    if (isActivationKey(event.key)) {
      event.preventDefault()
      activateTableEditMenuItem(tableEditMenuIndex)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setView('table')
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

    if (index === tableScrollCursorIndex) {
      return
    }

    if (index === tableRowsEditCursorIndex) {
      openTableEditMenu('rows')
      return
    }

    if (index === tableColumnsEditCursorIndex) {
      openTableEditMenu('columns')
      return
    }

    if (index >= tableFooterStartIndex && index <= tableCursorMaxIndex) {
      const footerIndex = index - tableFooterStartIndex
      if (tableFooterCommandToggleAvailable && footerIndex === 0) {
        setAutoHideKeyCommands(!autoHideKeyCommands)
        return
      }

      const linkIndex = footerIndex - (tableFooterCommandToggleAvailable ? 1 : 0)
      if (linkIndex >= 0 && linkIndex < FOOTER_LINK_COUNT) {
        handleFooterAction(linkIndex)
      }
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

    if (
      activeTableCursorIndex === tableScrollCursorIndex &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      event.preventDefault()
      scrollTableByStep(event.key === 'ArrowLeft' ? -1 : 1)
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
      setSettingsIndex(settingsOptionStartIndex)
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
        navigateBackFromSettings()
        return
      }

      activateSettingsOption(settingsIndex - settingsOptionStartIndex)
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      navigateBackFromSettings()
    }
  }

  function resetAllDefaults() {
    resetDefaults()
    setFocusFrequency({ ...DEFAULT_FOCUS_FREQUENCY })
    setFocusTimeSavedSeconds(DEFAULT_FOCUS_TIME_SAVED_SECONDS)
    setResultTypewriterDone(false)
    setResultTypewriterRunId((current) => current + 1)
  }

  function closeAddColumn() {
    setColumnDraft('')
    setAddColumnCursorIndex(0)
    returnToTableEditMenu()
  }

  function closeAddRow() {
    setRowDraft('')
    setAddRowCursorIndex(0)
    returnToTableEditMenu()
  }

  function focusAddColumnCursor(index: number) {
    if (index === 0) {
      columnInputRef.current?.focus({ preventScroll: true })
      return
    }

    addColumnCancelRef.current?.focus({ preventScroll: true })
  }

  function focusAddRowCursor(index: number) {
    if (index === 0) {
      rowInputRef.current?.focus({ preventScroll: true })
      return
    }

    addRowCancelRef.current?.focus({ preventScroll: true })
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
    const maxIndex = 1

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
      closeAddColumn()
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
    const maxIndex = 1

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
      closeAddRow()
    }
  }

  function submitColumn() {
    const parsed = parseFrequencyInput(columnDraft)
    if (!parsed.ok) {
      toast.error(parsed.error)
      return
    }

    addCustomColumn({
      label: parsed.label,
      amount: parsed.amount,
      unit: parsed.unit,
    })

    const nextColumns = useAutomationROIStore.getState().columns
    const nextCustomColumns = nextColumns.filter((column) => column.isCustom)
    const createdColumnIndex = nextCustomColumns.findIndex(
      (column) =>
        column.label === parsed.label &&
        column.amount === parsed.amount &&
        column.unit === parsed.unit,
    )
    const nextMenuIndex =
      createdColumnIndex >= 0
        ? DEFAULT_COLUMNS.length + createdColumnIndex
        : 0

    setColumnDraft('')
    setTableEditMenuHasInteracted((current) => ({ ...current, columns: true }))
    returnToTableEditMenu(nextMenuIndex)
  }

  function submitRow() {
    const parsed = parseTimeSavedInput(rowDraft)
    if (!parsed.ok) {
      toast.error(parsed.error)
      return
    }

    addCustomRow({
      label: parsed.label,
      seconds: parsed.seconds,
    })

    const nextRows = useAutomationROIStore.getState().rows
    const nextCustomRows = nextRows.filter((row) => row.isCustom)
    const createdRowIndex = nextCustomRows.findIndex(
      (row) => row.label === parsed.label && row.seconds === parsed.seconds,
    )
    const nextMenuIndex =
      createdRowIndex >= 0
        ? DEFAULT_ROWS.length + createdRowIndex
        : 0

    setRowDraft('')
    setTableEditMenuHasInteracted((current) => ({ ...current, rows: true }))
    returnToTableEditMenu(nextMenuIndex)
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
    if (
      nextYears !== undefined &&
      !valuesNearlyEqual(nextYears, lifetimeYears)
    ) {
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

  function scrollTableByStep(direction: 1 | -1) {
    const viewport = tableScrollViewportRef.current
    if (!viewport) {
      return
    }

    if (direction < 0 && !tableCanScrollLeft) {
      return
    }

    if (direction > 0 && !tableCanScrollRight) {
      return
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const targetScrollLeft = Math.max(
      0,
      Math.min(maxScrollLeft, viewport.scrollLeft + direction * TABLE_SCROLL_STEP_PX),
    )

    viewport.scrollTo({
      left: targetScrollLeft,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
    window.requestAnimationFrame(() => {
      updateTableScrollAvailability()
    })
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
      label: 'Show key commands:',
      value: autoHideKeyCommands ? 'Yes' : 'No',
    },
    ...(hasResettableChanges
      ? [{ id: 'reset' as const, label: '⟲ Reset to defaults' }]
      : []),
  ]
  const settingsBackIndex = 0
  const settingsOptionStartIndex = 1
  const settingsCursorMaxIndex = settingsOptions.length

  useEffect(() => {
    if (!isSettingsView) {
      return
    }

    if (settingsIndex <= settingsCursorMaxIndex) {
      return
    }

    const clampSettingsCursorTimeout = window.setTimeout(() => {
      setSettingsIndex(settingsOptionStartIndex)
    }, 0)

    return () => {
      window.clearTimeout(clampSettingsCursorTimeout)
    }
  }, [isSettingsView, settingsCursorMaxIndex, settingsIndex, settingsOptionStartIndex])

  const homeTitle = 'Is It Worth the Time?'
  const homeText1 = 'If, by optimizing a task that I do '
  const homeText2 = ', I can save '
  const homeText3 = ' each time, and I keep doing it over a '
  const homeText4 = ' period, it will stop being worth it when optimizing it takes longer than:'

  const homeFlowStartStep = getFlowStepCount(homeTitle) + 1
  const homeFlowText1Delay = homeFlowStartStep
  const homeFlowStep1 = homeFlowText1Delay + getFlowStepCount(homeText1)
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

    const maxStage = HOME_REVEAL_STAGE_FOOTER_START
    if (prefersReducedMotion) {
      const reducedTimer = window.setTimeout(() => setHomeRevealStage(maxStage), 0)
      return () => {
        window.clearTimeout(reducedTimer)
      }
    }

    const resetTimer = window.setTimeout(() => setHomeRevealStage(0), 0)
    const baseDelayMs = Math.max(0, Math.round(homeSentenceEndDelaySeconds * 1000))
    const resultStageDelayMs = baseDelayMs
    const showTableStageDelayMs =
      resultStageDelayMs + HOME_RESULT_TYPEWRITER_DURATION_MS + HOME_STAGE_STAGGER_MS
    const keyCommandsStageDelayMs =
      showTableStageDelayMs +
      Math.max(
        HOME_SHOW_TABLE_TYPEWRITER_DURATION_MS,
        HOME_SHOW_TABLE_LABEL.length * MENU_OPTION_CHAR_MS,
      ) +
      HOME_STAGE_STAGGER_MS
    const keyCommandsToFooterDelayMs = autoHideKeyCommandsRef.current
      ? HOME_KEY_COMMANDS_TO_FOOTER_DELAY_MS
      : HOME_KEY_COMMANDS_LINK_TO_FOOTER_DELAY_MS
    const footerStageDelayMs = keyCommandsStageDelayMs + keyCommandsToFooterDelayMs
    const stageTimers = [
      window.setTimeout(() => setHomeRevealStage(HOME_REVEAL_STAGE_RESULT), resultStageDelayMs),
      window.setTimeout(
        () => setHomeRevealStage(HOME_REVEAL_STAGE_SHOW_TABLE),
        showTableStageDelayMs,
      ),
      window.setTimeout(
        () => setHomeRevealStage(HOME_REVEAL_STAGE_KEY_COMMANDS),
        keyCommandsStageDelayMs,
      ),
      window.setTimeout(
        () => setHomeRevealStage(HOME_REVEAL_STAGE_FOOTER_START),
        footerStageDelayMs,
      ),
    ]

    return () => {
      window.clearTimeout(resetTimer)
      stageTimers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [homeSentenceEndDelaySeconds, prefersReducedMotion, view])

  return (
    <main className="min-h-screen bg-background p-6 text-foreground sm:p-12">
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
            <TerminalHeader title={homeTitle} typewriter />

            <div className="grow max-w-[500px]">
              <p className="m-0 text-[12px] font-medium leading-6 text-muted-foreground">
                <TypedWords text={homeText1} delaySteps={homeFlowText1Delay} />
                <TypedInlineSlot delaySteps={homeFlowStep1}>
                  <span className="mr-2 inline-flex">
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
                <TypedInlineSlot delaySteps={homeFlowStep2 + getFlowStepCount(homeText2)}>
                  <span className="mr-2 inline-flex">
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
                  <span className="mr-2 inline-flex">
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
                      label={<MenuOptionTypewriter text={HOME_SHOW_TABLE_LABEL} startDelayMs={0} />}
                      onClick={() => handleHomeAction(4)}
                      active={activeHomeCursorIndex === 4}
                    />
                  </motion.div>
                ) : null}

                {hasResettableChanges && homeRevealStage >= HOME_REVEAL_STAGE_SHOW_TABLE ? (
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

              {hasCustomCalendar && homeRevealStage >= HOME_REVEAL_STAGE_SHOW_TABLE ? (
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
              onAction={handleFooterAction}
              onToggleCommands={(nextVisible) => setAutoHideKeyCommands(nextVisible)}
              onCommandToggleAvailabilityChange={setHomeFooterCommandToggleAvailable}
              revealCount={homeFooterRevealCount}
              keyboardCommandsEnabled={autoHideKeyCommands}
              keyboardCommandsVisible={homeRevealStage >= HOME_REVEAL_STAGE_KEY_COMMANDS}
              reserveIntroSpace
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
              <div className="mb-8 flex min-h-[17px] items-center gap-4 text-[12px]">
                <InlineAction
                  label="🡨 Back"
                  onClick={() => handleTableAction(TABLE_CURSOR_BACK_INDEX)}
                  active={activeTableCursorIndex === TABLE_CURSOR_BACK_INDEX}
                />
                {hasResettableChanges ? (
                  <>
                    <Separator aria-hidden className="leading-4" />
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
                        'group absolute top-0 inline-flex items-center gap-1 pr-[12px] text-[10px] font-bold text-foreground focus-visible:outline-none',
                        tableSliderIndicatorPositionClass,
                      )}
                      style={{ left: `${tableLifetimeSliderPercent}%` }}
                    >
                      {tableCanDecrementLifetime ? (
                        <kbd
                          className={tableScrollKeycapClass(
                            tableSliderLeftKeyActive,
                            false,
                          )}
                        >
                          🡨
                        </kbd>
                      ) : null}
                      <span
                        className={cn(
                          interactiveBaseClass,
                          'group-hover:motion-safe:after:origin-left group-hover:motion-safe:after:scale-x-100 group-hover:motion-reduce:after:opacity-100',
                          activeTableCursorIndex === tableSliderIndicatorCursorIndex &&
                            'motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100',
                        )}
                      >
                        {formatLifetimeShort(lifetimeYears)}
                      </span>
                      {tableCanIncrementLifetime ? (
                        <kbd
                          className={tableScrollKeycapClass(
                            tableSliderRightKeyActive,
                            false,
                          )}
                        >
                          🡪
                        </kbd>
                      ) : null}
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

              <div
                ref={tableScrollViewportRef}
                onMouseLeave={hideTableTooltip}
                className="w-full max-w-[640px] overflow-x-auto pb-2 max-[735px]:max-w-none max-[735px]:w-[calc(100%+3rem)] max-[735px]:-mr-12 max-sm:w-[calc(100%+1.5rem)] max-sm:-mr-6"
              >
                <div className="w-fit cursor-default select-none text-[10px] max-[735px]:pr-12 max-sm:pr-6">
                  <div className="grid" style={{ gridTemplateColumns: `46px repeat(${columns.length}, 99px)` }}>
                    <div className="sticky left-0 z-20 h-6 bg-background" />
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
                        onApproximateCellEnter={handleApproximateCellEnter}
                        onApproximateCellMove={handleApproximateCellMove}
                        onApproximateCellLeave={handleApproximateCellLeave}
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
                      <TooltipTypewriterText
                        key={`${tableTooltip.key}-${tableTooltip.text}`}
                        text={tableTooltip.text}
                      />
                    </div>,
                    document.body,
                  )
                : null}

              {canShowTableScrollControl ? (
                <div className="mt-2 w-full max-w-[640px] text-[10px] text-muted-foreground max-[735px]:max-w-none max-[735px]:w-[calc(100%+3rem)] max-[735px]:-mr-12 max-[735px]:pr-12 max-sm:w-[calc(100%+1.5rem)] max-sm:-mr-6 max-sm:pr-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block size-[12px] border border-border bg-hatch" />
                      Not Possible
                    </span>

                    <div className="relative inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTableCursorIndex(tableScrollCursorIndex)
                          scrollTableByStep(-1)
                        }}
                        onMouseEnter={() => setTableCursorIndex(tableScrollCursorIndex)}
                        disabled={!tableCanScrollLeft}
                        className="focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
                      >
                        <kbd className={tableScrollKeycapClass(tableScrollLeftKeyActive, !tableCanScrollLeft)}>
                          🡨
                        </kbd>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTableCursorIndex(tableScrollCursorIndex)}
                        onMouseEnter={() => setTableCursorIndex(tableScrollCursorIndex)}
                        className={cn(
                          interactiveBaseClass,
                          'cursor-pointer',
                          activeTableCursorIndex === tableScrollCursorIndex &&
                            'motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100',
                          activeTableCursorIndex === tableScrollCursorIndex
                            ? 'font-bold text-foreground'
                            : 'font-medium text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Scroll
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTableCursorIndex(tableScrollCursorIndex)
                          scrollTableByStep(1)
                        }}
                        onMouseEnter={() => setTableCursorIndex(tableScrollCursorIndex)}
                        disabled={!tableCanScrollRight}
                        className="focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
                      >
                        <kbd className={tableScrollKeycapClass(tableScrollRightKeyActive, !tableCanScrollRight)}>
                          🡪
                        </kbd>
                      </button>
                      <TerminalCursor
                        active={activeTableCursorIndex === tableScrollCursorIndex}
                        className="absolute left-full top-1/2 ml-1 -translate-y-1/2"
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex flex-col items-start gap-y-2">
                    <span className="relative inline-flex items-center">
                      <span>Rows: Time saved per task (</span>
                      <button
                        type="button"
                        onClick={() => handleTableAction(tableRowsEditCursorIndex)}
                        className={cn(
                          interactiveBaseClass,
                          activeTableCursorIndex === tableRowsEditCursorIndex
                            ? 'font-bold text-foreground motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100'
                            : 'font-medium text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Edit
                      </button>
                      <span>)</span>
                      <TerminalCursor
                        active={activeTableCursorIndex === tableRowsEditCursorIndex}
                        className="absolute left-full ml-1 top-1/2 -translate-y-1/2"
                      />
                    </span>
                    <span className="relative inline-flex items-center">
                      <span>Columns: Task frequency (</span>
                      <button
                        type="button"
                        onClick={() => handleTableAction(tableColumnsEditCursorIndex)}
                        className={cn(
                          interactiveBaseClass,
                          activeTableCursorIndex === tableColumnsEditCursorIndex
                            ? 'font-bold text-foreground motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100'
                            : 'font-medium text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Edit
                      </button>
                      <span>)</span>
                      <TerminalCursor
                        active={activeTableCursorIndex === tableColumnsEditCursorIndex}
                        className="absolute left-full ml-1 top-1/2 -translate-y-1/2"
                      />
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex max-w-[640px] flex-col items-start gap-y-2 text-[10px] text-muted-foreground min-[736px]:h-3 min-[736px]:flex-row min-[736px]:flex-wrap min-[736px]:items-center min-[736px]:gap-x-4 min-[736px]:gap-y-2 min-[736px]:pl-[46px]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-[12px] border border-border bg-hatch" />
                    Not Possible
                  </span>
                  <Separator className="hidden min-[736px]:block" />
                  <span className="relative inline-flex items-center">
                    <span>Rows: Time saved per task (</span>
                    <button
                      type="button"
                      onClick={() => handleTableAction(tableRowsEditCursorIndex)}
                      className={cn(
                        interactiveBaseClass,
                        activeTableCursorIndex === tableRowsEditCursorIndex
                          ? 'font-bold text-foreground motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100'
                          : 'font-medium text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Edit
                    </button>
                    <span>)</span>
                    <TerminalCursor
                      active={activeTableCursorIndex === tableRowsEditCursorIndex}
                      className="absolute left-full ml-1 top-1/2 -translate-y-1/2"
                    />
                  </span>
                  <Separator className="hidden min-[736px]:block" />
                  <span className="relative inline-flex items-center">
                    <span>Columns: Task frequency (</span>
                    <button
                      type="button"
                      onClick={() => handleTableAction(tableColumnsEditCursorIndex)}
                      className={cn(
                        interactiveBaseClass,
                        activeTableCursorIndex === tableColumnsEditCursorIndex
                          ? 'font-bold text-foreground motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100'
                          : 'font-medium text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Edit
                    </button>
                    <span>)</span>
                    <TerminalCursor
                      active={activeTableCursorIndex === tableColumnsEditCursorIndex}
                      className="absolute left-full ml-1 top-1/2 -translate-y-1/2"
                    />
                  </span>
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
              onAction={handleFooterAction}
              onToggleCommands={(nextVisible) => setAutoHideKeyCommands(nextVisible)}
              onCommandToggleAvailabilityChange={setTableFooterCommandToggleAvailable}
              keyboardCommandsEnabled={autoHideKeyCommands}
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
                  onClick={navigateBackFromSettings}
                  active={settingsIndex === settingsBackIndex}
                />
              </div>

              <div className="flex flex-col gap-2 text-[12px]">
                {settingsOptions.map((option, index) => {
                  const optionIndex = settingsOptionStartIndex + index
                  const isResetOption = option.id === 'reset'

                  return (
                    <div
                      key={option.id}
                      className={cn(
                        'grid grid-cols-[12px_minmax(0,1fr)] items-start gap-2',
                        isResetOption && 'mt-6',
                      )}
                    >
                      <div className="w-3 shrink-0 self-start translate-y-[1.5px] text-foreground leading-none">
                        {optionIndex === settingsIndex ? '🡲' : '\u00A0'}
                      </div>
                      <button
                        type="button"
                        className={cn(
                          isResetOption
                            ? cn(
                                interactiveBaseClass,
                                'inline-flex w-fit cursor-pointer items-center text-left outline-none transition-colors',
                                optionIndex === settingsIndex &&
                                  'motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100',
                                optionIndex === settingsIndex
                                  ? 'font-bold text-foreground'
                                  : 'font-medium text-muted-foreground hover:text-foreground',
                              )
                            : cn(
                                'w-full cursor-pointer text-left outline-none transition-colors',
                                optionIndex === settingsIndex
                                  ? 'font-bold text-foreground'
                                  : 'font-medium text-muted-foreground hover:text-foreground',
                              ),
                        )}
                        onMouseEnter={() => setSettingsIndex(optionIndex)}
                        onClick={() => activateSettingsOption(index)}
                      >
                        {isResetOption ? (
                          <MenuOptionTypewriter
                            text={option.label}
                            startDelayMs={optionIndex * MENU_OPTION_STAGGER_MS}
                            animateOnlyOnMount
                          />
                        ) : (
                          <span
                            className={cn(
                              option.value
                                ? 'grid grid-cols-[24ch_minmax(0,1fr)] items-start gap-x-8'
                                : 'block',
                            )}
                            style={{ lineHeight: 'normal' }}
                          >
                            <span style={{ lineHeight: 'normal' }}>
                              <MenuOptionTypewriter
                                text={option.label}
                                startDelayMs={optionIndex * MENU_OPTION_STAGGER_MS}
                                animateOnlyOnMount
                              />
                            </span>
                            {option.value ? (
                              <span style={{ lineHeight: 'normal' }}>
                              <MenuOptionTypewriter
                                text={option.value}
                                startDelayMs={optionIndex * MENU_OPTION_STAGGER_MS}
                                animateOnlyOnMount
                                reserveLayout
                              />
                            </span>
                          ) : null}
                          </span>
                        )}
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
                    <div className="w-3 text-foreground">
                      {menuCursorVisible && index === menuIndex ? '🡲' : '\u00A0'}
                    </div>
                    <button
                      type="button"
                      className={cn(
                        'cursor-pointer text-left leading-6 outline-none transition-colors',
                        index === menuIndex
                          ? 'font-bold text-foreground'
                          : 'font-medium text-muted-foreground hover:text-foreground',
                      )}
                      onMouseEnter={() => setMenuIndex(index)}
                      onClick={() => selectMenuItem(index)}
                    >
                      {(() => {
                        const optionLabel =
                          index === menuSelectedIndex ? `${label} (current)` : label
                        return (
                      <MenuOptionTypewriter
                            text={optionLabel}
                        startDelayMs={index * MENU_OPTION_STAGGER_MS}
                      />
                        )
                      })()}
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <div className="w-3 text-foreground">
                    {menuCursorVisible && menuIndex === menuNewOptionIndex ? '🡲' : '\u00A0'}
                  </div>
                  <button
                    type="button"
                    className={cn(
                      'cursor-pointer text-left leading-6 outline-none transition-colors',
                      menuIndex === menuNewOptionIndex
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
                  <div className="w-3 text-foreground">
                    {menuCursorVisible && menuIndex === menuCancelIndex ? '🡲' : '\u00A0'}
                  </div>
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

        {isTableEditMenuView ? (
          <motion.section
            key={view}
            variants={activeScreenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] sm:min-h-[calc(100vh-96px)] w-full max-w-[1200px] flex-col"
          >
            <TerminalHeader title={tableEditMenuTitle} />

            <div
              className="grow max-w-[640px] outline-none"
              tabIndex={0}
              data-screen-autofocus-view={view}
              onKeyDown={handleTableEditMenuKeyDown}
            >
              <div className="text-[12px]">
                <p className="mb-6 font-bold leading-6 text-foreground">
                  <MenuOptionTypewriter
                    text={activeTableEditMenuKind === 'rows' ? 'Time saved per task' : 'Task frequency'}
                    startDelayMs={0}
                  />
                </p>

                <div className="leading-6">
                  {tableEditMenuItems.map((item, index) => {
                    const isActive = tableEditMenuIndex === index
                    const showCursor = tableEditMenuCursorVisible && isActive
                    const shouldAnimateIntro = !tableEditMenuCursorVisible
                    const isDefault =
                      item.kind === 'default-row' || item.kind === 'default-column'
                    const isNew = item.kind === 'new'
                    const isCancel = item.kind === 'cancel'
                    const isCustomItem =
                      item.kind === 'custom-row' || item.kind === 'custom-column'
                    const itemKey =
                      item.kind === 'default-row'
                        ? `default-row-${item.row.id}`
                        : item.kind === 'default-column'
                          ? `default-column-${item.column.id}`
                          : item.kind === 'custom-row'
                            ? `custom-row-${item.row.id}`
                            : item.kind === 'custom-column'
                              ? `custom-column-${item.column.id}`
                              : item.kind
                    const label =
                      item.kind === 'default-row'
                        ? formatLongDuration(item.row.seconds)
                        : item.kind === 'default-column'
                          ? formatFrequencyLong(item.column)
                          : item.kind === 'custom-row'
                            ? formatLongDuration(item.row.seconds)
                            : item.kind === 'custom-column'
                              ? formatFrequencyLong(item.column)
                              : isNew
                                ? tableEditMenuNewLabel
                                : tableEditMenuExitLabel
                    const defaultStatus =
                      item.kind === 'default-row'
                        ? enabledDefaultRowIds.has(item.row.id)
                          ? 'On'
                          : 'Off'
                        : item.kind === 'default-column'
                          ? enabledDefaultColumnIds.has(item.column.id)
                            ? 'On'
                            : 'Off'
                          : ''
                    const rowTopSpacingClass =
                      index === tableEditDefaultItemCount
                        ? 'mt-6'
                        : isCancel
                          ? 'mt-8'
                          : ''

                    return (
                      <div key={itemKey} className={cn('flex items-center gap-2', rowTopSpacingClass)}>
                        <div className="w-3 text-foreground">{showCursor ? '🡲' : '\u00A0'}</div>

                        {isCancel ? (
                          <button
                            type="button"
                            className={cn(
                              interactiveBaseClass,
                              'inline-flex w-fit cursor-pointer items-center text-left align-top outline-none',
                              isActive &&
                                'motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100',
                              isActive
                                ? 'font-bold text-foreground'
                                : 'font-medium text-muted-foreground hover:text-foreground',
                            )}
                            onMouseEnter={() => setTableEditMenuIndex(index)}
                            onClick={() => activateTableEditMenuItem(index)}
                          >
                            <MenuOptionTypewriter
                              text={label}
                              startDelayMs={shouldAnimateIntro ? index * MENU_OPTION_STAGGER_MS : 0}
                            />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={cn(
                              'grid w-full max-w-[260px] cursor-pointer grid-cols-[1fr_56px] items-baseline gap-x-8 text-left outline-none transition-colors',
                              isActive
                                ? 'font-bold text-foreground'
                                : 'font-medium text-muted-foreground hover:text-foreground',
                            )}
                            onMouseEnter={() => setTableEditMenuIndex(index)}
                            onClick={() => activateTableEditMenuItem(index)}
                          >
                            <span>
                              <MenuOptionTypewriter
                                text={label}
                                startDelayMs={shouldAnimateIntro ? index * MENU_OPTION_STAGGER_MS : 0}
                              />
                            </span>
                            <span className="justify-self-start">
                              {isDefault ? (
                                <MenuOptionTypewriter
                                  key={`${itemKey}-${defaultStatus}-${tableEditMenuCursorVisible ? 'active' : 'intro'}`}
                                  text={defaultStatus}
                                  startDelayMs={
                                    shouldAnimateIntro ? index * MENU_OPTION_STAGGER_MS : 0
                                  }
                                />
                              ) : isCustomItem && isActive ? (
                                <span
                                  className={cn(
                                    interactiveBaseClass,
                                    'font-bold text-foreground motion-safe:after:origin-left motion-safe:after:scale-x-100 motion-reduce:after:opacity-100',
                                  )}
                                >
                                  <MenuOptionTypewriter text="Remove" startDelayMs={0} />
                                </span>
                              ) : null}
                            </span>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
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
            <TerminalHeader title="Add table column" />

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
            <TerminalHeader title="Add table row" />

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

function TooltipTypewriterText({
  text,
}: {
  text: string
}) {
  const prefersReducedMotion = useReducedMotion()
  const [visibleLength, setVisibleLength] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion) {
      return
    }

    let timer = 0
    let cancelled = false

    if (text.length === 0) {
      return
    }

    const step = (index: number) => {
      if (cancelled) {
        return
      }

      setVisibleLength(index)

      if (index >= text.length) {
        return
      }

      timer = window.setTimeout(() => step(index + 1), 16)
    }

    timer = window.setTimeout(() => step(1), 45)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [prefersReducedMotion, text])

  if (prefersReducedMotion) {
    return <span>{text}</span>
  }

  return <span>{text.slice(0, visibleLength)}</span>
}

function MenuOptionTypewriter({
  text,
  startDelayMs,
  animateOnlyOnMount = false,
  reserveLayout = false,
}: {
  text: string
  startDelayMs: number
  animateOnlyOnMount?: boolean
  reserveLayout?: boolean
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

    if (startDelayMs <= 0) {
      step(1)
    } else {
      timer = window.setTimeout(() => step(1), startDelayMs)
    }

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [animateOnlyOnMount, shouldAnimate, startDelayMs, text])

  if (!shouldAnimate) {
    return <span>{text}</span>
  }

  if (reserveLayout) {
    return (
      <span className="relative block">
        <span className="invisible block">{text}</span>
        <span className="absolute inset-0 block">{text.slice(0, visibleLength)}</span>
      </span>
    )
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
  onApproximateCellEnter,
  onApproximateCellMove,
  onApproximateCellLeave,
}: {
  row: SavingsRow
  columns: FrequencyColumn[]
  isLastRow: boolean
  lifetimeYears: number
  calendarBasis: (typeof DEFAULT_STATE)['calendarBasis']
  customDaysPerYear: number
  displayMode: (typeof DEFAULT_STATE)['displayMode']
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
      data-terminal-cursor="true"
      className={cn(
        'inline-block h-[12px] w-[8px] bg-foreground transition-opacity',
        active ? 'opacity-100 animate-[terminal-blink_1s_steps(1,end)_infinite]' : 'opacity-0',
        className,
      )}
      aria-hidden="true"
    />
  )
}

function TerminalHeader({
  title,
  typewriter = false,
}: {
  title: string
  typewriter?: boolean
}) {
  return (
    <header className="mb-12 w-full max-w-[640px]">
      <h1 className="m-0 text-[12px] font-bold leading-none text-foreground">
        {typewriter ? <TypedWords text={title} /> : title}
      </h1>
    </header>
  )
}

function parseNavigationStateFromPath(pathname: string): NavigationUrlState {
  const segments = pathname.split('/').filter(Boolean)
  const state: NavigationUrlState = {
    view: 'home',
    menuReturnView: 'home',
    settingsReturnView: 'home',
    tableEditMenuKind: 'columns',
    menuCustomKind: 'frequency',
  }

  const first = segments[0]
  const second = segments[1]
  const third = segments[2]

  if (!first) {
    return state
  }

  if (first === 'settings') {
    state.view = 'settings'
    return state
  }

  if (first === 'home' || first === 'table') {
    const baseView: BaseView = first
    state.menuReturnView = baseView
    state.settingsReturnView = baseView

    if (!second) {
      state.view = baseView
      return state
    }

    if (second === 'settings') {
      state.view = 'settings'
      return state
    }

    if (baseView === 'table' && second === 'rows') {
      state.tableEditMenuKind = 'rows'
      state.view = third === 'add' ? 'add-row' : 'menu-edit-rows'
      return state
    }

    if (baseView === 'table' && second === 'columns') {
      state.tableEditMenuKind = 'columns'
      state.view = third === 'add' ? 'add-column' : 'menu-edit-columns'
      return state
    }

    if (isMenuId(second)) {
      state.menuCustomKind = menuCustomKindFromMenuId(second)
      state.view = third === 'add' ? 'add-menu-option' : menuViewFromMenuId(second)
      return state
    }

    state.view = baseView
    return state
  }

  if (isMenuId(first)) {
    state.menuReturnView = 'home'
    state.menuCustomKind = menuCustomKindFromMenuId(first)
    state.view = second === 'add' ? 'add-menu-option' : menuViewFromMenuId(first)
    return state
  }

  return state
}

function buildNavigationPath(state: NavigationUrlState) {
  if (state.view === 'home') {
    return '/'
  }

  if (state.view === 'table') {
    return '/table'
  }

  if (state.view === 'settings') {
    return '/settings'
  }

  if (state.view === 'menu-frequency') {
    return `/${state.menuReturnView}/${MENU_ID_FREQUENCY}`
  }

  if (state.view === 'menu-time') {
    return `/${state.menuReturnView}/${MENU_ID_SAVINGS}`
  }

  if (state.view === 'menu-lifetime') {
    return `/${state.menuReturnView}/${MENU_ID_PERIOD}`
  }

  if (state.view === 'add-menu-option') {
    return `/${state.menuReturnView}/${menuIdFromMenuCustomKind(state.menuCustomKind)}/add`
  }

  if (state.view === 'menu-edit-rows') {
    return '/table/rows'
  }

  if (state.view === 'menu-edit-columns') {
    return '/table/columns'
  }

  if (state.view === 'add-row') {
    return '/table/rows/add'
  }

  return '/table/columns/add'
}

function writeNavigationPathToUrl(
  nextPath: string,
  mode: 'push' | 'replace',
  navigationIndex: number,
) {
  const params = new URLSearchParams(window.location.search)
  params.delete('v')
  params.delete('mr')
  params.delete('sr')
  params.delete('tk')
  params.delete('mk')
  const nextSearch = params.toString()
  const nextUrl = `${nextPath}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
  const currentState =
    typeof window.history.state === 'object' && window.history.state !== null
      ? (window.history.state as Record<string, unknown>)
      : {}
  const nextState: Record<string, unknown> = {
    ...currentState,
    [NAVIGATION_HISTORY_STATE_KEY]: navigationIndex,
  }
  if (mode === 'push') {
    window.history.pushState(nextState, '', nextUrl)
  } else {
    window.history.replaceState(nextState, '', nextUrl)
  }

  return nextPath
}

function getNavigationHistoryIndex(state: unknown) {
  if (typeof state !== 'object' || state === null) {
    return 0
  }

  const candidate = (state as Record<string, unknown>)[NAVIGATION_HISTORY_STATE_KEY]
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0
    ? Math.floor(candidate)
    : 0
}

function isMenuId(value: string | undefined): value is 'frequency' | 'savings' | 'period' {
  return (
    value === MENU_ID_FREQUENCY ||
    value === MENU_ID_SAVINGS ||
    value === MENU_ID_PERIOD
  )
}

function menuCustomKindFromMenuId(menuId: 'frequency' | 'savings' | 'period'): MenuCustomKind {
  if (menuId === MENU_ID_FREQUENCY) {
    return 'frequency'
  }

  if (menuId === MENU_ID_SAVINGS) {
    return 'time'
  }

  return 'lifetime'
}

function menuIdFromMenuCustomKind(kind: MenuCustomKind) {
  if (kind === 'frequency') {
    return MENU_ID_FREQUENCY
  }

  if (kind === 'time') {
    return MENU_ID_SAVINGS
  }

  return MENU_ID_PERIOD
}

function menuViewFromMenuId(menuId: 'frequency' | 'savings' | 'period'): View {
  if (menuId === MENU_ID_FREQUENCY) {
    return 'menu-frequency'
  }

  if (menuId === MENU_ID_SAVINGS) {
    return 'menu-time'
  }

  return 'menu-lifetime'
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
