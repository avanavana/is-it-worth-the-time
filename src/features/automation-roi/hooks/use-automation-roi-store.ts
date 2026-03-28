import { create } from 'zustand'

import { getRunsPerYear } from '../calculations'
import { MAX_COLUMNS, MIN_COLUMNS, MIN_ROWS } from '../constants'
import { copyDefaults, DEFAULT_COLUMNS, DEFAULT_ROWS } from '../defaults'
import { loadPersistedState } from '../storage'
import type {
  CalendarBasis,
  DisplayMode,
  FrequencyColumn,
  PersistedAutomationROIState,
  SavingsRow,
} from '../types'

interface AutomationROIState extends PersistedAutomationROIState {
  setLifetimeYears: (value: number) => void
  setCalendarBasis: (value: CalendarBasis) => void
  setDisplayMode: (value: DisplayMode) => void
  setAutoHideKeyCommands: (value: boolean) => void
  addCustomRow: (payload: Omit<SavingsRow, 'id' | 'isCustom'>) => void
  deleteCustomRow: (id: string) => void
  toggleDefaultRow: (id: string) => void
  addCustomColumn: (payload: Omit<FrequencyColumn, 'id' | 'isCustom'>) => void
  deleteCustomColumn: (id: string) => void
  toggleDefaultColumn: (id: string) => void
  resetDefaults: () => void
}

const bootState = loadPersistedState()

export const useAutomationROIStore = create<AutomationROIState>((set) => ({
  ...bootState,

  setLifetimeYears: (value) =>
    set((state) => {
      const nextLifetimeYears = clamp(value, 0.1, 25)
      return state.lifetimeYears === nextLifetimeYears
        ? state
        : { lifetimeYears: nextLifetimeYears }
    }),

  setCalendarBasis: (value) =>
    set((state) => (state.calendarBasis === value ? state : { calendarBasis: value })),

  setDisplayMode: (value) =>
    set((state) => (state.displayMode === value ? state : { displayMode: value })),

  setAutoHideKeyCommands: (value) =>
    set((state) =>
      state.autoHideKeyCommands === value ? state : { autoHideKeyCommands: value },
    ),

  addCustomRow: (payload) =>
    set((state) => {
      const nextRows = sortRows([
        ...state.rows,
        {
          id: newId('row'),
          label: payload.label,
          seconds: payload.seconds,
          isCustom: true,
        },
      ])

      return { rows: nextRows }
    }),

  deleteCustomRow: (id) =>
    set((state) => {
      if (state.rows.length <= MIN_ROWS) {
        return {}
      }

      return {
        rows: state.rows.filter((row) => row.id !== id),
      }
    }),

  toggleDefaultRow: (id) =>
    set((state) => {
      const preset = DEFAULT_ROWS.find((row) => row.id === id)
      if (!preset) {
        return state
      }

      const isEnabled = state.rows.some((row) => row.id === id && !row.isCustom)
      if (isEnabled) {
        const nextRows = state.rows.filter((row) => row.id !== id)
        if (nextRows.length < MIN_ROWS) {
          return state
        }

        return { rows: nextRows }
      }

      return { rows: sortRows([...state.rows, { ...preset }]) }
    }),

  addCustomColumn: (payload) =>
    set((state) => {
      if (state.columns.length >= MAX_COLUMNS) {
        return {}
      }

      const nextColumns = sortColumns(
        [
          ...state.columns,
          {
            id: newId('col'),
            label: payload.label,
            amount: payload.amount,
            unit: payload.unit,
            isCustom: true,
          },
        ],
        state.calendarBasis,
        state.customDaysPerYear,
      )

      return { columns: nextColumns }
    }),

  deleteCustomColumn: (id) =>
    set((state) => {
      if (state.columns.length <= MIN_COLUMNS) {
        return {}
      }

      return {
        columns: state.columns.filter((column) => column.id !== id),
      }
    }),

  toggleDefaultColumn: (id) =>
    set((state) => {
      const preset = DEFAULT_COLUMNS.find((column) => column.id === id)
      if (!preset) {
        return state
      }

      const isEnabled = state.columns.some(
        (column) => column.id === id && !column.isCustom,
      )
      if (isEnabled) {
        const nextColumns = state.columns.filter((column) => column.id !== id)
        if (nextColumns.length < MIN_COLUMNS) {
          return state
        }

        return { columns: nextColumns }
      }

      return {
        columns: sortColumns(
          [...state.columns, { ...preset }],
          state.calendarBasis,
          state.customDaysPerYear,
        ),
      }
    }),

  resetDefaults: () => {
    const defaults = copyDefaults()
    set({ ...defaults })
  },
}))

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sortRows(rows: SavingsRow[]) {
  return [...rows].sort((a, b) => a.seconds - b.seconds)
}

function sortColumns(
  columns: FrequencyColumn[],
  basis: CalendarBasis,
  customDaysPerYear: number,
) {
  return [...columns].sort((a, b) => {
    const runsA = getRunsPerYear(a, basis, customDaysPerYear)
    const runsB = getRunsPerYear(b, basis, customDaysPerYear)

    return runsB - runsA
  })
}
