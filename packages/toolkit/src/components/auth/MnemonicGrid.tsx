import * as React from "react"
import { cn } from "@/lib/utils"
import { Copy, Check } from "lucide-react"

export interface MnemonicGridProps {
  words: string[]
  className?: string
  copyable?: boolean
}

export function MnemonicGrid({ words, className, copyable = true }: MnemonicGridProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(words.join(" "))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-3 gap-2">
        {words.map((word, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono"
          >
            <span className="text-muted-foreground text-xs w-5 text-right">{i + 1}.</span>
            <span>{word}</span>
          </div>
        ))}
      </div>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Kopiert!" : "Wörter kopieren"}
        </button>
      )}
    </div>
  )
}
