/**
 * Die Feineinstellung des Aussehens — im Modul-Panel, nicht im Dialog.
 *
 * Ein Dialog sagt "erst das hier, dann die App"; Regler, deren Wirkung man
 * auf der App sehen will, sagen das Gegenteil. Zwei Anlaeufe, den modalen
 * Dialog durchsichtig oder angedockt zu machen, wirkten beide komisch. Das
 * Panel ist die Flaeche, die das kann: ohne Backdrop, die Seite bleibt
 * bedienbar, man sieht Hover-Zustaende und Menues mit der neuen Farbe.
 *
 * Es bekommt die LEBENDE Gruppe (aus `useGroups`), nicht einen Schnappschuss:
 * Panel-Inhalt wandert beim Oeffnen in den Panel-Zustand, ein eingefrorener
 * Wert wuerde beim ersten Regler veralten. Der Aufrufer haelt darum einen
 * kleinen Host, der die Gruppe je Render neu heraussucht.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { RotateCcw, SlidersHorizontal } from "lucide-react"
import type { Group } from "@real-life-stack/data-interface"

import { useColorScheme } from "../../hooks/use-color-scheme"
import { scalesForColor } from "../../lib/color-scales"
import { contrastChecks, themeTokens } from "../../lib/theme-tokens"
import { colorAxes, colorFromAxes, readTint } from "../../lib/space-theme"
import { cn, getSpacePrimaryColor } from "../../lib/utils"
import { instanceTheme } from "../../lib/runtime-config"
import { Button } from "../primitives/button"
import { createLatestWinsSaver } from "./group-dialog"

export interface SpaceThemePanelProps {
  group: Group
  onUpdateGroup: (id: string, updates: { data?: Record<string, unknown> }) => Promise<void> | void
  className?: string
}

export function SpaceThemePanel({ group, onUpdateGroup, className }: SpaceThemePanelProps) {
  const onUpdateRef = useRef(onUpdateGroup)
  onUpdateRef.current = onUpdateGroup

  // Lokal gehalten, damit ein Regler sofort steht; die lebende Gruppe zieht
  // nach und gewinnt, sobald sie etwas anderes sagt (anderes Geraet, Reset).
  const storedColor = (group.data?.primaryColor as string | undefined) ?? null
  const storedTint = readTint(group.data?.tint)
  const [colorChoice, setColorChoice] = useState<string | null>(storedColor)
  const [tintChoice, setTintChoice] = useState<number | null>(storedTint)
  useEffect(() => { setColorChoice(storedColor) }, [storedColor])
  useEffect(() => { setTintChoice(storedTint) }, [storedTint])

  const [error, setError] = useState<string | null>(null)

  /**
   * Zwei Saver, einer je Wert: "der letzte gewinnt" gilt je Wert, und Farbe
   * und Toenung sind unabhaengig. Das Ziel haengt am Wert, nicht am
   * Zeitpunkt — ein eingereihter Vorgang darf nicht in einen anderen Space
   * schreiben, der inzwischen offen ist.
   */
  const saveColorRef = useRef<((v: { groupId: string; hex: string | null; clearTint?: boolean }) => void) | null>(null)
  if (!saveColorRef.current) {
    saveColorRef.current = createLatestWinsSaver<{ groupId: string; hex: string | null; clearTint?: boolean }>(
      async ({ groupId, hex, clearTint }) => {
        await onUpdateRef.current(groupId, { data: { primaryColor: hex, ...(clearTint ? { tint: null } : {}) } })
      },
      (err) => setError(err instanceof Error ? err.message : "Farbe konnte nicht gespeichert werden"),
      () => setError(null),
    )
  }
  const saveTintRef = useRef<((v: { groupId: string; tint: number | null }) => void) | null>(null)
  if (!saveTintRef.current) {
    saveTintRef.current = createLatestWinsSaver<{ groupId: string; tint: number | null }>(
      async ({ groupId, tint }) => {
        await onUpdateRef.current(groupId, { data: { tint } })
      },
      (err) => setError(err instanceof Error ? err.message : "Tönung konnte nicht gespeichert werden"),
      () => setError(null),
    )
  }

  const effectiveColor = getSpacePrimaryColor(group.id, colorChoice)
  // Ohne eigene Toenung erbt der Space die der Instanz (Kaskade). Der Regler
  // zeigt, was gilt — und ein Reset fuehrt dorthin zurueck, nicht auf 0.
  const inheritedTint = instanceTheme().tint ?? 0
  const effectiveTint = tintChoice ?? inheritedTint
  const axes = colorAxes(effectiveColor)
  const setAxis = (key: keyof typeof axes, value: number) => {
    const hex = colorFromAxes({ ...axes, [key]: value })
    setColorChoice(hex)
    saveColorRef.current?.({ groupId: group.id, hex })
  }
  const setTint = (tint: number | null) => {
    setTintChoice(tint)
    saveTintRef.current?.({ groupId: group.id, tint })
  }
  /** EIN Reset fuer alles, was der Space am Aussehen gesetzt hat. */
  const reset = () => {
    setColorChoice(null)
    setTintChoice(null)
    saveColorRef.current?.({ groupId: group.id, hex: null, clearTint: true })
  }

  const scheme = useColorScheme()
  const checks = useMemo(() => {
    const scales = scalesForColor(effectiveColor, scheme, { tint: effectiveTint })
    return contrastChecks(themeTokens({ ...scales, scheme }), { accentOnly: true })
  }, [effectiveColor, scheme, effectiveTint])

  const sliders = [
    ["hue", "Farbton", 0, 360],
    ["chroma", "Kräftigkeit", 0, 100],
    ["lightness", "Helligkeit", 0, 100],
  ] as const

  return (
    <div className={cn("flex h-full flex-col", className)} data-testid="space-theme-panel">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">Feineinstellung</div>
          <div className="truncate text-xs text-muted-foreground">{group.name}</div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {/* Drei Achsen von OKLCH in Worten. Die Regler zeigen die geltende
            Farbe und schreiben sie zurueck — genau ein Wert. */}
        <div className="space-y-2">
          {sliders.map(([key, label, min, max]) => (
            <label key={key} className="flex items-center gap-3 text-xs">
              <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
              <input
                type="range"
                aria-label={label}
                min={min}
                max={max}
                value={axes[key]}
                onChange={(e) => setAxis(key, Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-primary"
              />
              <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                {axes[key]}{key === "hue" ? "°" : ""}
              </span>
            </label>
          ))}

          {/* Toenung: wie stark die Flaechen die Farbe tragen. 0 = neutral,
              der Akzent traegt allein; reallife.network liegt bei etwa 50. */}
          <label className="flex items-center gap-3 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">Tönung</span>
            <input
              type="range"
              aria-label="Tönung"
              min={0}
              max={100}
              value={Math.round(effectiveTint * 100)}
              onChange={(e) => setTint(readTint(Number(e.target.value) / 100))}
              className="h-1.5 flex-1 cursor-pointer accent-primary"
            />
            <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
              {Math.round(effectiveTint * 100)}
            </span>
          </label>
        </div>

        {/* Was das fuer die Lesbarkeit bedeutet. Die Knopfschrift ist mit
            Absicht weiss (siehe getReadableTextColor) und kann darum unter
            3:1 liegen — gezeigt wird es trotzdem. */}
        <div className="space-y-0.5">
          {checks.map((check) => (
            <div key={check.label} className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{check.label}</span>
              <span className={cn("tabular-nums", check.ok ? "text-muted-foreground" : "text-destructive")}>
                {check.ratio.toFixed(1)}:1
                {!check.ok && <span className="ml-1">· {check.minimum}:1 nötig</span>}
              </span>
            </div>
          ))}
        </div>

        {(colorChoice != null || tintChoice != null) && (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Zurücksetzen
          </Button>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

      </div>
    </div>
  )
}
