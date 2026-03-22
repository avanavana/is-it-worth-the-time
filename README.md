# Is It Worth the Time?

An interactive, client-side calculator inspired by the xkcd comic  
["Is It Worth the Time?"](https://xkcd.com/1205/).

## Why This App Exists

The original comic is one of the clearest mental models for deciding whether optimization or automation is worth doing:

- How much time do you save each run?
- How often do you do the task?
- Over how long a period?

This app turns that static chart into a live tool. Instead of reading a fixed table, you can edit assumptions, explore custom scenarios, and instantly see how the break-even time changes.

## Core Idea

The app computes:

`break_even_time = time_saved_per_run × runs_per_year × task_lifetime_years`

That value is the maximum time you can rationally spend improving the task before the optimization no longer pays off.

## Features

- Focus view with editable sentence inputs for:
  - task frequency
  - time saved per repetition
  - lifetime period
- Full table view based on the xkcd-style matrix
- Hover details for approximate values
- Impossible-cell handling (blank/disabled cells)
- Add/remove custom rows (time saved) and columns (frequency)
- Automatic sorting of new custom rows/columns by value
- Light / dark / system theme
- Exact mode toggle + significant digits (exact mode only)
- Calendar basis options:
  - Calendar days (365)
  - Workdays (250)
  - Custom days/year
- Local persistence with `localStorage`
- Mobile behavior with horizontal table scrolling

## Tech Stack

- `pnpm`
- React + Vite + TypeScript
- Tailwind CSS v4
- shadcn/ui
- Lucide React
- Zod
- NumberFlow

## Development

```bash
pnpm install
pnpm dev
```

Build and check:

```bash
pnpm lint
pnpm build
```
