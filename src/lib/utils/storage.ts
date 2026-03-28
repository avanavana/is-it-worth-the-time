import { STORAGE_KEY } from '@/lib/constants/storage'
import { copyDefaults, DEFAULT_COLUMNS, DEFAULT_ROWS } from '@/lib/utils/defaults'
import { persistedStateSchema } from '@/lib/utils/validation'

import type { PersistedState } from '@/types'

const KEY_COMMANDS_VISIBILITY_MIGRATION_KEY = `${STORAGE_KEY}:key-commands-v2`

export function loadPersistedState(): PersistedState {
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

export function savePersistedState(state: PersistedState) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      // KC visibility is intentionally session-only to preserve initial-load behavior.
      autoHideKeyCommands: false,
    }),
  )
}

function normalizeState(state: PersistedState): PersistedState {
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
    // KC visibility is intentionally session-only to preserve initial-load behavior.
    autoHideKeyCommands: false,
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

  if (typeof window !== 'undefined') {
    const hasMigratedKeyCommands =
      window.localStorage.getItem(KEY_COMMANDS_VISIBILITY_MIGRATION_KEY) === '1'
    if (!hasMigratedKeyCommands) {
      migrated.autoHideKeyCommands = false
      window.localStorage.setItem(KEY_COMMANDS_VISIBILITY_MIGRATION_KEY, '1')
    }
  }

  return migrated
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
