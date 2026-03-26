export type CalendarBasis = 'calendar' | 'workdays' | 'custom'

export type DisplayMode = 'humanized' | 'exact'

export type FrequencyUnit = 'day' | 'week' | 'month' | 'year'

export interface SavingsRow {
  id: string
  label: string
  seconds: number
  isCustom: boolean
}

export interface FrequencyColumn {
  id: string
  label: string
  amount: number
  unit: FrequencyUnit
  isCustom: boolean
}

export interface PersistedAutomationROIState {
  lifetimeYears: number
  calendarBasis: CalendarBasis
  customDaysPerYear: number
  rows: SavingsRow[]
  columns: FrequencyColumn[]
  displayMode: DisplayMode
  significantDigits: number
  autoHideKeyCommands: boolean
}

export interface CellDetails {
  rowId: string
  columnId: string
  rowLabel: string
  columnLabel: string
  secondsSavedPerRun: number
  runsPerYear: number
  lifetimeYears: number
  totalRuns: number
  totalSavedSeconds: number
}
