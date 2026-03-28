import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { DEFAULT_STATE, LIFETIME_PRESETS_YEARS } from '@/lib/utils/defaults'
import type { CalendarBasis, FrequencyColumn } from '@/types'
import type { CompactCellDisplay } from '@/lib/utils/formatters'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function focusLifetimeYearsRounded(value: number) {
  return Number.parseFloat(value.toFixed(2))
}

export function formatLifetimePeriod(value: number) {
  if (value < 1) {
    const months = value * 12
    return `${strip(months)}-month`
  }

  return `${strip(value)}-year`
}

export function formatLifetimeLong(value: number) {
  if (value < 1) {
    const months = value * 12
    return `${strip(months)} ${months === 1 ? 'month' : 'months'}`
  }

  return `${strip(value)} ${value === 1 ? 'year' : 'years'}`
}

export function formatLifetimeShort(value: number) {
  if (value < 1) {
    return `${strip(value * 12)}mo`
  }

  return `${strip(value)}y`
}

export function formatFrequencyLong(value: FrequencyColumn) {
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

export function formatLongDuration(seconds: number) {
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

export function getClosestLifetimePresetIndex(value: number) {
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

export function strip(value: number) {
  return Number.parseFloat(value.toFixed(4)).toString()
}

export function formatResultNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

export function formatFocusApproxText(result: CompactCellDisplay, basis: CalendarBasis) {
  const prefix = result.approx ? '~' : ''
  const numeric = formatResultNumber(result.value)
  return `${prefix}${numeric} ${getFocusApproxUnitLabel(result, basis)}`
}

export function getFocusApproxUnitLabel(result: CompactCellDisplay, basis: CalendarBasis) {
  const fullUnit = expandApproxUnit(result.unit, result.value)

  if (basis !== 'workdays') {
    return fullUnit
  }

  const lowerUnit = result.unit.toLowerCase()

  if (lowerUnit === 'day' || lowerUnit === 'days') {
    return Math.abs(result.value) === 1 ? 'workday' : 'workdays'
  }

  if (lowerUnit === 'week' || lowerUnit === 'weeks') {
    return Math.abs(result.value) === 1 ? 'workweek' : 'workweeks'
  }

  return fullUnit
}

export function expandApproxUnit(unit: string, value: number) {
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

export function getFlowStepCount(text: string) {
  return text.split(/(\s+)/).filter((token) => token && !/^\s+$/.test(token)).length
}

export function isActivationKey(key: string) {
  return key === 'Enter' || key === ' ' || key === 'Spacebar'
}

export function clampIndex(index: number, length: number) {
  if (length <= 0) {
    return 0
  }

  return Math.max(0, Math.min(index, length - 1))
}

export function remapTableCursorIndexForResetSlot(
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

export function valuesNearlyEqual(a: number, b: number) {
  return Math.abs(a - b) < 0.0001
}

export function isDefaultState(state: {
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
