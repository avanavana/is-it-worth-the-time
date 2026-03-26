import {
  SECONDS_IN_DAY,
  SECONDS_IN_HOUR,
  SECONDS_IN_MINUTE,
  SECONDS_IN_MONTH,
  SECONDS_IN_WEEK,
  SECONDS_IN_YEAR,
} from './constants'
import type { CalendarBasis, CellDetails, FrequencyColumn, SavingsRow } from './types'

export function getDaysPerYear(basis: CalendarBasis, customDaysPerYear: number) {
  if (basis === 'workdays') {
    return 260
  }

  if (basis === 'custom') {
    return customDaysPerYear
  }

  return 365
}

export function getRunsPerYear(
  column: FrequencyColumn,
  basis: CalendarBasis,
  customDaysPerYear: number,
) {
  const daysPerYear = getDaysPerYear(basis, customDaysPerYear)

  switch (column.unit) {
    case 'day':
      return column.amount * daysPerYear
    case 'week':
      return column.amount * 52
    case 'month':
      return column.amount * 12
    case 'year':
      return column.amount
    default:
      return 0
  }
}

export function calculateBreakEvenSeconds(
  secondsSavedPerRun: number,
  runsPerYear: number,
  lifetimeYears: number,
) {
  return secondsSavedPerRun * runsPerYear * lifetimeYears
}

export function isImpossibleCell(
  secondsSavedPerRun: number,
  frequency: FrequencyColumn,
) {
  const periodSeconds =
    frequency.unit === 'day'
      ? SECONDS_IN_DAY
      : frequency.unit === 'week'
        ? SECONDS_IN_WEEK
        : frequency.unit === 'month'
          ? SECONDS_IN_MONTH
          : SECONDS_IN_YEAR

  const maxSavingsPerRun = periodSeconds / frequency.amount
  return secondsSavedPerRun >= maxSavingsPerRun
}

export function getCellDetails(
  row: SavingsRow,
  column: FrequencyColumn,
  lifetimeYears: number,
  basis: CalendarBasis,
  customDaysPerYear: number,
): CellDetails {
  const runsPerYear = getRunsPerYear(column, basis, customDaysPerYear)
  const totalRuns = runsPerYear * lifetimeYears
  const totalSavedSeconds = calculateBreakEvenSeconds(row.seconds, runsPerYear, lifetimeYears)

  return {
    rowId: row.id,
    columnId: column.id,
    rowLabel: row.label,
    columnLabel: column.label,
    secondsSavedPerRun: row.seconds,
    runsPerYear,
    lifetimeYears,
    totalRuns,
    totalSavedSeconds,
  }
}

export function formatDurationShort(seconds: number) {
  if (seconds < SECONDS_IN_MINUTE) {
    return `${Math.round(seconds)}s`
  }

  if (seconds < SECONDS_IN_HOUR) {
    return `${Math.round(seconds / SECONDS_IN_MINUTE)}m`
  }

  if (seconds < SECONDS_IN_DAY) {
    return `${Math.round(seconds / SECONDS_IN_HOUR)}h`
  }

  if (seconds < SECONDS_IN_WEEK) {
    return `${Math.round(seconds / SECONDS_IN_DAY)}d`
  }

  if (seconds < SECONDS_IN_MONTH) {
    return `${Math.round(seconds / SECONDS_IN_WEEK)}w`
  }

  if (seconds < SECONDS_IN_YEAR) {
    return `${Math.round(seconds / SECONDS_IN_MONTH)}mo`
  }

  return `${Math.round(seconds / SECONDS_IN_YEAR)}y`
}
