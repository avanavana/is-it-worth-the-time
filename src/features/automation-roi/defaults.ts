import type { FrequencyColumn, PersistedAutomationROIState, SavingsRow } from './types'

export const DEFAULT_ROWS: SavingsRow[] = [
  { id: 'row-1-sec', label: '1 sec', seconds: 1, isCustom: false },
  { id: 'row-5-sec', label: '5 sec', seconds: 5, isCustom: false },
  { id: 'row-30-sec', label: '30 sec', seconds: 30, isCustom: false },
  { id: 'row-1-min', label: '1 min', seconds: 60, isCustom: false },
  { id: 'row-5-min', label: '5 min', seconds: 300, isCustom: false },
  { id: 'row-30-min', label: '30 min', seconds: 1800, isCustom: false },
  { id: 'row-1-hr', label: '1 hr', seconds: 3600, isCustom: false },
  { id: 'row-6-hr', label: '6 hr', seconds: 21600, isCustom: false },
  { id: 'row-1-day', label: '1 day', seconds: 86400, isCustom: false },
]

export const DEFAULT_COLUMNS: FrequencyColumn[] = [
  { id: 'col-50-day', label: '50/day', amount: 50, unit: 'day', isCustom: false },
  { id: 'col-5-day', label: '5/day', amount: 5, unit: 'day', isCustom: false },
  { id: 'col-daily', label: 'Daily', amount: 1, unit: 'day', isCustom: false },
  { id: 'col-weekly', label: 'Weekly', amount: 1, unit: 'week', isCustom: false },
  { id: 'col-monthly', label: 'Monthly', amount: 1, unit: 'month', isCustom: false },
  { id: 'col-yearly', label: 'Yearly', amount: 1, unit: 'year', isCustom: false },
]

export const LIFETIME_PRESETS_YEARS = [0.5, 1, 2, 3, 4, 5, 10, 15, 20, 25] as const

export const DEFAULT_STATE: PersistedAutomationROIState = {
  lifetimeYears: 5,
  calendarBasis: 'calendar',
  customDaysPerYear: 365,
  rows: DEFAULT_ROWS,
  columns: DEFAULT_COLUMNS,
  displayMode: 'humanized',
  significantDigits: 4,
  autoHideKeyCommands: true,
}

export function copyDefaults(): PersistedAutomationROIState {
  return {
    ...DEFAULT_STATE,
    rows: [...DEFAULT_ROWS],
    columns: [...DEFAULT_COLUMNS],
  }
}
