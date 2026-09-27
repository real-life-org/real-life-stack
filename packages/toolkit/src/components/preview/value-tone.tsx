"use client"

import { cn } from "../../lib/utils"
import type { OptionTone } from "../../lib/field-values"

/**
 * Die Optik eines Tons (status B6, select B8; Design 27.09.2026): ein Punkt
 * im kräftigen Ton; gewählt bzw. als Chip ein Pastellgrund im Ton mit Schrift
 * und Rand im kräftigen Ton, halbfett. Nur über Theme-Tokens: Der Pastellgrund
 * ist der Ton mit geringer Deckkraft (dunkel getönt statt hell), die Schrift
 * der Ton, abgedunkelt für hellen und aufgehellt für dunklen Grund.
 *
 * Eine `.tsx`-Datei mit wörtlichen Klassen, damit die Apps sie scannen.
 */
const TONES: Record<OptionTone, { dot: string; soft: string }> = {
  neutral: {
    dot: "bg-muted-foreground",
    soft: "border-muted-foreground/60 bg-muted text-foreground",
  },
  warning: {
    dot: "bg-warning",
    soft: "border-[color-mix(in_oklch,var(--warning),black_30%)] bg-warning/12 text-[color-mix(in_oklch,var(--warning),black_35%)] dark:border-warning dark:bg-warning/20 dark:text-[color-mix(in_oklch,var(--warning),white_25%)]",
  },
  success: {
    dot: "bg-success",
    soft: "border-[color-mix(in_oklch,var(--success),black_25%)] bg-success/12 text-[color-mix(in_oklch,var(--success),black_30%)] dark:border-success dark:bg-success/20 dark:text-[color-mix(in_oklch,var(--success),white_25%)]",
  },
  danger: {
    dot: "bg-destructive",
    // Schrift abgedunkelt: `text-destructive` auf Pastell bleibt unter 4,5:1 (Codex R5).
    soft: "border-destructive bg-destructive/10 text-[color-mix(in_oklch,var(--destructive),black_20%)] dark:bg-destructive/25 dark:text-[color-mix(in_oklch,var(--destructive),white_40%)]",
  },
  info: {
    dot: "bg-info",
    soft: "border-info bg-info/10 text-[color-mix(in_oklch,var(--info),black_25%)] dark:bg-info/20 dark:text-[color-mix(in_oklch,var(--info),white_20%)]",
  },
}

/** Klassen des Pastell-Zustands (gewählte Pille, Chip). `"type"`: die Typfarbe des Items. */
export function toneSoftClass(tone: OptionTone | "type", typeTone?: string): string {
  if (tone === "type") return cn("border-current/40", typeTone ?? TONES.neutral.soft)
  return TONES[tone].soft
}

/** Der 7-px-Punkt im kräftigen Ton. */
export function ToneDot({ tone, typeTone }: { tone: OptionTone | "type"; typeTone?: string }) {
  // Typfarbe: der Punkt nimmt die Schriftfarbe des Typ-Badges an.
  const cls = tone === "type" ? cn(typeTone, "bg-current") : TONES[tone].dot
  return <span data-tone-dot data-tone={tone} aria-hidden className={cn("inline-block h-[7px] w-[7px] shrink-0 rounded-full border-0", cls)} />
}
