import { STORAGE_KEY } from './constants'
import { copyDefaults, DEFAULT_COLUMNS, DEFAULT_ROWS } from './defaults'
import { persistedStateSchema } from './validation'

import type { PersistedAutomationROIState } from './types'

export function loadPersistedState(): PersistedAutomationROIState {
  if (typeof window === 'undefined') {
    return copyDefaults()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return copyDefaults()
    }

    const parsed = migratePersistedState(JSON.parse(raw) as unknown)
    const result = persistedStateSchema.safeParse(parsed)

    if (!result.success) {
      return copyDefaults()
    }

    return normalizeState(result.data)
  } catch {
    return copyDefaults()
  }
}

export function savePersistedState(state: PersistedAutomationROIState) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function normalizeState(state: PersistedAutomationROIState): PersistedAutomationROIState {
  const rowDefaults = new Map(DEFAULT_ROWS.map((row) => [row.id, row]))
  const columnDefaults = new Map(DEFAULT_COLUMNS.map((column) => [column.id, column]))

  const rows = state.rows.map((row) => {
    const preset = rowDefaults.get(row.id)

    if (!preset) {
      return row
    }

    return { ...preset }
  })

  const columns = state.columns.map((column) => {
    const preset = columnDefaults.get(column.id)

    if (!preset) {
      return column
    }

    return { ...preset }
  })

  return {
    ...state,
    rows,
    columns,
  }
}

function migratePersistedState(raw: unknown): unknown {
  if (!isRecord(raw)) {
    return raw
  }

  const migrated = { ...raw }
  if (
    !('autoHideKeyCommands' in migrated) &&
    'showKeyboardCommands' in migrated &&
    typeof migrated.showKeyboardCommands === 'boolean'
  ) {
    migrated.autoHideKeyCommands = migrated.showKeyboardCommands
  }

  return migrated
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
