/**
 * Die Bausteine der Theme-Konfiguration — geteilt zwischen dem Bereich
 * "Aussehen" im Space-Dialog (abgespeckt: Akzent, Radius, Panel) und der
 * Feineinstellungs-Karte (alles). Eine Quelle, damit beide dasselbe zeigen
 * (Claude-Design "Space Menu", Turn 5).
 */
import { Check } from "lucide-react"

import { accentSwatches, RADIUS_ORDER, type RadiusStep, type Surfaces } from "../../lib/space-theme"
import { cn, getReadableTextColor } from "../../lib/utils"

/** Kapitaelchen-Ueberschrift, wie im Entwurf ("AKZENTFARBE"). */
export function ThemeSectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
}

export interface AccentGridProps {
  /** Die Farbe, die gilt — bestimmt den Haken. */
  effectiveColor: string
  onPick: (hex: string) => void
  /** Der Kreis "eigene Farbe": gedrueckt, wenn die geltende Farbe keine Skala ist oder der Aufrufer es sagt. */
  customActive: boolean
  onCustom: () => void
  /** Beschriftung eines Skalenkreises fuer Vorlesehilfen und Tests. */
  swatchLabel?: (swatch: { name: string; hex: string }) => string
  /** Wird VOR die Palette gestellt — etwa die aus dem Space-Bild gewonnene Farbe. */
  leading?: React.ReactNode
  /** Inhalt des "eigene Farbe"-Kreises (etwa ein verstecktes Farbfeld). */
  customChildren?: React.ReactNode
  /** Rendert den eigenen Kreis als <label> statt <button> (fuer ein Farbfeld darin). */
  customAsLabel?: boolean
}

/** Die Radix-Skalen als Raster, nach Farbton geordnet, plus "eigene Farbe". */
export function AccentGrid({
  effectiveColor,
  onPick,
  customActive,
  onCustom,
  swatchLabel = (s) => `Accent ${s.name}`,
  leading,
  customChildren,
  customAsLabel,
}: AccentGridProps) {
  const wanted = effectiveColor.toLowerCase()
  const Custom = (customAsLabel ? "label" : "button") as "label" | "button"
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Akzentfarbe">
      {leading}
      {accentSwatches("light").map((s) => {
        const active = !customActive && s.hex.toLowerCase() === wanted
        return (
          <button
            key={s.name}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={swatchLabel(s)}
            title={s.name}
            onClick={() => onPick(s.hex)}
            style={{ backgroundColor: s.hex }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110",
              active && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
            )}
          >
            {active && <Check className="h-3.5 w-3.5" style={{ color: getReadableTextColor(s.hex) }} />}
          </button>
        )
      })}
      {/* Als <label> um ein Farbfeld benennt das Feld darin den Kreis — ein
          zweiter Name am Rahmen waere fuer Vorlesehilfen ein Doppel. */}
      <Custom
        {...(customAsLabel
          ? {}
          : { type: "button" as const, onClick: onCustom, role: "radio", "aria-checked": customActive, "aria-label": "Eigene Farbe" })}
        title="Eigene Farbe"
        style={customActive ? { backgroundColor: effectiveColor } : undefined}
        className={cn(
          "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary",
          customActive && "border-solid border-foreground",
        )}
      >
        {customActive ? (
          // Lesbar zur Farbe: fest weiss verschwand ein Haken auf einer
          // hellen eigenen Farbe (Spec 04 Regel 5).
          <Check className="h-3.5 w-3.5" style={{ color: getReadableTextColor(effectiveColor) }} />
        ) : (
          <span className="text-sm leading-none">+</span>
        )}
        {customChildren}
      </Custom>
    </div>
  )
}

/** Fuenf Kacheln mit der Ecke, wie im Radix-Playground. */
export function RadiusTiles({ value, onChange }: { value: RadiusStep; onChange: (step: RadiusStep) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Rundung">
      {RADIUS_ORDER.map((step, i) => (
        <button
          key={step}
          type="button"
          role="radio"
          aria-checked={value === step}
          aria-label={`Rundung ${step}`}
          onClick={() => onChange(step)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-md border p-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
            value === step && "border-foreground text-foreground",
          )}
        >
          <span
            aria-hidden
            className="block h-7 w-7 border-l-2 border-t-2 border-primary bg-primary/15"
            style={{ borderTopLeftRadius: ["0px", "4px", "8px", "12px", "18px"][i] }}
          />
          {["None", "Small", "Medium", "Large", "Full"][i]}
        </button>
      ))}
    </div>
  )
}

/** Solid / Translucent — Radix' panelBackground. */
export function SurfacesToggle({ value, onChange }: { value: Surfaces; onChange: (kind: Surfaces) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Flächen">
      {([["solid", "Solid"], ["translucent", "Translucent"]] as const).map(([kind, label]) => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={value === kind}
          aria-label={`Flächen ${kind}`}
          onClick={() => onChange(kind)}
          className={cn(
            "h-8 rounded-md border text-xs text-muted-foreground transition-colors hover:text-foreground",
            value === kind && "border-foreground text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
