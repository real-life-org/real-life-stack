import * as React from "react"
import { cn } from "@/lib/utils"

export interface MnemonicVerifyProps {
  words: string[]
  /** Number of words to verify (default: 3) */
  count?: number
  onVerified: () => void
  className?: string
}

function pickRandomIndices(total: number, count: number): number[] {
  const indices = Array.from({ length: total }, (_, i) => i)
  const picked: number[] = []
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * indices.length)
    picked.push(indices[idx])
    indices.splice(idx, 1)
  }
  return picked.sort((a, b) => a - b)
}

export function MnemonicVerify({ words, count = 3, onVerified, className }: MnemonicVerifyProps) {
  const [indices] = React.useState(() => pickRandomIndices(words.length, count))
  const [inputs, setInputs] = React.useState<string[]>(Array(count).fill(""))
  const [error, setError] = React.useState(false)
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (idx: number, value: string) => {
    setError(false)
    const next = [...inputs]
    next[idx] = value.trim().toLowerCase()
    setInputs(next)

    // Auto-verify when all filled
    const allFilled = next.every((v) => v.length > 0)
    if (allFilled) {
      const correct = indices.every((wordIdx, i) => next[i] === words[wordIdx].toLowerCase())
      if (correct) {
        onVerified()
      } else {
        setError(true)
      }
    }
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault()
      if (idx < count - 1) {
        inputRefs.current[idx + 1]?.focus()
      }
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm text-muted-foreground">
        Bestätige die folgenden Wörter aus deinem Seed:
      </p>
      <div className="space-y-3">
        {indices.map((wordIdx, i) => (
          <div key={wordIdx} className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap text-right font-mono w-16">
              Wort {wordIdx + 1}:
            </span>
            <input
              ref={(el) => { inputRefs.current[i] = el }}
              type="text"
              autoComplete="off"
              value={inputs[i]}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={cn(
                "flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm font-mono transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                error && "border-destructive"
              )}
            />
          </div>
        ))}
      </div>
      {error && (
        <p className="text-sm text-destructive">
          Die Wörter stimmen nicht überein. Bitte prüfe deinen Seed.
        </p>
      )}
    </div>
  )
}
