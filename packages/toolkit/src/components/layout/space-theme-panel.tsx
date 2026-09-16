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
   * EINE Warteschlange fuer alles, was das Panel schreibt.
   *
   * Zwei getrennte Warteschlangen (Farbe, Toenung) hatten keine gemeinsame
   * Reihenfolge: nach zwei schnellen Toenungsaenderungen und "Zuruecksetzen"
   * schrieb die Toenungsschlange danach wieder 0.8 statt null — der Reset
   * war ueberholt, bevor er ankam. Darum ein Patch, in den jede Aenderung
   * feldweise gemischt wird; "der letzte gewinnt" gilt je Feld, die
   * Reihenfolge der Schreibvorgaenge ist total.
   *
   * Das Ziel haengt am Patch, nicht am Zeitpunkt: ein eingereihter Vorgang
   * darf nicht in einen Space schreiben, der inzwischen offen ist.
   */
  const pendingRef = useRef<{ groupId: string; data: Record<string, unknown> } | null>(null)
  const flushingRef = useRef(false)
  const flush = async () => {
    if (flushingRef.current) return
    flushingRef.current = true
    try {
      while (pendingRef.current) {
        const { groupId, data } = pendingRef.current
        pendingRef.current = null
        try {
          await onUpdateRef.current(groupId, { data })
          setError(null)
        } catch (err) {
          // Zurueck auf das, was die Gruppe wirklich traegt.
          pendingRef.current = null
          setColorChoice(storedColorRef.current)
          setTintChoice(storedTintRef.current)
          setError(err instanceof Error ? err.message : "Aussehen konnte nicht gespeichert werden")
        }
      }
    } finally {
      flushingRef.current = false
    }
  }
  const write = (data: Record<string, unknown>) => {
    const pending = pendingRef.current
    pendingRef.current =
      pending && pending.groupId === group.id
        ? { groupId: group.id, data: { ...pending.data, ...data } }
        : { groupId: group.id, data }
    void flush()
  }
  const storedColorRef = useRef(storedColor)
  storedColorRef.current = storedColor
  const storedTintRef = useRef(storedTint)
  storedTintRef.current = storedTint

  const effectiveColor = getSpacePrimaryColor(group.id, colorChoice)
  // Ohne eigene Toenung erbt der Space die der Instanz (Kaskade). Der Regler
  // zeigt, was gilt — und ein Reset fuehrt dorthin zurueck, nicht auf 0.
  const inheritedTint = instanceTheme().tint ?? 0
  const effectiveTint = tintChoice ?? inheritedTint
  const axes = colorAxes(effectiveColor)
  const setAxis = (key: keyof typeof axes, value: number) => {
    const hex = colorFromAxes({ ...axes, [key]: value })
    setColorChoice(hex)
    write({ primaryColor: hex })
  }
  const setTint = (tint: number | null) => {
    setTintChoice(tint)
    write({ tint })
  }
  /** EIN Reset fuer alles, was der Space am Aussehen gesetzt hat. */
  const reset = () => {
    setColorChoice(null)
    setTintChoice(null)
    write({ primaryColor: null, tint: null })
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
