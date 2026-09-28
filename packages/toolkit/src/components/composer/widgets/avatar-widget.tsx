"use client"

import * as React from "react"
import { Camera, ImagePlus, Loader2, X } from "lucide-react"

import { Avatar, AvatarImage } from "@/components/primitives/avatar"
import { safeImageSrc } from "@/lib/field-values"

/**
 * Schreibform des Avatars (B11, S4b): Bild wählen, auf 512 px verkleinern
 * (quadratisch, mittig beschnitten), als Bildadresse im Feld speichern.
 *
 * Spec: shared-components → Widget-Paare B11 („Bild wählen, Resize auf
 * 512 px"). Das Widget liest und schreibt nur den Wert seines Feldes; welches
 * Feld das ist, sagt das Register. Die Leseform ist der Kopf-Avatar.
 */

/** Kantenlänge des gespeicherten Bilds (B11). */
export const AVATAR_SIZE = 512

export type ResizeImage = (file: File, maxSize: number) => Promise<string>

/** Standard: `resizeImage` aus `lib/image-utils` (WebP, mittig quadratisch), erst beim Gebrauch geladen. */
const defaultResize: ResizeImage = async (file, maxSize) => {
  const { resizeImage } = await import("../../../lib/image-utils")
  return resizeImage(file, maxSize, 0.85)
}

export interface AvatarFieldProps {
  label: string
  /** Die gespeicherte Bildadresse, leer ohne Bild. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Zum Testen austauschbar; Standard verkleinert im Browser. */
  resize?: ResizeImage
}

export function AvatarField({ label, value, onChange, disabled, resize = defaultResize }: AvatarFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const src = safeImageSrc(value)
  const errorId = React.useId()
  // Nur das Ergebnis der letzten Aktion zählt: Entfernen oder eine neue Wahl
  // machen ein laufendes Verkleinern ungültig (Codex R2/3).
  const generation = React.useRef(0)

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Bitte ein Bild wählen.")
      return
    }
    setError(null)
    setBusy(true)
    const mine = ++generation.current
    try {
      const result = await resize(file, AVATAR_SIZE)
      if (mine === generation.current) onChange(result)
    } catch {
      if (mine === generation.current) setError("Bild konnte nicht verarbeitet werden.")
    } finally {
      if (mine === generation.current) setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5" data-avatar-field>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <div className="group relative">
          {src ? (
            <Avatar className="h-14 w-14 ring-2 ring-background shadow-sm">
              <AvatarImage src={src} alt={label} className="object-cover" />
            </Avatar>
          ) : (
            <button
              type="button"
              disabled={disabled || busy}
              aria-label={`${label} hochladen`}
              aria-describedby={error ? errorId : undefined}
              onClick={() => inputRef.current?.click()}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            </button>
          )}
        </div>
        {src && !disabled && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`${label} ändern`}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              Ändern
            </button>
            <button
              type="button"
              aria-label={`${label} entfernen`}
              onClick={() => {
                generation.current++
                setBusy(false)
                onChange("")
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="h-3.5 w-3.5" />
              Entfernen
            </button>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
