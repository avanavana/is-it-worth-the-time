import { Github, Lightbulb, Link as LinkIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export function PageFooter() {
  return (
    <footer className="text-center text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href="https://www.avanavana.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors duration-300"
        >
          <LinkIcon className="size-3" />
          avanavana.com
        </a>
        <Separator orientation="vertical" className="bg-border/80 data-[orientation=vertical]:h-4 self-center" />
        <a
          href="https://xkcd.com/1205/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors duration-300"
        >
          <Lightbulb className="size-3" />
          xkcd inspiration
        </a>
        <Separator orientation="vertical" className="bg-border/80 data-[orientation=vertical]:h-4 self-center" />
        <a
          href="https://github.com/avanavana/is-it-worth-the-time"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors duration-300"
        >
          <Github className="size-3" />
          github
        </a>
      </div>
    </footer>
  )
}
