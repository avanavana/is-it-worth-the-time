import NumberFlow from '@number-flow/react'

export function ExactResultText({ text }: { text: string }) {
  return (
    <span className="whitespace-nowrap">
      {text.split(/(\d+(?:\.\d+)?)/).map((part, index) => {
        const numeric = Number(part)
        if (part && Number.isFinite(numeric) && /^\d+(?:\.\d+)?$/.test(part)) {
          return (
            <NumberFlow
              key={`${part}-${index}`}
              value={numeric}
              format={{ maximumFractionDigits: 2 }}
            />
          )
        }

        return part ? <span key={`${part}-${index}`}>{part}</span> : null
      })}
    </span>
  )
}
