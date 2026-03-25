# Is It Worth the Time? (v2)

A Vite + React app inspired by xkcd [#1205](https://xkcd.com/1205/), redesigned with a CLI/TUI-inspired interface while staying fully web-native.

The original version of this app is available at [is-it-worth-the-time](https://github.com/avanavana/is-it-worth-the-time).

This project keeps the original calculator goal:

`break_even_time = time_saved_per_run × runs_per_year × task_lifetime_years`

and wraps it in a keyboard-first, terminal-style UX.

## What's new in v2

- Terminal-inspired design—looks like ASCII but is implemented with CSS, Tailwind, and shadcn/ui primitives.
- Block cursor indicates the currently selected interactive item.
- Underlined text indicates links or interactive elements.
- Interaction is screen-based (Home, Table, Select Menu, Add Option, Customize Table).
- Content animates in with typed/word-by-word motion.
- Number values still use NumberFlow for smooth numeric transitions.

## Screens

### Home View

A focused, simplified view of the problem.

- Sentence-style inputs for:
  - task frequency
  - time saved per run
  - evaluation period
- Result line can be selected and toggled between:
  - approximate compact format (example: `~6 days`)
  - exact long format (example: `6 days, 8.08 hours`)
- `Show full table` navigates to the matrix view.
- `Reset to defaults` appears whenever current state differs from defaults (including custom focus inputs).

### Table View

A more detailed, mulitiplex view of the data, with a configurable table layout.

- `Back` to Home.
- Inline period selector in the sentence above the table.
- Discrete lifetime slider (including keyboard controls).
- Matrix with:
  - fixed layout widths matching the design
  - impossible cells rendered as a patterned fill
- Legend and `Customize` action below the table.
  - `Customize` opens the Customize Table screen, which allows users to add or remove rows and columns.

### Select Menu Screens

- Used for each inline select trigger.
- Current selection is emphasized in bold.
- Includes:
  - list of preset options
  - `New option…`
  - `Cancel`

### Add Option Screen

- Opened from `New option…`.
- Prompt + inline text entry (terminal cursor style).
- Press `Enter` to submit the value.
- `Cancel` returns to the menu.
- Includes examples for accepted formats.

### Customize Table

- Separate screen for editing table rows/columns.
- `Save changes` appears only when pending edits exist.
- `Cancel` exits without applying pending state.
- Add/edit flows:
  - `New column…` / `New row…`
  - edit or delete custom items

## Keyboard Interaction Contract

Across cursor-driven screens:

- `Arrow keys` and `Tab`/`Shift+Tab` move selection.
- `Enter/Return` activates the selected control.
- `Spacebar` mirrors `Enter` activation behavior.
- `Escape` cancels or navigates back where applicable.

Notes:

- Add-option/add-row/add-column text inputs remain normal text fields while focused.
- Cursor movement is designed to avoid layout shifts where possible.

## Parsing and Custom Values

The app accepts plain-language input for custom options.

Examples:

- Frequency: `50/day`, `10 times per day`, `Daily`, `Biweekly`, `2/y`
- Time saved: `10s`, `one minute`, `5 min`, `2h`
- Period: `5 years`, `18 months`, `2.5 years`, `6 mo`

Custom option behavior:

- Custom menu options are session-level selections, not managed as persistent option lists.
- Choosing another option discards that ad hoc custom selection.
- Non-preset lifetime values entered through `New option…` are not persisted across refresh.

## Tech Stack

- React + Vite + TypeScript
- Tailwind CSS v4
- shadcn/ui
- NumberFlow
- Motion (`motion/react`)
- Zod

## Development

Install and run:

```bash
pnpm install
pnpm dev
```

Checks:

```bash
pnpm lint
pnpm build
```
