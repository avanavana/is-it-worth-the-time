import {
  SECONDS_IN_DAY,
  SECONDS_IN_HOUR,
  SECONDS_IN_MINUTE,
  SECONDS_IN_MONTH,
  SECONDS_IN_WEEK,
  SECONDS_IN_YEAR,
} from './constants'
import type { DisplayMode } from './types'

const exactUnitOrder = [
  { key: 's', long: 'seconds', seconds: 1 },
  { key: 'm', long: 'minutes', seconds: SECONDS_IN_MINUTE },
  { key: 'h', long: 'hours', seconds: SECONDS_IN_HOUR },
  { key: 'd', long: 'days', seconds: SECONDS_IN_DAY },
  { key: 'w', long: 'weeks', seconds: SECONDS_IN_WEEK },
  { key: 'mo', long: 'months', seconds: SECONDS_IN_MONTH },
  { key: 'y', long: 'years', seconds: SECONDS_IN_YEAR },
] as const

interface TimeToken {
  value: number
  unit: string
}

export interface TableTimeFormat {
  tokens: TimeToken[]
  ariaLabel: string
}

export interface CompactCellDisplay {
  value: number
  unit: string
  approx: boolean
}

export function formatForTable(
  seconds: number,
  mode: DisplayMode,
  significantDigits: number,
): TableTimeFormat {
  if (mode === 'exact') {
    const exact = formatExact(seconds, significantDigits)
    return {
      tokens: [{ value: exact.value, unit: exact.unitShort }],
      ariaLabel: `${exact.valueText} ${exact.unitLong}`,
    }
  }

  const human = formatHumanized(seconds)
  return {
    tokens: human.tokens,
    ariaLabel: human.readable,
  }
}

export function formatExactText(seconds: number, significantDigits: number) {
  const exact = formatExact(seconds, significantDigits)
  return `${exact.valueText} ${exact.unitLong}`
}

export function formatHumanizedText(seconds: number) {
  return formatHumanized(seconds).readable
}

export function formatCompactCellDisplay(seconds: number): CompactCellDisplay {
  const selected = pickUnit(seconds)
  const raw = seconds / selected.seconds
  const roundedQuarter = Math.round(raw * 4) / 4
  const roundedWhole = Math.round(raw)

  const isWhole = nearlyEqual(raw, Math.round(raw))
  const isQuarter = nearlyEqual(raw, roundedQuarter)

  if (isWhole) {
    const value = Math.round(raw)
    return {
      value,
      unit: shortUnitLabel(selected.key, value),
      approx: false,
    }
  }

  if (isQuarter) {
    return {
      value: roundedQuarter,
      unit: shortUnitLabel(selected.key, roundedQuarter),
      approx: false,
    }
  }

  return {
    value: roundedWhole,
    unit: shortUnitLabel(selected.key, roundedWhole),
    approx: true,
  }
}

export function formatPreciseTooltipText(seconds: number): string {
  if (seconds < SECONDS_IN_MINUTE) {
    return `${Math.round(seconds)} sec`
  }

  const selected = pickUnit(seconds)
  const primaryValue = Math.floor(seconds / selected.seconds)
  const remainder = seconds - primaryValue * selected.seconds

  if (remainder <= 0 || primaryValue <= 0) {
    const fallback = seconds / selected.seconds
    return `${trim(fallback)} ${shortUnitLabel(selected.key, fallback)}`
  }

  const secondary = nextSmallerUnit(selected.key)
  if (!secondary) {
    return `${trim(primaryValue)} ${shortUnitLabel(selected.key, primaryValue)}`
  }

  const rawSecondaryValue = remainder / secondary.seconds
  const secondaryValue = nearlyEqual(rawSecondaryValue, Math.round(rawSecondaryValue))
    ? Math.round(rawSecondaryValue)
    : Number.parseFloat(rawSecondaryValue.toFixed(2))

  if (secondaryValue <= 0) {
    return `${trim(primaryValue)} ${shortUnitLabel(selected.key, primaryValue)}`
  }

  return `${trim(primaryValue)} ${shortUnitLabel(selected.key, primaryValue)}, ${trim(secondaryValue)} ${shortUnitLabel(secondary.key, secondaryValue)}`
}

export function formatExactDaysTooltipText(seconds: number): string {
  const days = seconds / SECONDS_IN_DAY
  return `${trim(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`
}

export function formatInspectorSeconds(seconds: number) {
  if (seconds < SECONDS_IN_MINUTE) {
    return `${roundTo(seconds, 2)} seconds`
  }

  if (seconds < SECONDS_IN_HOUR) {
    return `${roundTo(seconds / SECONDS_IN_MINUTE, 2)} minutes`
  }

  if (seconds < SECONDS_IN_DAY) {
    return `${roundTo(seconds / SECONDS_IN_HOUR, 2)} hours`
  }

  if (seconds < SECONDS_IN_WEEK) {
    return `${roundTo(seconds / SECONDS_IN_DAY, 2)} days`
  }

  if (seconds < SECONDS_IN_MONTH) {
    return `${roundTo(seconds / SECONDS_IN_WEEK, 2)} weeks`
  }

  if (seconds < SECONDS_IN_YEAR) {
    return `${roundTo(seconds / SECONDS_IN_MONTH, 2)} months`
  }

  return `${roundTo(seconds / SECONDS_IN_YEAR, 2)} years`
}

