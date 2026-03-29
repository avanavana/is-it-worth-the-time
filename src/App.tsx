import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTheme } from 'next-themes'

import { HomeScreen } from '@/pages/home'
import { AddMenuOptionScreen } from '@/pages/add-menu-option'
import { AddTableItemScreen } from '@/pages/add-table-item'
import { SelectMenuScreen } from '@/pages/select-menu'
import { SettingsScreen } from '@/pages/settings'
import { TableScreen } from '@/pages/table'
import { MenuOption } from '@/components/menu-option'
import { Header } from '@/components/header'

import { useStore } from '@/lib/hooks/use-store'
import { cn } from '@/lib/utils/display'
import { calculateBreakEvenSeconds, getDaysPerYear, getRunsPerYear, isImpossibleCell } from '@/lib/utils/calculations'
import { DEFAULT_COLUMNS, DEFAULT_ROWS, DEFAULT_STATE, LIFETIME_PRESETS_YEARS } from '@/lib/utils/defaults'
import {
  clampIndex,
  focusLifetimeYearsRounded,
  formatFocusApproxText,
  formatFrequencyLong,
  formatLifetimeLong,
  formatLifetimePeriod,
  formatLifetimeShort,
  formatLongDuration,
  getFocusApproxUnitLabel,
  getClosestLifetimePresetIndex,
  getFlowStepCount,
  isActivationKey,
  isDefaultState,
  remapTableCursorIndexForResetSlot,
  valuesNearlyEqual,
} from '@/lib/utils/display'
import { formatCompactCellDisplay, formatPreciseLongText } from '@/lib/utils/formatters'
import {
  buildNavigationPath,
  getNavigationHistoryIndex,
  parseNavigationStateFromPath,
  writeNavigationPathToUrl,
} from '@/lib/utils/navigation'
import { parseDurationInput, parseFrequencyInput, parseTimeSavedInput } from '@/lib/utils/parsers'
import { savePersistedState } from '@/lib/utils/storage'
import {
  interactiveBaseClass,
  reducedMotionScreenVariants,
  screenVariants,
} from '@/lib/constants/view'
import {
  MENU_CURSOR_REVEAL_DELAY_MS,
  MENU_OPTION_CHAR_MS,
  MENU_OPTION_STAGGER_MS,
  WORD_REVEAL_DURATION_SECONDS,
  WORD_REVEAL_STEP_SECONDS,
} from '@/lib/constants/animation'
import {
  DEFAULT_FOCUS_FREQUENCY,
  DEFAULT_FOCUS_TIME_SAVED_SECONDS,
  FOOTER_LINK_COUNT,
  HOME_CURSOR_RESULT_INDEX,
  HOME_KEY_COMMANDS_LINK_TO_FOOTER_DELAY_MS,
  HOME_KEY_COMMANDS_TO_FOOTER_DELAY_MS,
  HOME_RESULT_TYPEWRITER_DURATION_MS,
  HOME_REVEAL_STAGE_FOOTER_START,
  HOME_REVEAL_STAGE_KEY_COMMANDS,
  HOME_REVEAL_STAGE_RESULT,
  HOME_REVEAL_STAGE_SHOW_TABLE,
  HOME_SHOW_TABLE_LABEL,
  HOME_SHOW_TABLE_TYPEWRITER_DURATION_MS,
  HOME_STAGE_STAGGER_MS,
} from '@/lib/constants/home'
import { PARSER_YEAR_SECONDS } from '@/lib/constants/time'
import {
  TABLE_CURSOR_BACK_INDEX,
  TABLE_LAYOUT_BREAKPOINT_PX,
  TABLE_SCROLL_EPSILON_PX,
  TABLE_SCROLL_STEP_PX,
  TABLE_TOOLTIP_SHOW_DELAY_MS,
} from '@/lib/constants/table'
import { MAX_COLUMNS } from '@/lib/constants/limits'

import type {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  BaseView,
  FrequencyColumn,
  MenuCustomKind,
  NavigationUrlState,
  NonSettingsView,
  SavingsRow,
  SettingsOption,
  TableEditMenuItem,
  TableEditMenuKind,
  View,
} from '@/types'
import type { TerminalErrorEntry } from '@/components/error-log'

type ActiveMenuOption =
  | { id: string; label: string; isCustom: boolean; kind: 'frequency'; column: FrequencyColumn }
  | { id: string; label: string; isCustom: boolean; kind: 'time'; row: SavingsRow }
  | { id: string; label: string; isCustom: boolean; kind: 'lifetime'; years: number }

