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
- `/home/frequency` frequency select menu
- `/home/savings` time-saved select menu
- `/home/period` period select menu
- `/table/period` period select menu from table view
- `/table/rows` edit table rows
- `/table/columns` edit table columns
- `/table/rows/add` add row
- `/table/columns/add` add column
- `/home/:menuId/add` add menu option from home menus
- `/table/:menuId/add` add menu option from table menus

Notes:

- `:menuId` is one of `frequency`, `savings`, `period`.
- Browser back/forward is the primary return path between screens.

## Screen Behavior

### Home

- Sentence-style inline selectors for task frequency, time saved each time, and evaluation period.
- Result can be toggled (click/enter/space) between approximate and exact display.
- `Show full table` opens the table view.
- `Reset to defaults` appears whenever current state differs from defaults.

### Table

- Back action to return home.
- Inline period selector in the sentence above the table.
- Discrete lifetime slider (mouse + keyboard).
- Table can horizontally scroll on narrower screens.
- Cell tooltips show exact values for approximate cells.
- Cell tooltips show equivalent conversions for non-approximate cells.
- Legend contains row/column edit actions and impossible-cell hatch key.

### Select Menus

- Used by inline selectors on Home/Table.
- Show enabled default items plus any custom items.
- Current selected value is marked with `(current)`.
- `New option…` opens an add-option screen.
- Custom frequency/time items can be removed directly from these menus.

### Add Option

- Opened from `New option…`.
- Inline terminal-style input with parser examples.
- `Enter` submits.
- `Cancel` returns without changes.

### Edit Table Rows / Columns

- Toggle built-in rows/columns on or off.
- Add custom rows/columns.
- Remove custom rows/columns.
- Bottom action label switches from `Cancel` to `Back` after interaction.

### Settings

- Show exact values toggle.
- Calendar basis toggle (`24-hour day / 7-day week / 365-day year` vs `8-hour workday / 5-day workweek / 260-day work year`).
- Theme cycle (`System` / `Light` / `Dark`).
- Show key commands toggle.
- Reset to defaults action (shown only when applicable).

## Keyboard Contract

Across cursor-driven screens:

- `Arrow keys` and `Tab` / `Shift+Tab` move selection.
- `Enter` / `Return` / `Space` activate selected controls.
- `Esc` performs back/cancel behavior for the current screen.

Context-specific controls:

- On slider/scroll controls, left/right arrows adjust the control instead of changing selection.
- `Cmd+K` (or `Ctrl+K`) toggles the key-commands palette when available.
- On initial load, the key-commands palette is shown briefly, then collapses to a `Show key commands` action.

## Custom Option Model

- Custom frequency and time-saved options become real table columns/rows.
- Because they are part of table state, they are visible across Home/Table/select/edit screens.
- Custom items are removable from both select menus and edit menus.
- If the currently selected custom option is removed, selection falls back to app defaults (`5 times a day` for frequency, `1 minute` for time saved).

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
- Sonner

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
