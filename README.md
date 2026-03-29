# Is It Worth the Time? (v2)

A Vite + React app inspired by xkcd [#1205](https://xkcd.com/1205/), redesigned as a terminal/CLI-style UI while remaining fully web-native.

The original app is here: [is-it-worth-the-time](https://github.com/avanavana/is-it-worth-the-time).

Core idea:

`break_even_time = time_saved_per_run × runs_per_year × task_lifetime_years`

## Highlights

- Terminal-inspired visual language built with Tailwind + React components (not ASCII layout).
- Keyboard-first interaction with a fake block cursor that tracks selected controls.
- Typewriter-style reveal animations, with reduced-motion fallbacks.
- `NumberFlow` for smooth numeric value transitions.
- URL-driven navigation so browser back/forward and refresh restore view context.
- Home and Table views stay in sync through shared app state.

## Views and Routes

Canonical routes used by the app:

- `/` home/focus view
- `/table` table view
- `/settings` settings
- `/404` not found fallback
- `/403` forbidden fallback
- `/frequency` frequency select menu
- `/savings` time-saved select menu
- `/period` period select menu
- `/table/period` period select menu from table view
- `/table/rows` edit table rows
- `/table/columns` edit table columns
- `/table/rows/add` add row
- `/table/columns/add` add column
- `/:menuId/add` add menu option from home menus
- `/table/:menuId/add` add menu option from table menus

Notes:

- `:menuId` is one of `frequency`, `savings`, `period`.
- Built-in back/cancel controls and keyboard shortcuts are first-class navigation paths; browser back/forward is also supported via URL state.

## Features

- Update calculation parameters from inline sentence controls (frequency, time saved, and period).
- Toggle the home result between approximate and exact display.
- Open a live table view that recomputes immediately as inputs change.
- Adjust period from the table sentence, slider, decrement/increment actions, or keyboard controls.
- Scroll the table on narrow layouts with both mouse and keyboard.
- Edit table rows/columns by toggling default entries on/off.
- Add custom rows/columns for time saved and task frequency.
- Remove custom rows/columns from either edit screens or select menus.
- Add custom options directly from select menus with plain-language input parsing.
- View tooltip details for both approximate and non-approximate table cells.
- Configure exact vs approximate display in Settings.
- Configure calendar basis mode in Settings.
- Configure theme (`System`, `Light`, `Dark`) in Settings.
- Configure key-command palette visibility in Settings.
- Reset to defaults when state differs from defaults.

## Keyboard Contract

Across cursor-driven screens:

- `Arrow keys` and `Tab` / `Shift+Tab` move selection.
- `Enter` / `Return` / `Space` activate selected controls.
- `Esc` performs back/cancel behavior for the current screen.

Context-specific controls:

- On slider/scroll controls, left/right arrows adjust the control instead of changing selection.
- `Cmd+K` (or `Ctrl+K`) toggles the key-commands palette when available.
- On initial load, the key-commands palette is shown briefly, then collapses to a `Show key commands` action.

## Accessibility

- Keyboard-first interaction is supported across all primary screens and controls.
- Interactive controls use semantic elements (`button`, `input`, labels) and explicit `aria-label` text where needed.
- Tooltip content is visual-only and non-blocking (`aria-hidden` for custom pointer-follow tooltip rendering).
- Motion respects reduced-motion preferences via motion-safe/reduced-motion paths.
- Cursor-driven interactions are designed to minimize layout shift and preserve focusability.

## Persistence

Persisted in `localStorage`:

- Lifetime years
- Calendar basis
- Rows and columns (including custom items)
- Display mode
- Significant digits

Session-only behavior:

- Key-command palette visibility is intentionally not persisted, to preserve initial-load intro behavior.

## Tech Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- Radix UI primitives (Slider, Tooltip) and shadcn-style component patterns
- Zustand
- Motion (`motion/react`)
- NumberFlow
- Zod

## Development

Install and run:

```bash
pnpm install
pnpm dev
```

Quality checks:

```bash
pnpm lint
pnpm build
```
