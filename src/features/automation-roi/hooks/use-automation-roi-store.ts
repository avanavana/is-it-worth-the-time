import { create } from 'zustand'

import { getRunsPerYear } from '../calculations'
import { MAX_COLUMNS, MIN_COLUMNS, MIN_ROWS } from '../constants'
import { copyDefaults } from '../defaults'
import { loadPersistedState } from '../storage'
import type {
  CalendarBasis,
  CellDetails,
  DisplayMode,
  FrequencyColumn,
  PersistedAutomationROIState,
  SavingsRow,
} from '../types'

interface AutomationROIState extends PersistedAutomationROIState {
  selectedCell: CellDetails | null
  setSelectedCell: (details: CellDetails | null) => void
  setLifetimeYears: (value: number) => void
  setCalendarBasis: (value: CalendarBasis) => void
  setCustomDaysPerYear: (value: number) => void
  setDisplayMode: (value: DisplayMode) => void
  setSignificantDigits: (value: number) => void
  addCustomRow: (payload: Omit<SavingsRow, 'id' | 'isCustom'>) => void
  updateCustomRow: (id: string, payload: Omit<SavingsRow, 'id' | 'isCustom'>) => void
  deleteCustomRow: (id: string) => void
  addCustomColumn: (payload: Omit<FrequencyColumn, 'id' | 'isCustom'>) => void
  updateCustomColumn: (
    id: string,
    payload: Omit<FrequencyColumn, 'id' | 'isCustom'>,
  ) => void
  deleteCustomColumn: (id: string) => void
  resetDefaults: () => void
  getPersistedState: () => PersistedAutomationROIState
}

const bootState = loadPersistedState()

export const useAutomationROIStore = create<AutomationROIState>((set, get) => ({
  ...bootState,
  selectedCell: null,

  setSelectedCell: (details) => set({ selectedCell: details }),

  setLifetimeYears: (value) => set({ lifetimeYears: clamp(value, 0.1, 25) }),

  setCalendarBasis: (value) => set({ calendarBasis: value }),

  setCustomDaysPerYear: (value) => set({ customDaysPerYear: clamp(value, 1, 366) }),

  setDisplayMode: (value) => set({ displayMode: value }),

  setSignificantDigits: (value) => set({ significantDigits: clamp(value, 2, 8) }),

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

  updateCustomRow: (id, payload) =>
    set((state) => {
      const updatedRows = state.rows.map((row) =>
        row.id === id && row.isCustom
          ? {
              ...row,
              label: payload.label,
              seconds: payload.seconds,
            }
          : row,
      )

      return { rows: sortRows(updatedRows) }
    }),

  deleteCustomRow: (id) =>
    set((state) => {
      if (state.rows.length <= MIN_ROWS) {
        return {}
      }

      return {
        rows: state.rows.filter((row) => row.id !== id),
        selectedCell:
          state.selectedCell && state.selectedCell.rowId === id
            ? null
            : state.selectedCell,
      }
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

  updateCustomColumn: (id, payload) =>
    set((state) => {
      const updatedColumns = state.columns.map((column) =>
        column.id === id && column.isCustom
          ? {
              ...column,
              label: payload.label,
              amount: payload.amount,
              unit: payload.unit,
            }
          : column,
      )

      return {
        columns: sortColumns(updatedColumns, state.calendarBasis, state.customDaysPerYear),
      }
    }),

  deleteCustomColumn: (id) =>
    set((state) => {
      if (state.columns.length <= MIN_COLUMNS) {
        return {}
      }

      return {
        columns: state.columns.filter((column) => column.id !== id),
        selectedCell:
          state.selectedCell && state.selectedCell.columnId === id
            ? null
            : state.selectedCell,
      }
    }),

  resetDefaults: () => {
    const defaults = copyDefaults()
    set({ ...defaults, selectedCell: null })
  },

  getPersistedState: () => {
    const state = get()

    return {
      lifetimeYears: state.lifetimeYears,
      calendarBasis: state.calendarBasis,
      customDaysPerYear: state.customDaysPerYear,
      rows: state.rows,
      columns: state.columns,
      displayMode: state.displayMode,
      significantDigits: state.significantDigits,
    }
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
