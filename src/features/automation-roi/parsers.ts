import type { FrequencyUnit } from './types'

const DURATION_UNITS: Record<string, { seconds: number; label: string }> = {
  s: { seconds: 1, label: 'sec' },
  sec: { seconds: 1, label: 'sec' },
  secs: { seconds: 1, label: 'sec' },
  second: { seconds: 1, label: 'sec' },
  seconds: { seconds: 1, label: 'sec' },
  m: { seconds: 60, label: 'min' },
  min: { seconds: 60, label: 'min' },
  mins: { seconds: 60, label: 'min' },
  minute: { seconds: 60, label: 'min' },
  minutes: { seconds: 60, label: 'min' },
  h: { seconds: 3600, label: 'hr' },
  hr: { seconds: 3600, label: 'hr' },
  hrs: { seconds: 3600, label: 'hr' },
  hour: { seconds: 3600, label: 'hr' },
  hours: { seconds: 3600, label: 'hr' },
  d: { seconds: 86400, label: 'day' },
  day: { seconds: 86400, label: 'day' },
  days: { seconds: 86400, label: 'day' },
  w: { seconds: 86400 * 7, label: 'week' },
  wk: { seconds: 86400 * 7, label: 'week' },
  wks: { seconds: 86400 * 7, label: 'week' },
  week: { seconds: 86400 * 7, label: 'week' },
  weeks: { seconds: 86400 * 7, label: 'week' },
  mo: { seconds: 86400 * (365 / 12), label: 'mo' },
  mon: { seconds: 86400 * (365 / 12), label: 'mo' },
  month: { seconds: 86400 * (365 / 12), label: 'mo' },
  months: { seconds: 86400 * (365 / 12), label: 'mo' },
  y: { seconds: 86400 * 365, label: 'yr' },
  yr: { seconds: 86400 * 365, label: 'yr' },
  yrs: { seconds: 86400 * 365, label: 'yr' },
  year: { seconds: 86400 * 365, label: 'yr' },
  years: { seconds: 86400 * 365, label: 'yr' },
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

const FREQUENCY_UNITS: Record<string, FrequencyUnit> = {
  d: 'day',
  day: 'day',
  days: 'day',
  w: 'week',
  wk: 'week',
  wks: 'week',
  week: 'week',
  weeks: 'week',
  m: 'month',
  mo: 'month',
  mon: 'month',
  month: 'month',
  months: 'month',
  y: 'year',
  yr: 'year',
  yrs: 'year',
  year: 'year',
  years: 'year',
}

export function parseTimeSavedInput(raw: string) {
  const parsed = parseDurationInput(raw, 'minute')

  if (!parsed.ok) {
    return parsed
  }

  return {
    ok: true as const,
    seconds: parsed.seconds,
    label: parsed.label,
  }
}

export function parseFrequencyInput(raw: string) {
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'daily') {
    return { ok: true as const, amount: 1, unit: 'day' as const, label: 'Daily' }
  }

  if (normalized === 'weekly') {
    return { ok: true as const, amount: 1, unit: 'week' as const, label: 'Weekly' }
  }

  if (normalized === 'monthly') {
    return { ok: true as const, amount: 1, unit: 'month' as const, label: 'Monthly' }
  }

  if (normalized === 'yearly') {
    return { ok: true as const, amount: 1, unit: 'year' as const, label: 'Yearly' }
  }

  if (normalized === 'biweekly') {
    return { ok: true as const, amount: 0.5, unit: 'week' as const, label: 'Biweekly' }
  }

  const numberOnlyMatch = normalized.match(/^(\d*\.?\d+)$/)
  if (numberOnlyMatch) {
    const amount = Number.parseFloat(numberOnlyMatch[1])
    if (Number.isFinite(amount) && amount > 0) {
      return {
        ok: true as const,
        amount,
        unit: 'day' as const,
        label: `${stripTrailingZeros(amount)}/day`,
      }
    }
  }

  const slashMatch = normalized.match(
    /^(\d*\.?\d+)\s*(x|×)?\s*\/\s*(d|day|days|w|wk|wks|week|weeks|m|mo|mon|month|months|y|yr|yrs|year|years)$/,
  )
  const wordsMatch = normalized.match(
    /^(\d*\.?\d+)\s*(x|×|times?)?\s*(a|per)?\s*(d|day|days|w|wk|wks|week|weeks|m|mo|mon|month|months|y|yr|yrs|year|years)$/,
  )
  const match = slashMatch ?? wordsMatch

  if (!match) {
    return { ok: false as const, error: 'Use a format like 3/day, 2/week, 10/month, 200/year.' }
  }

  const amount = Number.parseFloat(match[1])
  const unit = FREQUENCY_UNITS[match[match.length - 1]]

  if (!Number.isFinite(amount) || amount <= 0 || !unit) {
    return { ok: false as const, error: 'Could not parse that frequency value.' }
  }

  return {
    ok: true as const,
    amount,
    unit,
    label: `${stripTrailingZeros(amount)}/${unit}`,
  }
}

type DurationDefaultUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export function parseDurationInput(raw: string, defaultUnit: DurationDefaultUnit) {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/\bperiod\b/g, '')
    .trim()
  const match = normalized.match(/^([a-z-]+|\d*\.?\d+)\s*([a-z]+)?$/)

  if (!match) {
    return { ok: false as const, error: 'Use a format like 2m, 3h, 4 days, or 1 year.' }
  }

  const amount = parseNumberish(match[1])
  const unitKey = (match[2] ?? defaultUnit).toLowerCase()
  const unit = DURATION_UNITS[unitKey]

  if (!Number.isFinite(amount) || amount <= 0 || !unit) {
    return { ok: false as const, error: 'Could not parse that duration.' }
  }

  return {
    ok: true as const,
    amount,
    seconds: amount * unit.seconds,
    unitLabel: unit.label,
    label: `${stripTrailingZeros(amount)} ${unit.label}`,
  }
}

function parseNumberish(raw: string) {
  const token = raw.trim().toLowerCase()
  const numeric = Number.parseFloat(token)

  if (Number.isFinite(numeric)) {
    return numeric
  }

  if (NUMBER_WORDS[token] !== undefined) {
    return NUMBER_WORDS[token]
  }

  return Number.NaN
}

function stripTrailingZeros(value: number) {
  return Number.parseFloat(value.toFixed(4)).toString()
}
