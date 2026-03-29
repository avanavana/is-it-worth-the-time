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

export interface PersistedState {
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

export type View =
  | 'home'
  | 'table'
  | 'error-404'
  | 'error-403'
  | 'settings'
  | 'menu-frequency'
  | 'menu-time'
  | 'menu-lifetime'
  | 'menu-edit-columns'
  | 'menu-edit-rows'
  | 'add-menu-option'
  | 'add-column'
  | 'add-row'

export type BaseView = 'home' | 'table'
export type MenuCustomKind = 'frequency' | 'time' | 'lifetime'
export type TableEditMenuKind = 'columns' | 'rows'
export type NonSettingsView = Exclude<View, 'settings'>

export type NavigationUrlState = {
  view: View
  menuReturnView: BaseView
  settingsReturnView: NonSettingsView
  tableEditMenuKind: TableEditMenuKind
  menuCustomKind: MenuCustomKind
}

export interface SettingsOption {
  id: 'exact' | 'calendar' | 'theme' | 'keyboard' | 'reset'
  label: string
  value?: string
}

export type TableEditMenuItem =
  | { kind: 'default-row'; row: SavingsRow }
  | { kind: 'default-column'; column: FrequencyColumn }
  | { kind: 'custom-row'; row: SavingsRow }
  | { kind: 'custom-column'; column: FrequencyColumn }
  | { kind: 'new' }
  | { kind: 'cancel' }
