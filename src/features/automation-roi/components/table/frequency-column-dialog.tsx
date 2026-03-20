import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

import { parseFrequencyInput } from '../../parsers'

interface FrequencyColumnDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValue?: string
  onOpenChange: (open: boolean) => void
  onSubmit: (value: { label: string; amount: number; unit: 'day' | 'week' | 'month' | 'year' }) => void
}

export function FrequencyColumnDialog({
  open,
  mode,
  initialValue,
  onOpenChange,
  onSubmit,
}: FrequencyColumnDialogProps) {
  const [input, setInput] = useState(initialValue ?? '')
  const [error, setError] = useState<string | null>(null)

  const title = mode === 'create' ? 'Add custom frequency column' : 'Edit custom frequency column'

  function handleSubmit() {
    const parsed = parseFrequencyInput(input)

    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    onSubmit({ label: parsed.label, amount: parsed.amount, unit: parsed.unit })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Enter a frequency expression. Examples: 3/day, 2/week, 10/month, 200/year.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. 3/day"
            autoFocus
            aria-label="Frequency input"
          />
          {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {mode === 'create' ? 'Add column' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
