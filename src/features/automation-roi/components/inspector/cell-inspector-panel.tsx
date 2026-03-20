import { Calculator, MousePointerClick } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { formatExactText, formatHumanizedText, formatInspectorSeconds } from '../../formatters'
import type { CellDetails, DisplayMode } from '../../types'

interface CellInspectorPanelProps {
  selectedCell: CellDetails | null
  displayMode: DisplayMode
  significantDigits: number
}

export function CellInspectorPanel({
  selectedCell,
  displayMode,
  significantDigits,
}: CellInspectorPanelProps) {
  if (!selectedCell) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="size-4" />
            Calculation inspector
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <MousePointerClick className="size-4" />
            Click or focus a table cell to inspect the full break-even calculation.
          </p>
        </CardContent>
      </Card>
    )
  }

  const breakEvenText =
    displayMode === 'exact'
      ? formatExactText(selectedCell.totalSavedSeconds, significantDigits)
      : formatHumanizedText(selectedCell.totalSavedSeconds)

  const explanation = `Saving ${selectedCell.rowLabel} on a ${selectedCell.columnLabel.toLowerCase()} task for ${strip(selectedCell.lifetimeYears)} years yields ${strip(selectedCell.totalRuns)} total runs. That adds up to ${formatHumanizedText(selectedCell.totalSavedSeconds)} of total time saved.`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cell details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <dl className="space-y-2 text-sm">
          <InspectorLine label="Time saved per run" value={formatInspectorSeconds(selectedCell.secondsSavedPerRun)} />
          <InspectorLine label="Runs per year" value={formatNumber(selectedCell.runsPerYear)} />
          <InspectorLine label="Task lifetime" value={`${strip(selectedCell.lifetimeYears)} years`} />
          <InspectorLine label="Total runs" value={formatNumber(selectedCell.totalRuns)} />
          <InspectorLine
            label="Total time saved"
            value={formatHumanizedText(selectedCell.totalSavedSeconds)}
          />
          <InspectorLine label="Break-even optimization time" value={breakEvenText} />
        </dl>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <p className="font-medium text-slate-900 dark:text-slate-100">Explanation</p>
          <p className="mt-2 leading-relaxed">{explanation}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function InspectorLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  )
}

function strip(value: number) {
  return Number.parseFloat(value.toFixed(2)).toString()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)
}