export default function App() {
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
  } = useStore()

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
  const [menuHasInteracted, setMenuHasInteracted] = useState(false)
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
  const [menuCustomErrors, setMenuCustomErrors] = useState<TerminalErrorEntry[]>([])
  const [addColumnErrors, setAddColumnErrors] = useState<TerminalErrorEntry[]>([])
  const [addRowErrors, setAddRowErrors] = useState<TerminalErrorEntry[]>([])
  const errorIdRef = useRef(0)
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
  const focusResultApproxUnitLabel = getFocusApproxUnitLabel(focusResult, calendarBasis)
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

  useEffect(() => {
    if (view !== 'add-menu-option' && menuCustomErrors.length > 0) {
      const clearTimeoutId = window.setTimeout(() => {
        setMenuCustomErrors([])
      }, 0)
      return () => {
        window.clearTimeout(clearTimeoutId)
      }
    }
  }, [menuCustomErrors.length, view])

  useEffect(() => {
    if (view !== 'add-column' && addColumnErrors.length > 0) {
      const clearTimeoutId = window.setTimeout(() => {
        setAddColumnErrors([])
      }, 0)
      return () => {
        window.clearTimeout(clearTimeoutId)
      }
    }
  }, [addColumnErrors.length, view])

  useEffect(() => {
    if (view !== 'add-row' && addRowErrors.length > 0) {
      const clearTimeoutId = window.setTimeout(() => {
        setAddRowErrors([])
      }, 0)
      return () => {
        window.clearTimeout(clearTimeoutId)
      }
    }
  }, [addRowErrors.length, view])

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

  const frequencyMenuColumns = useMemo(
    () => getOrderedFrequencyMenuColumns(columns),
    [columns],
  )
  const timeMenuRows = useMemo(() => getOrderedTimeMenuRows(rows), [rows])
  const lifetimeHasCustomOption = !LIFETIME_PRESETS_YEARS.some((optionYears) =>
    valuesNearlyEqual(optionYears, lifetimeYears),
  )
  const menuOptions = useMemo<ActiveMenuOption[]>(() => {
    if (view === 'menu-frequency') {
      return frequencyMenuColumns.map((column) => ({
        id: column.id,
        label: formatFrequencyLong(column),
        isCustom: column.isCustom,
        kind: 'frequency',
        column,
      }))
    }

    if (view === 'menu-time') {
      return timeMenuRows.map((row) => ({
        id: row.id,
        label: formatLongDuration(row.seconds),
        isCustom: row.isCustom,
        kind: 'time',
        row,
      }))
    }

    const lifetimeOptions: ActiveMenuOption[] = LIFETIME_PRESETS_YEARS.map((years) => ({
      id: `lifetime-${years}`,
      label: formatLifetimeLong(years),
      isCustom: false,
      kind: 'lifetime',
      years,
    }))

    if (lifetimeHasCustomOption) {
      lifetimeOptions.push({
        id: `lifetime-custom-${lifetimeYears}`,
        label: formatLifetimeLong(lifetimeYears),
        isCustom: true,
        kind: 'lifetime',
        years: lifetimeYears,
      })
    }

    return lifetimeOptions
  }, [frequencyMenuColumns, lifetimeHasCustomOption, lifetimeYears, timeMenuRows, view])
  const menuDefaultOptionCount =
    view === 'menu-frequency'
      ? frequencyMenuColumns.filter((column) => !column.isCustom).length
      : view === 'menu-time'
        ? timeMenuRows.filter((row) => !row.isCustom).length
        : LIFETIME_PRESETS_YEARS.length
  const menuSupportsCustomRemove = view === 'menu-frequency' || view === 'menu-time'
  const menuHasCustomOptions = menuOptions.some((option) => option.isCustom)
  const menuExitLabel = menuHasInteracted || menuHasCustomOptions ? 'Back' : 'Cancel'
  const menuOptionsCount = menuOptions.length
  const menuNewOptionIndex = menuOptionsCount
  const menuCancelIndex = menuOptionsCount + 1
  const menuItemCount = menuOptionsCount + 2
  const menuSelectedIndex =
    view === 'menu-frequency'
      ? (() => {
          const index = menuOptions.findIndex(
            (option) =>
              option.kind === 'frequency' &&
              option.column.amount === focusFrequency.amount &&
              option.column.unit === focusFrequency.unit,
          )
          return index >= 0 ? index : menuNewOptionIndex
        })()
      : view === 'menu-time'
        ? (() => {
            const index = menuOptions.findIndex(
              (option) => option.kind === 'time' && option.row.seconds === focusTimeSavedSeconds,
            )
            return index >= 0 ? index : menuNewOptionIndex
          })()
        : (() => {
            const index = menuOptions.findIndex(
              (option) => option.kind === 'lifetime' && valuesNearlyEqual(option.years, lifetimeYears),
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
    if (!isMenuView) {
      return
    }

    const clamped = clampIndex(menuIndex, menuItemCount)
    if (clamped === menuIndex) {
      return
    }

    const clampMenuCursorTimeout = window.setTimeout(() => {
      setMenuIndex(clamped)
    }, 0)

    return () => {
      window.clearTimeout(clampMenuCursorTimeout)
    }
  }, [isMenuView, menuIndex, menuItemCount])

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

  const toTerminalErrorMessage = useCallback((message: string) => {
    const trimmed = message.trim()
    const normalized = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
    return `${normalized} Command exited with status 2.`
  }, [])

  const pushMenuCustomError = useCallback(
    (message: string) => {
      errorIdRef.current += 1
      setMenuCustomErrors((current) => [
        ...current,
        { id: errorIdRef.current, message: toTerminalErrorMessage(message) },
      ])
    },
    [toTerminalErrorMessage],
  )

  const pushAddColumnError = useCallback(
    (message: string) => {
      errorIdRef.current += 1
      setAddColumnErrors((current) => [
        ...current,
        { id: errorIdRef.current, message: toTerminalErrorMessage(message) },
      ])
    },
    [toTerminalErrorMessage],
  )

  const pushAddRowError = useCallback(
    (message: string) => {
      errorIdRef.current += 1
      setAddRowErrors((current) => [
        ...current,
        { id: errorIdRef.current, message: toTerminalErrorMessage(message) },
      ])
    },
    [toTerminalErrorMessage],
  )

  function openFrequencyMenu(returnView: BaseView) {
    setMenuReturnView(returnView)
    setMenuIndex(0)
    setMenuCursorVisible(false)
    setMenuHasInteracted(false)
    setView('menu-frequency')
  }

  function openTimeMenu(returnView: BaseView) {
    setMenuReturnView(returnView)
    setMenuIndex(0)
    setMenuCursorVisible(false)
    setMenuHasInteracted(false)
    setView('menu-time')
  }

  function openLifetimeMenu(returnView: BaseView) {
    setMenuReturnView(returnView)
    setMenuIndex(0)
    setMenuCursorVisible(false)
    setMenuHasInteracted(false)
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
    const option = menuOptions[index]
    if (!option) {
      return
    }

    if (option.kind === 'frequency') {
      setFocusFrequency({
        id: `focus-frequency-${option.column.id}`,
        label: option.column.label,
        amount: option.column.amount,
        unit: option.column.unit,
        isCustom: option.column.isCustom,
      })
      setView(menuReturnView)
      return
    }

    if (option.kind === 'time') {
      setFocusTimeSavedSeconds(option.row.seconds)
      setView(menuReturnView)
      return
    }

    setLifetimeYears(option.years)
    setView(menuReturnView)
  }

  function removeMenuCustomOption(index: number) {
    const option = menuOptions[index]
    if (!option || !option.isCustom) {
      return
    }

    if (option.kind === 'frequency') {
      const wasFocused =
        valuesNearlyEqual(focusFrequency.amount, option.column.amount) &&
        focusFrequency.unit === option.column.unit
      deleteCustomColumn(option.column.id)
      let nextColumns = useStore.getState().columns
      let fallbackColumn = nextColumns.find(
        (column) =>
          valuesNearlyEqual(column.amount, DEFAULT_FOCUS_FREQUENCY.amount) &&
          column.unit === DEFAULT_FOCUS_FREQUENCY.unit,
      )

      if (wasFocused && !fallbackColumn) {
        const defaultColumn = DEFAULT_COLUMNS.find(
          (column) =>
            valuesNearlyEqual(column.amount, DEFAULT_FOCUS_FREQUENCY.amount) &&
            column.unit === DEFAULT_FOCUS_FREQUENCY.unit,
        )
        const isDefaultColumnEnabled =
          defaultColumn !== undefined &&
          nextColumns.some((column) => column.id === defaultColumn.id && !column.isCustom)

        if (defaultColumn && !isDefaultColumnEnabled) {
          toggleDefaultColumn(defaultColumn.id)
          nextColumns = useStore.getState().columns
          fallbackColumn = nextColumns.find(
            (column) =>
              valuesNearlyEqual(column.amount, DEFAULT_FOCUS_FREQUENCY.amount) &&
              column.unit === DEFAULT_FOCUS_FREQUENCY.unit,
          )
        }
      }

      const nextFrequencyOptions = getOrderedFrequencyMenuColumns(nextColumns)
      if (wasFocused && fallbackColumn) {
        const fallback = fallbackColumn
        setFocusFrequency({
          id: `focus-frequency-${fallback.id}`,
          label: fallback.label,
          amount: fallback.amount,
          unit: fallback.unit,
          isCustom: fallback.isCustom,
        })
      }

      if (wasFocused && fallbackColumn) {
        const fallbackIndex = nextFrequencyOptions.findIndex(
          (column) => column.id === fallbackColumn.id,
        )
        setMenuIndex(
          fallbackIndex >= 0
            ? fallbackIndex
            : Math.max(0, Math.min(index, nextFrequencyOptions.length - 1)),
        )
      } else {
        setMenuIndex(Math.max(0, Math.min(index, nextFrequencyOptions.length - 1)))
      }
      setMenuHasInteracted(true)
      return
    }

    if (option.kind === 'time') {
      const wasFocused = focusTimeSavedSeconds === option.row.seconds
      deleteCustomRow(option.row.id)
      let nextRows = useStore.getState().rows
      let fallbackRow = nextRows.find((row) => row.seconds === DEFAULT_FOCUS_TIME_SAVED_SECONDS)

      if (wasFocused && !fallbackRow) {
        const defaultRow = DEFAULT_ROWS.find((row) => row.seconds === DEFAULT_FOCUS_TIME_SAVED_SECONDS)
        const isDefaultRowEnabled =
          defaultRow !== undefined &&
          nextRows.some((row) => row.id === defaultRow.id && !row.isCustom)

        if (defaultRow && !isDefaultRowEnabled) {
          toggleDefaultRow(defaultRow.id)
          nextRows = useStore.getState().rows
          fallbackRow = nextRows.find((row) => row.seconds === DEFAULT_FOCUS_TIME_SAVED_SECONDS)
        }
      }

      const nextTimeOptions = getOrderedTimeMenuRows(nextRows)
      if (wasFocused && fallbackRow) {
        setFocusTimeSavedSeconds(fallbackRow.seconds)
      }

      if (wasFocused && fallbackRow) {
        const fallbackIndex = nextTimeOptions.findIndex((row) => row.id === fallbackRow.id)
        setMenuIndex(
          fallbackIndex >= 0
            ? fallbackIndex
            : Math.max(0, Math.min(index, nextTimeOptions.length - 1)),
        )
      } else {
        setMenuIndex(Math.max(0, Math.min(index, nextTimeOptions.length - 1)))
      }
      setMenuHasInteracted(true)
    }
  }

  function openNewMenuOption() {
    if (view === 'menu-frequency') {
      setMenuCustomKind('frequency')
      setMenuCustomDraft('')
      setMenuCustomErrors([])
      setAddMenuOptionCursorIndex(0)
      setView('add-menu-option')
      return
    }

    if (view === 'menu-time') {
      setMenuCustomKind('time')
      setMenuCustomDraft('')
      setMenuCustomErrors([])
      setAddMenuOptionCursorIndex(0)
      setView('add-menu-option')
      return
    }

    if (view === 'menu-lifetime') {
      setMenuCustomKind('lifetime')
      setMenuCustomDraft('')
      setMenuCustomErrors([])
      setAddMenuOptionCursorIndex(0)
      setView('add-menu-option')
    }
  }

  function closeAddMenuOption() {
    setMenuCustomDraft('')
    setMenuCustomErrors([])
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
        setAddRowErrors([])
        setAddRowCursorIndex(0)
        setView('add-row')
        return
      }

      setTableEditMenuKind('columns')
      setColumnDraft('')
      setAddColumnErrors([])
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
        pushMenuCustomError('Invalid input format')
        setMenuCustomDraft('')
        setAddMenuOptionCursorIndex(0)
        menuOptionInputRef.current?.focus({ preventScroll: true })
        return
      }

      const existing = columns.find(
        (column) =>
          valuesNearlyEqual(column.amount, parsed.amount) && column.unit === parsed.unit,
      )
      const matchingDefault = DEFAULT_COLUMNS.find(
        (column) =>
          valuesNearlyEqual(column.amount, parsed.amount) && column.unit === parsed.unit,
      )

      if (!existing && matchingDefault) {
        toggleDefaultColumn(matchingDefault.id)
      } else if (!existing) {
        addCustomColumn({
          label: parsed.label,
          amount: parsed.amount,
          unit: parsed.unit,
        })
      }

      const nextColumns = useStore.getState().columns
      const targetColumn = nextColumns.find(
        (column) =>
          valuesNearlyEqual(column.amount, parsed.amount) && column.unit === parsed.unit,
      )

      if (targetColumn) {
        setFocusFrequency({
          id: `focus-frequency-${targetColumn.id}`,
          label: targetColumn.label,
          amount: targetColumn.amount,
          unit: targetColumn.unit,
          isCustom: targetColumn.isCustom,
        })
      }

      const nextMenuOptions = getOrderedFrequencyMenuColumns(nextColumns)
      const nextMenuIndex = Math.max(
        0,
        nextMenuOptions.findIndex(
          (column) =>
            valuesNearlyEqual(column.amount, parsed.amount) && column.unit === parsed.unit,
        ),
      )

      setMenuCustomDraft('')
      setMenuCustomErrors([])
      setMenuIndex(nextMenuIndex)
      setMenuCursorVisible(false)
      setMenuHasInteracted(true)
      setView('menu-frequency')
      return
    }

    if (menuCustomKind === 'time') {
      const parsed = parseTimeSavedInput(menuCustomDraft)
      if (!parsed.ok) {
        pushMenuCustomError('Invalid input format')
        setMenuCustomDraft('')
        setAddMenuOptionCursorIndex(0)
        menuOptionInputRef.current?.focus({ preventScroll: true })
        return
      }

      const existing = rows.find((row) => row.seconds === parsed.seconds)
      const matchingDefault = DEFAULT_ROWS.find((row) => row.seconds === parsed.seconds)

      if (!existing && matchingDefault) {
        toggleDefaultRow(matchingDefault.id)
      } else if (!existing) {
        addCustomRow({
          label: parsed.label,
          seconds: parsed.seconds,
        })
      }

      const nextRows = useStore.getState().rows
      const targetRow = nextRows.find((row) => row.seconds === parsed.seconds)
      if (targetRow) {
        setFocusTimeSavedSeconds(targetRow.seconds)
      }

      const nextMenuOptions = getOrderedTimeMenuRows(nextRows)
      const nextMenuIndex = Math.max(
        0,
        nextMenuOptions.findIndex((row) => row.seconds === parsed.seconds),
      )

      setMenuCustomDraft('')
      setMenuCustomErrors([])
      setMenuIndex(nextMenuIndex)
      setMenuCursorVisible(false)
      setMenuHasInteracted(true)
      setView('menu-time')
      return
    }

    const parsed = parseDurationInput(menuCustomDraft, 'year')
    if (!parsed.ok) {
      pushMenuCustomError('Invalid input format')
      setMenuCustomDraft('')
      setAddMenuOptionCursorIndex(0)
      menuOptionInputRef.current?.focus({ preventScroll: true })
      return
    }

    const nextLifetimeYears = parsed.seconds / PARSER_YEAR_SECONDS
    setLifetimeYears(nextLifetimeYears)
    const presetIndex = LIFETIME_PRESETS_YEARS.findIndex((years) =>
      valuesNearlyEqual(years, nextLifetimeYears),
    )
    setMenuCustomDraft('')
    setMenuCustomErrors([])
    setMenuIndex(presetIndex >= 0 ? presetIndex : LIFETIME_PRESETS_YEARS.length)
    setMenuCursorVisible(false)
    setMenuHasInteracted(true)
    setView('menu-lifetime')
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
        if (menuSupportsCustomRemove && menuOptions[menuIndex]?.isCustom) {
          removeMenuCustomOption(menuIndex)
        } else {
          selectMenuItem(menuIndex)
        }
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
    setAddColumnErrors([])
    setAddColumnCursorIndex(0)
    returnToTableEditMenu()
  }

  function closeAddRow() {
    setRowDraft('')
    setAddRowErrors([])
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
      pushAddColumnError('Invalid input format')
      setColumnDraft('')
      setAddColumnCursorIndex(0)
      columnInputRef.current?.focus({ preventScroll: true })
      return
    }

    const duplicateExists = columns.some(
      (column) =>
        valuesNearlyEqual(column.amount, parsed.amount) && column.unit === parsed.unit,
    )
    if (duplicateExists) {
      pushAddColumnError('That column already exists')
      setColumnDraft('')
      setAddColumnCursorIndex(0)
      columnInputRef.current?.focus({ preventScroll: true })
      return
    }

    if (columns.length >= MAX_COLUMNS) {
      pushAddColumnError(`Maximum of ${MAX_COLUMNS} columns reached`)
      setColumnDraft('')
      setAddColumnCursorIndex(0)
      columnInputRef.current?.focus({ preventScroll: true })
      return
    }

    addCustomColumn({
      label: parsed.label,
      amount: parsed.amount,
      unit: parsed.unit,
    })

    const nextColumns = useStore.getState().columns
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
    setAddColumnErrors([])
    setTableEditMenuHasInteracted((current) => ({ ...current, columns: true }))
    returnToTableEditMenu(nextMenuIndex)
  }

  function submitRow() {
    const parsed = parseTimeSavedInput(rowDraft)
    if (!parsed.ok) {
      pushAddRowError('Invalid input format')
      setRowDraft('')
      setAddRowCursorIndex(0)
      rowInputRef.current?.focus({ preventScroll: true })
      return
    }

    const duplicateExists = rows.some((row) => row.seconds === parsed.seconds)
    if (duplicateExists) {
      pushAddRowError('That row already exists')
      setRowDraft('')
      setAddRowCursorIndex(0)
      rowInputRef.current?.focus({ preventScroll: true })
      return
    }

    addCustomRow({
      label: parsed.label,
      seconds: parsed.seconds,
    })

    const nextRows = useStore.getState().rows
    const nextCustomRows = nextRows.filter((row) => row.isCustom)
    const createdRowIndex = nextCustomRows.findIndex(
      (row) => row.label === parsed.label && row.seconds === parsed.seconds,
    )
    const nextMenuIndex =
      createdRowIndex >= 0
        ? DEFAULT_ROWS.length + createdRowIndex
        : 0

    setRowDraft('')
    setAddRowErrors([])
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
    <main className="min-h-screen bg-background p-6 text-foreground content:p-12">
      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <HomeScreen
            screenVariants={activeScreenVariants}
            onKeyDown={handleHomeKeyDown}
            homeTitle={homeTitle}
            homeText1={homeText1}
            homeText2={homeText2}
            homeText3={homeText3}
            homeText4={homeText4}
            homeFlowText1Delay={homeFlowText1Delay}
            homeFlowStep1={homeFlowStep1}
            homeFlowStep2={homeFlowStep2}
            homeFlowStep3={homeFlowStep3}
            homeFlowStep4={homeFlowStep4}
            frequencyLabel={formatFrequencyLong(focusFrequency)}
            timeSavedLabel={formatLongDuration(focusTimeSavedSeconds)}
            lifetimeLabel={formatLifetimePeriod(focusLifetimeYearsRounded(lifetimeYears))}
            activeHomeCursorIndex={activeHomeCursorIndex}
            onHomeAction={handleHomeAction}
            homeRevealStage={homeRevealStage}
            stagedRevealMotionProps={stagedRevealMotionProps}
            prefersReducedMotion={prefersReducedMotion}
            resultTypewriterDone={resultTypewriterDone}
            shouldTypeResultText={shouldTypeResultText}
            focusImpossible={focusImpossible}
            displayMode={displayMode}
            focusResultExactText={focusResultExactText}
            focusResult={focusResult}
            focusResultApproxUnitLabel={focusResultApproxUnitLabel}
            resultTypewriterRunId={resultTypewriterRunId}
            focusResultTypewriterText={focusResultTypewriterText}
            onResultTypewriterComplete={handleResultTypewriterComplete}
            hasResettableChanges={hasResettableChanges}
            hasCustomCalendar={hasCustomCalendar}
            daysPerYear={daysPerYear}
            homeFooterStartIndex={homeFooterStartIndex}
            homeFooterRevealCount={homeFooterRevealCount}
            autoHideKeyCommands={autoHideKeyCommands}
            onFooterAction={handleFooterAction}
            onToggleCommands={(nextVisible) => setAutoHideKeyCommands(nextVisible)}
            onCommandToggleAvailabilityChange={setHomeFooterCommandToggleAvailable}
          />
        ) : null}

        {view === 'table' ? (
          <TableScreen
            screenVariants={activeScreenVariants}
            onKeyDown={handleTableKeyDown}
            activeTableCursorIndex={activeTableCursorIndex}
            onTableAction={handleTableAction}
            tableResetIndex={tableResetIndex}
            hasResettableChanges={hasResettableChanges}
            tableText1={tableText1}
            tableFlowStep1={tableFlowStep1}
            tableText2={tableText2}
            tableFlowStep2={tableFlowStep2}
            lifetimeLongLabel={formatLifetimeLong(lifetimeYears)}
            lifetimePeriodLabel={formatLifetimePeriod(lifetimeYears)}
            lifetimeShortLabel={formatLifetimeShort(lifetimeYears)}
            tableLifetimeCursorIndex={tableLifetimeCursorIndex}
            tableDecrementCursorIndex={tableDecrementCursorIndex}
            tableIncrementCursorIndex={tableIncrementCursorIndex}
            tableCanDecrementLifetime={tableCanDecrementLifetime}
            tableCanIncrementLifetime={tableCanIncrementLifetime}
            tableSliderTrackRef={tableSliderTrackRef}
            onLifetimeIndicatorPointerDown={handleLifetimeIndicatorPointerDown}
            tableSliderIndicatorPositionClass={tableSliderIndicatorPositionClass}
            tableLifetimeSliderPercent={tableLifetimeSliderPercent}
            tableSliderLeftKeyActive={tableSliderLeftKeyActive}
            tableSliderRightKeyActive={tableSliderRightKeyActive}
            tableSliderIndicatorCursorIndex={tableSliderIndicatorCursorIndex}
            tableScrollKeycapClass={tableScrollKeycapClass}
            tableLifetimeIndex={tableLifetimeIndex}
            onSetLifetimeFromSliderIndex={setLifetimeFromSliderIndex}
            tableScrollViewportRef={tableScrollViewportRef}
            onHideTableTooltip={hideTableTooltip}
            columns={columns}
            rows={rows}
            lifetimeYears={lifetimeYears}
            calendarBasis={calendarBasis}
            customDaysPerYear={customDaysPerYear}
            displayMode={displayMode}
            significantDigits={significantDigits}
            onApproximateCellEnter={handleApproximateCellEnter}
            onApproximateCellMove={handleApproximateCellMove}
            onApproximateCellLeave={handleApproximateCellLeave}
            tableTooltip={tableTooltip}
            canShowTableScrollControl={canShowTableScrollControl}
            tableScrollCursorIndex={tableScrollCursorIndex}
            onSetTableCursorIndex={setTableCursorIndex}
            onScrollTableByStep={scrollTableByStep}
            tableCanScrollLeft={tableCanScrollLeft}
            tableCanScrollRight={tableCanScrollRight}
            tableScrollLeftKeyActive={tableScrollLeftKeyActive}
            tableScrollRightKeyActive={tableScrollRightKeyActive}
            tableRowsEditCursorIndex={tableRowsEditCursorIndex}
            tableColumnsEditCursorIndex={tableColumnsEditCursorIndex}
            tableFooterStartIndex={tableFooterStartIndex}
            onFooterAction={handleFooterAction}
            onToggleCommands={(nextVisible) => setAutoHideKeyCommands(nextVisible)}
            onCommandToggleAvailabilityChange={setTableFooterCommandToggleAvailable}
            autoHideKeyCommands={autoHideKeyCommands}
          />
        ) : null}

        {view === 'settings' ? (
          <SettingsScreen
            screenVariants={activeScreenVariants}
            onKeyDown={handleSettingsKeyDown}
            settingsIndex={settingsIndex}
            settingsBackIndex={settingsBackIndex}
            settingsOptions={settingsOptions}
            settingsOptionStartIndex={settingsOptionStartIndex}
            onBack={navigateBackFromSettings}
            onActivateOption={activateSettingsOption}
            onSetSettingsIndex={setSettingsIndex}
            menuOptionStaggerMs={MENU_OPTION_STAGGER_MS}
            interactiveBaseClass={interactiveBaseClass}
          />
        ) : null}

        {isMenuView ? (
          <SelectMenuScreen
            view={view}
            screenVariants={activeScreenVariants}
            menuTitle={menuTitle}
            menuOptions={menuOptions}
            menuDefaultOptionCount={menuDefaultOptionCount}
            menuSupportsCustomRemove={menuSupportsCustomRemove}
            menuCursorVisible={menuCursorVisible}
            menuIndex={menuIndex}
            menuSelectedIndex={menuSelectedIndex}
            menuNewOptionIndex={menuNewOptionIndex}
            menuCancelIndex={menuCancelIndex}
            cancelLabel={menuExitLabel}
            menuOptionStaggerMs={MENU_OPTION_STAGGER_MS}
            onKeyDown={handleMenuKeyDown}
            onSetMenuIndex={setMenuIndex}
            onActivateMenuItem={(index) => {
              if (menuSupportsCustomRemove && menuOptions[index]?.isCustom) {
                removeMenuCustomOption(index)
              } else {
                selectMenuItem(index)
              }
            }}
            onOpenNewOption={openNewMenuOption}
            onCancel={() => setView(menuReturnView)}
          />
        ) : null}

        {isTableEditMenuView ? (
          <motion.section
            key={view}
            variants={activeScreenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex min-h-[calc(100vh-48px)] content:min-h-[calc(100vh-96px)] w-full max-w-shell flex-col"
          >
            <Header title={tableEditMenuTitle} />

            <div
              className="grow max-w-content outline-none"
              tabIndex={0}
              data-screen-autofocus-view={view}
              onKeyDown={handleTableEditMenuKeyDown}
            >
              <div className="text-[12px]">
                <p className="mb-6 font-bold leading-6 text-foreground">
                  <MenuOption
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
                            <MenuOption
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
                              <MenuOption
                                text={label}
                                startDelayMs={shouldAnimateIntro ? index * MENU_OPTION_STAGGER_MS : 0}
                              />
                            </span>
                            <span className="justify-self-start">
                              {isDefault ? (
                                <MenuOption
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
                                  <MenuOption text="Remove" startDelayMs={0} />
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
          <AddMenuOptionScreen
            screenVariants={activeScreenVariants}
            title={menuCustomTitle}
            fieldLabel={menuCustomFieldLabel}
            kind={menuCustomKind}
            draft={menuCustomDraft}
            inputRef={menuOptionInputRef}
            cursorIndex={addMenuOptionCursorIndex}
            cancelRef={addMenuOptionCancelRef}
            errors={menuCustomErrors}
            menuOptionStaggerMs={MENU_OPTION_STAGGER_MS}
            onKeyDown={handleAddMenuOptionKeyDown}
            onDraftChange={setMenuCustomDraft}
            onSetCursorIndex={setAddMenuOptionCursorIndex}
            onSubmit={submitMenuCustomOption}
            onCancel={closeAddMenuOption}
          />
        ) : null}

        {view === 'add-column' ? (
          <AddTableItemScreen
            keyName="add-column"
            screenVariants={activeScreenVariants}
            title="Add table column"
            fieldLabel="Task frequency:"
            draft={columnDraft}
            inputId="column-input"
            inputRef={columnInputRef}
            cursorIndex={addColumnCursorIndex}
            cancelRef={addColumnCancelRef}
            errors={addColumnErrors}
            examples={['50/day', '10 tasks per day', 'Daily', 'Biweekly', '2/y', '...', 'etc']}
            menuOptionStaggerMs={MENU_OPTION_STAGGER_MS}
            autofocusView="add-column"
            onKeyDown={handleAddColumnKeyDown}
            onDraftChange={setColumnDraft}
            onSetCursorIndex={setAddColumnCursorIndex}
            onSubmit={submitColumn}
            onCancel={closeAddColumn}
          />
        ) : null}

        {view === 'add-row' ? (
          <AddTableItemScreen
            keyName="add-row"
            screenVariants={activeScreenVariants}
            title="Add table row"
            fieldLabel="Time saved per task:"
            draft={rowDraft}
            inputId="row-input"
            inputRef={rowInputRef}
            cursorIndex={addRowCursorIndex}
            cancelRef={addRowCancelRef}
            errors={addRowErrors}
            examples={['10s', 'one minute', '5 min', '2h', 'five m', '...', 'etc']}
            menuOptionStaggerMs={MENU_OPTION_STAGGER_MS}
            autofocusView="add-row"
            onKeyDown={handleAddRowKeyDown}
            onDraftChange={setRowDraft}
            onSetCursorIndex={setAddRowCursorIndex}
            onSubmit={submitRow}
            onCancel={closeAddRow}
          />
        ) : null}
      </AnimatePresence>
    </main>
  )
}

function getOrderedFrequencyMenuColumns(columns: FrequencyColumn[]) {
  const enabledDefaultColumns = DEFAULT_COLUMNS.filter((defaultColumn) =>
    columns.some((column) => column.id === defaultColumn.id && !column.isCustom),
  )
  const customColumns = columns.filter((column) => column.isCustom)
  return [...enabledDefaultColumns, ...customColumns]
}

function getOrderedTimeMenuRows(rows: SavingsRow[]) {
  const enabledDefaultRows = DEFAULT_ROWS.filter((defaultRow) =>
    rows.some((row) => row.id === defaultRow.id && !row.isCustom),
  )
  const customRows = rows.filter((row) => row.isCustom)
  return [...enabledDefaultRows, ...customRows]
}
