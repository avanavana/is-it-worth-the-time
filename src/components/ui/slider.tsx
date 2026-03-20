import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'

import { cn } from '@/lib/utils'

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  thumbProps?: React.ComponentProps<typeof SliderPrimitive.Thumb>
}

function Slider({ className, thumbProps, ...props }: SliderProps) {
  const { className: thumbClassName, ...thumbRestProps } = thumbProps ?? {}

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        'relative flex w-full touch-none select-none items-center py-2 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-6 data-[orientation=vertical]:flex-col',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute h-full bg-primary data-[orientation=vertical]:w-full"
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        className={cn(
          'block size-4 rounded-full border border-zinc-400 bg-white shadow-sm transition-[color,box-shadow] hover:cursor-grab hover:ring-4 hover:ring-ring/20 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50',
          thumbClassName,
        )}
        {...thumbRestProps}
      />
    </SliderPrimitive.Root>
  )
}

export { Slider }
