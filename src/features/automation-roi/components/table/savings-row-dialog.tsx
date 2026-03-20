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

import { parseTimeSavedInput } from '../../parsers'

interface SavingsRowDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValue?: string
  onOpenChange: (open: boolean) => void
  onSubmit: (value: { label: string; seconds: number }) => void
}

export function SavingsRowDialog({
  open,
  mode,
  initialValue,
  onOpenChange,
  onSubmit,
}: SavingsRowDialogProps) {
  const [input, setInput] = useState(initialValue ?? '')
  const [error, setError] = useState<string | null>(null)

  const title = mode === 'create' ? 'Add custom time-saved row' : 'Edit custom time-saved row'

  function handleSubmit() {
    const parsed = parseTimeSavedInput(input)

    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    onSubmit({ label: parsed.label, seconds: parsed.seconds })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Enter time saved per run. Examples: 30s, 2 min, 1.5 hr.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. 45 sec"
            autoFocus
            aria-label="Time saved input"
          />
          {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{mode === 'create' ? 'Add row' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
