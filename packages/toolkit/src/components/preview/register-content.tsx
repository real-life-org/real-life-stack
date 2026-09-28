"use client"

import { useRef, useState, type KeyboardEvent } from "react"
import type { Item } from "@real-life-stack/data-interface"
import { ChevronLeft, ChevronRight, FileText, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../primitives/dialog"
import { resolveAssetUrl, cn } from "../../lib/utils"
import { safeHref, safeImageSrc } from "../../lib/field-values"
import type { FieldEntry } from "./field-register"

/**
 * Leseformen im Inhalt und im Kopf aus dem Register (S4b):
 *
 * - B5 `media`: die Bildreihe im Inhalt, nach der Beschreibung; ein Klick
 *   öffnet die Lightbox, Pfeiltasten blättern, Escape schließt.
 * - B11 `avatar`: der Kopf-Avatar neben dem Titel.
 *
 * Spec: shared-components → „Item-Detail aus dem Register", Detail-Anatomie
 * (Slots `head` und `content`) und Widget-Paare B5, B11. Verzweigt über das
 * Widget des Feldes, nie über den Typ.
 */

/** Ein Eintrag in `data.media`, wie der Composer ihn schreibt. */
interface MediaEntry {
  id: string
  name: string
  url: string
  type?: string
}

/**
 * Das Medien-Feld eines Typs, sonst `media` (der Composer lässt Medien für
 * jeden Typ zuschalten; wer schreibt, hat eine Leseform).
 */
const SWITCHABLE_MEDIA: FieldEntry = { key: "media", widget: "media", pos: "content" }

function mediaFields(fields: readonly FieldEntry[] | undefined): FieldEntry[] {
  const own = (fields ?? []).filter((f) => f.widget === "media")
  return own.length > 0 ? own : [SWITCHABLE_MEDIA]
}

/**
 * Die Einträge an der Lesegrenze bereinigt (Codex R2/2): nur mit Adresse als
 * Text; `name` und `type` nur als Text, sonst leer. Fremde oder kaputte Daten
 * dürfen die Detailansicht nicht zum Absturz bringen.
 */
function mediaEntries(value: unknown): MediaEntry[] {
  if (!Array.isArray(value)) return []
  const out: MediaEntry[] = []
  value.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return
    const m = raw as Record<string, unknown>
    if (typeof m.url !== "string") return
    out.push({
      id: typeof m.id === "string" && m.id !== "" ? m.id : `media-${index}`,
      name: typeof m.name === "string" ? m.name : "",
      url: m.url,
      ...(typeof m.type === "string" && m.type !== "" ? { type: m.type } : {}),
    })
  })
  return out
}

const IMAGE_NAME = /\.(jpe?g|png|gif|webp|avif|svg)$/i