function formatExact(seconds: number, significantDigits: number) {
  const selected = pickUnit(seconds)
  const value = seconds / selected.seconds
  const formatter = new Intl.NumberFormat('en-US', {
    maximumSignificantDigits: significantDigits,
  })

  return {
    value,
    valueText: formatter.format(value),
    unitShort: selected.key,
    unitLong: selected.long,
  }
}

function formatHumanized(seconds: number) {
  if (seconds < SECONDS_IN_MINUTE) {
    const rounded = Math.round(seconds)
    return {
      tokens: [{ value: rounded, unit: 's' }],
      readable: `${rounded} seconds`,
    }
  }

  if (seconds < SECONDS_IN_HOUR) {
    const rounded = Math.round(seconds / SECONDS_IN_MINUTE)
    return {
      tokens: [{ value: rounded, unit: 'm' }],
      readable: `${rounded} minutes`,
    }
  }

  if (seconds < SECONDS_IN_DAY) {
    return splitUnit(seconds, SECONDS_IN_HOUR, 'h', SECONDS_IN_MINUTE, 'm', 'hours', 'minutes')
  }

  if (seconds < 14 * SECONDS_IN_DAY) {
    return splitUnit(seconds, SECONDS_IN_DAY, 'd', SECONDS_IN_HOUR, 'h', 'days', 'hours')
  }

  if (seconds < 8 * SECONDS_IN_WEEK) {
    return splitUnit(seconds, SECONDS_IN_WEEK, 'w', SECONDS_IN_DAY, 'd', 'weeks', 'days')
  }

  if (seconds < 24 * SECONDS_IN_MONTH) {
    return splitUnit(seconds, SECONDS_IN_MONTH, 'mo', SECONDS_IN_DAY, 'd', 'months', 'days')
  }

  return splitUnit(seconds, SECONDS_IN_YEAR, 'y', SECONDS_IN_MONTH, 'mo', 'years', 'months')
}

function splitUnit(
  seconds: number,
  primarySeconds: number,
  primaryShort: string,
  secondarySeconds: number,
  secondaryShort: string,
  primaryLong: string,
  secondaryLong: string,
) {
  let primary = Math.floor(seconds / primarySeconds)
  let secondary = Math.round((seconds - primary * primarySeconds) / secondarySeconds)

  if (secondary >= Math.round(primarySeconds / secondarySeconds)) {
    primary += 1
    secondary = 0
  }

  if (primary === 0 && secondary > 0) {
    return {
      tokens: [{ value: secondary, unit: secondaryShort }],
      readable: `${secondary} ${secondaryLong}`,
    }
  }

  const tokens = secondary > 0
    ? [
        { value: primary, unit: primaryShort },
        { value: secondary, unit: secondaryShort },
      ]
    : [{ value: primary, unit: primaryShort }]

  const readable =
    secondary > 0
      ? `${primary} ${primaryLong} ${secondary} ${secondaryLong}`
      : `${primary} ${primaryLong}`

  return {
    tokens,
    readable,
  }
}

function pickUnit(seconds: number) {
  if (seconds < SECONDS_IN_MINUTE) {
    return exactUnitOrder[0]
  }

  if (seconds < SECONDS_IN_HOUR) {
    return exactUnitOrder[1]
  }

  if (seconds < SECONDS_IN_DAY) {
    return exactUnitOrder[2]
  }

  if (seconds < 14 * SECONDS_IN_DAY) {
    return exactUnitOrder[3]
  }

  if (seconds < 8 * SECONDS_IN_WEEK) {
    return exactUnitOrder[4]
  }

  if (seconds < 24 * SECONDS_IN_MONTH) {
    return exactUnitOrder[5]
  }

  return exactUnitOrder[6]
}

function roundTo(value: number, maxDecimals: number) {
  return Number.parseFloat(value.toFixed(maxDecimals)).toString()
}

function shortUnitLabel(unitKey: string, value: number) {
  const singular = Math.abs(value) === 1

  switch (unitKey) {
    case 's':
      return 'sec'
    case 'm':
      return 'min'
    case 'h':
      return singular ? 'hr' : 'hrs'
    case 'd':
      return singular ? 'day' : 'days'
    case 'w':
      return singular ? 'week' : 'weeks'
    case 'mo':
      return 'mo'
    case 'y':
      return singular ? 'yr' : 'yrs'
    default:
      return unitKey
  }
}

function nextSmallerUnit(unitKey: string) {
  switch (unitKey) {
    case 'm':
      return { key: 's', seconds: 1 }
    case 'h':
      return { key: 'm', seconds: SECONDS_IN_MINUTE }
    case 'd':
      return { key: 'h', seconds: SECONDS_IN_HOUR }
    case 'w':
      return { key: 'd', seconds: SECONDS_IN_DAY }
    case 'mo':
      return { key: 'd', seconds: SECONDS_IN_DAY }
    case 'y':
      return { key: 'mo', seconds: SECONDS_IN_MONTH }
    default:
      return null
  }
}

function nearlyEqual(a: number, b: number) {
  return Math.abs(a - b) < 0.02
}

function trim(value: number) {
  return Number.parseFloat(value.toFixed(2)).toString()
}
