import {
  MENU_ID_FREQUENCY,
  MENU_ID_PERIOD,
  MENU_ID_SAVINGS,
  NAVIGATION_HISTORY_STATE_KEY,
} from '@/lib/constants/navigation'
import type {
  BaseView,
  MenuCustomKind,
  NavigationUrlState,
  View,
} from '@/types'

export function parseNavigationStateFromPath(pathname: string): NavigationUrlState {
  const segments = pathname.split('/').filter(Boolean)
  const state: NavigationUrlState = {
    view: 'home',
    menuReturnView: 'home',
    settingsReturnView: 'home',
    tableEditMenuKind: 'columns',
    menuCustomKind: 'frequency',
  }

  const first = segments[0]
  const second = segments[1]
  const third = segments[2]
  const fourth = segments[3]

  if (!first) {
    return state
  }

  if (first === '403') {
    state.view = 'error-403'
    return state
  }

  if (first === '404') {
    state.view = 'error-404'
    return state
  }

  if (first === 'settings') {
    state.view = segments.length === 1 ? 'settings' : 'error-404'
    return state
  }

  if (first === 'table') {
    const baseView: BaseView = 'table'
    state.menuReturnView = baseView
    state.settingsReturnView = baseView

    if (!second) {
      state.view = baseView
      return state
    }

    if (second === 'settings') {
      state.view = !third ? 'settings' : 'error-404'
      return state
    }

    if (baseView === 'table' && second === 'rows') {
      state.tableEditMenuKind = 'rows'
      if (!third) {
        state.view = 'menu-edit-rows'
      } else if (third === 'add' && !fourth) {
        state.view = 'add-row'
      } else {
        state.view = 'error-404'
      }
      return state
    }

    if (baseView === 'table' && second === 'columns') {
      state.tableEditMenuKind = 'columns'
      if (!third) {
        state.view = 'menu-edit-columns'
      } else if (third === 'add' && !fourth) {
        state.view = 'add-column'
      } else {
        state.view = 'error-404'
      }
      return state
    }

    if (isMenuId(second)) {
      state.menuCustomKind = menuCustomKindFromMenuId(second)
      if (!third) {
        state.view = menuViewFromMenuId(second)
      } else if (third === 'add' && !fourth) {
        state.view = 'add-menu-option'
      } else {
        state.view = 'error-404'
      }
      return state
    }

    state.view = 'error-404'
    return state
  }

  if (isMenuId(first)) {
    state.menuReturnView = 'home'
    state.menuCustomKind = menuCustomKindFromMenuId(first)
    if (!second) {
      state.view = menuViewFromMenuId(first)
    } else if (second === 'add' && !third) {
      state.view = 'add-menu-option'
    } else {
      state.view = 'error-404'
    }
    return state
  }

  state.view = 'error-404'
  return state
}

export function buildNavigationPath(state: NavigationUrlState) {
  if (state.view === 'home') {
    return '/'
  }

  if (state.view === 'table') {
    return '/table'
  }

  if (state.view === 'error-404') {
    return '/404'
  }

  if (state.view === 'error-403') {
    return '/403'
  }

  if (state.view === 'settings') {
    return '/settings'
  }

  if (state.view === 'menu-frequency') {
    return `${menuBasePathFromReturnView(state.menuReturnView)}/${MENU_ID_FREQUENCY}`
  }

  if (state.view === 'menu-time') {
    return `${menuBasePathFromReturnView(state.menuReturnView)}/${MENU_ID_SAVINGS}`
  }

  if (state.view === 'menu-lifetime') {
    return `${menuBasePathFromReturnView(state.menuReturnView)}/${MENU_ID_PERIOD}`
  }

  if (state.view === 'add-menu-option') {
    return `${menuBasePathFromReturnView(state.menuReturnView)}/${menuIdFromMenuCustomKind(state.menuCustomKind)}/add`
  }

  if (state.view === 'menu-edit-rows') {
    return '/table/rows'
  }

  if (state.view === 'menu-edit-columns') {
    return '/table/columns'
  }

  if (state.view === 'add-row') {
    return '/table/rows/add'
  }

  return '/table/columns/add'
}

export function writeNavigationPathToUrl(
  nextPath: string,
  mode: 'push' | 'replace',
  navigationIndex: number,
) {
  const params = new URLSearchParams(window.location.search)
  params.delete('v')
  params.delete('mr')
  params.delete('sr')
  params.delete('tk')
  params.delete('mk')
  const nextSearch = params.toString()
  const nextUrl = `${nextPath}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
  const currentState =
    typeof window.history.state === 'object' && window.history.state !== null
      ? (window.history.state as Record<string, unknown>)
      : {}
  const nextState: Record<string, unknown> = {
    ...currentState,
    [NAVIGATION_HISTORY_STATE_KEY]: navigationIndex,
  }
  if (mode === 'push') {
    window.history.pushState(nextState, '', nextUrl)
  } else {
    window.history.replaceState(nextState, '', nextUrl)
  }

  return nextPath
}

export function getNavigationHistoryIndex(state: unknown) {
  if (typeof state !== 'object' || state === null) {
    return 0
  }

  const candidate = (state as Record<string, unknown>)[NAVIGATION_HISTORY_STATE_KEY]
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0
    ? Math.floor(candidate)
    : 0
}

function isMenuId(value: string | undefined): value is 'frequency' | 'savings' | 'period' {
  return (
    value === MENU_ID_FREQUENCY ||
    value === MENU_ID_SAVINGS ||
    value === MENU_ID_PERIOD
  )
}

function menuCustomKindFromMenuId(menuId: 'frequency' | 'savings' | 'period'): MenuCustomKind {
  if (menuId === MENU_ID_FREQUENCY) {
    return 'frequency'
  }

  if (menuId === MENU_ID_SAVINGS) {
    return 'time'
  }

  return 'lifetime'
}

function menuIdFromMenuCustomKind(kind: MenuCustomKind) {
  if (kind === 'frequency') {
    return MENU_ID_FREQUENCY
  }

  if (kind === 'time') {
    return MENU_ID_SAVINGS
  }

  return MENU_ID_PERIOD
}

function menuViewFromMenuId(menuId: 'frequency' | 'savings' | 'period'): View {
  if (menuId === MENU_ID_FREQUENCY) {
    return 'menu-frequency'
  }

  if (menuId === MENU_ID_SAVINGS) {
    return 'menu-time'
  }

  return 'menu-lifetime'
}

function menuBasePathFromReturnView(view: BaseView) {
  return view === 'table' ? '/table' : ''
}
