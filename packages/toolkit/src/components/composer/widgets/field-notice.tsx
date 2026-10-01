"use client"

import { X } from "lucide-react"

/**
 * Hinweis auf ein nicht übernommenes Ergebnis (shared-components →
 * Formularzustand, Regel 10): steht am Feld, bis der Nutzer ihn schließt
 * oder das Feld neu setzt.
 */
export function FieldNotice({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <p data-field-notice role="status" className="flex items-start gap-1.5 text-xs text-destructive">
      <span className="flex-1">{text}</span>
      <button
        type="button"
        aria-label="Hinweis schließen"
        onClick={onDismiss}
        className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </p>
  )
}
