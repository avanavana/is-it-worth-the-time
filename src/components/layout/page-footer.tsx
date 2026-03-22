import { ArrowUpRight } from 'lucide-react'

import { Separator } from '@/components/ui/separator'

export function PageFooter() {
  return (
    <footer className="text-center text-2xs text-muted-foreground py-8 border-t border-border">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href="https://www.avanavana.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors duration-300"
        >
          &copy;{new Date().getFullYear()} Avana Vana
          <ArrowUpRight className="size-3 text-muted-foreground/50" />
        </a>
        <Separator orientation="vertical" className="bg-border/80 data-[orientation=vertical]:h-4 self-center" />
        <a
          href="https://xkcd.com/1205/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors duration-300"
        >
          Inspired by xkcd
          <ArrowUpRight className="size-3 text-muted-foreground/50" />
        </a>
        <Separator orientation="vertical" className="bg-border/80 data-[orientation=vertical]:h-4 self-center" />
        <a
          href="https://github.com/avanavana/is-it-worth-the-time"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors duration-300"
        >
          View on Github
          <ArrowUpRight className="size-3 text-muted-foreground/50" />
        </a>
      </div>
    </footer>
  )
}
