export const HOME_CURSOR_RESULT_INDEX = 3
export const FOOTER_LINK_COUNT = 4

export const screenVariants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(1px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.22 } },
  exit: { opacity: 0, y: -6, filter: 'blur(1px)', transition: { duration: 0.16 } },
}

export const reducedMotionScreenVariants = {
  hidden: { opacity: 1, y: 0, filter: 'blur(0px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0 } },
  exit: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0 } },
}

export const interactiveBaseClass =
  "relative inline-flex items-center whitespace-nowrap pb-[1px] leading-4 transition-colors before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:h-px before:w-full before:bg-underline after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-foreground after:opacity-0 motion-safe:after:opacity-100 motion-safe:after:origin-right motion-safe:after:scale-x-0 motion-safe:after:transition-transform motion-safe:after:duration-300 motion-safe:hover:after:origin-left motion-safe:hover:after:scale-x-100 motion-reduce:after:scale-x-100 motion-reduce:after:transition-opacity motion-reduce:after:duration-150 motion-reduce:hover:after:opacity-100 focus-visible:outline-none"
