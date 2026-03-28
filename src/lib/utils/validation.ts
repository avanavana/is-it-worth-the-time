import { z } from 'zod'

import { MAX_COLUMNS, MIN_COLUMNS, MIN_ROWS } from '@/lib/constants/limits'

const rowSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  seconds: z.number().positive(),
  isCustom: z.boolean(),
})

const columnSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: z.number().positive(),
  unit: z.enum(['day', 'week', 'month', 'year']),
  isCustom: z.boolean(),
})

export const persistedStateSchema = z.object({
  lifetimeYears: z.number().min(0.1).max(25),
  calendarBasis: z.enum(['calendar', 'workdays', 'custom']),
  customDaysPerYear: z.number().min(1).max(366),
  rows: z.array(rowSchema).min(MIN_ROWS),
  columns: z.array(columnSchema).min(MIN_COLUMNS).max(MAX_COLUMNS),
  displayMode: z.enum(['humanized', 'exact']),
  significantDigits: z.number().int().min(2).max(8),
  autoHideKeyCommands: z.boolean().default(false),
})
