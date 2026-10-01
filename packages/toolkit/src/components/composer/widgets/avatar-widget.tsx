"use client"

import * as React from "react"
import { Camera, ImagePlus, Loader2, X } from "lucide-react"

import { Avatar, AvatarImage } from "@/components/primitives/avatar"
import { safeImageSrc } from "@/lib/field-values"
import { FieldNotice } from "./field-notice"
import type { FieldAccess } from "@/lib/form-state"

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

/**
 * Standard: `resizeImage` aus `lib/image-utils` (WebP, mittig quadratisch),
 * erst beim Gebrauch geladen. Auch ein SVG wird gerastert: Der Vertrag ist
 * das Quadrat mit 512 px (Codex R6).
 */
export const defaultAvatarResize: ResizeImage = async (file, maxSize) => {
  const { resizeImage } = await import("../../../lib/image-utils")
  return resizeImage(file, maxSize, 0.85, { rasterizeSvg: true })
}

export interface AvatarFieldProps {
  label: string
  /**
   * Der Feldzugang (shared-components → Formularzustand): Wert (die
   * gespeicherte Bildadresse, leer ohne Bild), Sperre, Schreibweg und die
   * Arbeit „Bild verkleinern".
   */
  field: FieldAccess<string>
  /** Zum Testen austauschbar; Standard verkleinert im Browser. */
  resize?: ResizeImage
}

export function AvatarField({ label, field, resize = defaultAvatarResize }: AvatarFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const value = field.value
  const disabled = field.locked
  // Das gewählte Bild ist Nutzerarbeit (Formularzustand, Regel 10): Ein
  // Space- oder Typwechsel verwirft sie nicht; gibt es das Feld danach nicht,
  // sagt das Formular es. Eine neue Bildwahl oder „Entfernen" nimmt sie zurück.
  // Beschäftigt liest nur den Warte-Zustand des Formulars.
  const busy = field.busy("image")
  const [error, setError] = React.useState<string | null>(null)
  const src = safeImageSrc(value)
  const errorId = React.useId()

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Bitte ein Bild wählen.")
      return
    }
    setError(null)
    const work = field.begin("image", "user", "Bild")
    try {
      const result = await resize(file, AVATAR_SIZE)
      // Über den Schreibweg des Formulars JETZT; ein gesperrtes Feld nimmt nichts an.
      work.apply((now) => now.set(result))
    } catch {
      if (work.valid()) setError("Bild konnte nicht verarbeitet werden.")
    } finally {
      work.finish()
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
        {!src && !disabled && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            >
              Bild wählen
            </button>
            <span className="text-xs text-muted-foreground">wird auf {AVATAR_SIZE} px verkleinert</span>
          </div>
        )}
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
                field.cancel("image")
                field.set("")
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
      {field.notice && <FieldNotice text={field.notice} onDismiss={field.dismissNotice} />}
    </div>
  )
}