/** Bild nach Typ, sonst nach der Endung des Namens oder der Adresse. */
function isImage(entry: MediaEntry): boolean {
  if (entry.type) return entry.type.startsWith("image/")
  if (entry.name) return IMAGE_NAME.test(entry.name)
  const path = entry.url.split(/[?#]/)[0] ?? ""
  return IMAGE_NAME.test(path) || entry.url.startsWith("data:image/")
}

/** Ein Bild der Reihe: die sichere Adresse, sonst nicht darstellbar. */
interface ShownImage {
  id: string
  name: string
  src: string
}

/**
 * Medien im Inhalt (B5, Lesen). Bilder als Reihe, andere Dateien als Links
 * (nur http/https, ohne Opener). Unsichere Adressen erscheinen nicht. Ohne
 * Medien `null` (Slot ohne Inhalt erzeugt nichts, Detail-Anatomie Regel 1).
 */
export function RegisterMedia({ item, fields }: { item: Item; fields?: readonly FieldEntry[] }) {
  const data = (item.data ?? {}) as Record<string, unknown>
  const entries = mediaFields(fields).flatMap((field) => mediaEntries(data[field.key]))
  const images: ShownImage[] = []
  const files: { id: string; name: string; href: string }[] = []
  for (const entry of entries) {
    if (isImage(entry)) {
      const src = safeImageSrc(entry.url)
      if (src) images.push({ id: entry.id, name: entry.name || "Bild", src })
    } else {
      const href = safeHref(entry.url)
      if (href) files.push({ id: entry.id, name: entry.name || href, href })
    }
  }
  const [open, setOpen] = useState<number | null>(null)
  // Das Vorschaubild, das die Lightbox geöffnet hat: Der Fokus kehrt dorthin
  // zurück (die Lightbox hat keinen Radix-Trigger, Codex R1/4).
  const opener = useRef<HTMLButtonElement | null>(null)
  if (images.length === 0 && files.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 && (
        // Ein Bild in voller Breite, zwei nebeneinander, ab drei in drei
        // Spalten (Detail-Simulator: Bildreihe im Inhalt).
        <div
          data-media-row
          className={cn("grid gap-2", images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3")}
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`Bild ${index + 1} von ${images.length} öffnen: ${image.name}`}
              onClick={(event) => {
                event.stopPropagation()
                opener.current = event.currentTarget
                setOpen(index)
              }}
              className={cn(
                "overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                images.length === 1 ? "max-h-80" : "aspect-[4/3]",
              )}
            >
              <img
                src={resolveAssetUrl(image.src)}
                alt={image.name}
                loading="lazy"
                className={cn("h-full w-full", images.length === 1 ? "max-h-80 object-contain" : "object-cover")}
              />
            </button>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((file) => (
            <li key={file.id} data-media-file className="flex min-w-0 items-center gap-2 text-sm">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <a
                href={file.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="min-w-0 truncate text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {file.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      {open !== null && images[open] && (
        <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} returnFocus={() => opener.current?.focus()} />
      )}
    </div>
  )
}

/**
 * Die Lightbox: ein Bild groß, „2 / 5", Pfeile und Pfeiltasten blättern (am
 * Rand bleibt es stehen), Escape und ✕ schließen. Fokus und Escape regelt der
 * Dialog; der Fokus kehrt zum Vorschaubild zurück.
 */
function Lightbox({
  images,
  index,
  onIndex,
  onClose,
  returnFocus,
}: {
  images: readonly ShownImage[]
  index: number
  onIndex: (next: number) => void
  onClose: () => void
  returnFocus: () => void
}) {
  const image = images[index]!
  const hasPrev = index > 0
  const hasNext = index < images.length - 1
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" && hasNext) {
      event.preventDefault()
      onIndex(index + 1)
    } else if (event.key === "ArrowLeft" && hasPrev) {
      event.preventDefault()
      onIndex(index - 1)
    }
  }
  const nav =
    "absolute top-1/2 -translate-y-1/2 rounded-full border bg-background/90 p-2 text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        data-lightbox
        showCloseButton={false}
        onKeyDown={onKeyDown}
        onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
        className="max-w-[min(96vw,64rem)] gap-2 p-3 sm:max-w-[min(96vw,64rem)]"
      >
        <DialogTitle className="sr-only">{image.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Bild {index + 1} von {images.length}. Pfeiltasten blättern, Escape schließt.
        </DialogDescription>
        <div className="relative flex items-center justify-center">
          <img
            src={resolveAssetUrl(image.src)}
            alt={image.name}
            className="max-h-[80dvh] w-auto max-w-full rounded-md object-contain"
          />
          {images.length > 1 && (
            <>
              <button type="button" aria-label="Vorheriges Bild" disabled={!hasPrev} onClick={() => onIndex(index - 1)} className={cn(nav, "left-2")}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Nächstes Bild" disabled={!hasNext} onClick={() => onIndex(index + 1)} className={cn(nav, "right-2")}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{image.name}</span>
          <span className="flex shrink-0 items-center gap-2">
            {images.length > 1 && <span className="tabular-nums">{index + 1} / {images.length}</span>}
            <button
              type="button"
              aria-label="Schließen"
              onClick={onClose}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// B11: Kopf-Avatar

/** Führt der Typ ein Avatar-Feld im Kopf? */
export function hasHeadAvatar(fields: readonly FieldEntry[] | undefined): boolean {
  return (fields ?? []).some((f) => f.widget === "avatar" && f.pos === "head")
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((wort) => wort[0]!)
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  )
}

/**
 * Kopf-Avatar (B11, Lesen): das Bild aus dem ersten Avatar-Feld im Kopf. Ohne
 * sicheres Bild `null` — der Kopf trägt dann nur den Titel (Regel 2: leer
 * erzeugt nichts).
 */
export function RegisterHeadAvatar({ item, fields }: { item: Item; fields?: readonly FieldEntry[] }) {
  const field = (fields ?? []).find((f) => f.widget === "avatar" && f.pos === "head")
  const data = (item.data ?? {}) as Record<string, unknown>
  const src = field ? safeImageSrc(data[field.key]) : null
  if (!field || !src) return null
  const name = [data.title, data.displayName].find((v): v is string => typeof v === "string" && v.trim() !== "") ?? ""
  return (
    <Avatar data-head-avatar data-src={src} className="h-14 w-14 shrink-0 ring-2 ring-background shadow-sm">
      <AvatarImage src={src} alt={name || (field.label ?? "Bild")} className="object-cover" />
      <AvatarFallback className="bg-primary/10 text-lg font-medium text-primary">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
