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
import { Check, RotateCcw, SlidersHorizontal } from "lucide-react"
import type { Group } from "@real-life-stack/data-interface"

import { useColorScheme } from "../../hooks/use-color-scheme"
import { scalesForColor } from "../../lib/color-scales"
import { contrastChecks, themeTokens } from "../../lib/theme-tokens"
import { accentSwatches, colorAxes, colorFromAxes, graySwatches, matchAccentScale, RADIUS_ORDER, readGray, readRadius, readSurfaces, readTint, type RadiusStep, type Surfaces } from "../../lib/space-theme"
import { type GrayScaleName } from "../../lib/color-scales"
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
  const storedGray = readGray(group.data?.gray)
  const storedRadius = readRadius(group.data?.radius)
  const storedSurfaces = readSurfaces(group.data?.surfaces)
  const [colorChoice, setColorChoice] = useState<string | null>(storedColor)
  const [tintChoice, setTintChoice] = useState<number | null>(storedTint)
  const [grayChoice, setGrayChoice] = useState<GrayScaleName | null>(storedGray)
  const [radiusChoice, setRadiusChoice] = useState<RadiusStep | null>(storedRadius)
  const [surfacesChoice, setSurfacesChoice] = useState<Surfaces | null>(storedSurfaces)
  useEffect(() => { setColorChoice(storedColor) }, [storedColor])
  useEffect(() => { setTintChoice(storedTint) }, [storedTint])
  useEffect(() => { setGrayChoice(storedGray) }, [storedGray])
  useEffect(() => { setRadiusChoice(storedRadius) }, [storedRadius])
  useEffect(() => { setSurfacesChoice(storedSurfaces) }, [storedSurfaces])

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
          setGrayChoice(readGray(groupRef.current.data?.gray))
          setRadiusChoice(readRadius(groupRef.current.data?.radius))
          setSurfacesChoice(readSurfaces(groupRef.current.data?.surfaces))
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
  const groupRef = useRef(group)
  groupRef.current = group
  const storedColorRef = useRef(storedColor)
  storedColorRef.current = storedColor
  const storedTintRef = useRef(storedTint)
  storedTintRef.current = storedTint

  const effectiveColor = getSpacePrimaryColor(group.id, colorChoice)
  // Ohne eigene Achsen erbt der Space die der Instanz (Kaskade). Die Regler
  // zeigen, was gilt. Eine explizite Toenung 0 bleibt 0 ("keine Toenung");
  // nur der Reset schreibt null und stellt die Vererbung wieder her.
  const inherited = instanceTheme()
  const inheritedTint = inherited.tint ?? 0
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
  const effectiveGray: GrayScaleName | null = grayChoice ?? inherited.gray ?? null
  const setGray = (gray: GrayScaleName | null) => {
    setGrayChoice(gray)
    write({ gray })
  }
  const effectiveRadius: RadiusStep = radiusChoice ?? inherited.radius ?? "medium"
  const effectiveSurfaces: Surfaces = surfacesChoice ?? inherited.surfaces ?? "translucent"
  const setRadius = (radius: RadiusStep) => {
    setRadiusChoice(radius)
    write({ radius })
  }
  const setSurfaces = (surfaces: Surfaces) => {
    setSurfacesChoice(surfaces)
    write({ surfaces })
  }
  /** EIN Reset fuer alles, was der Space am Aussehen gesetzt hat. */
  const reset = () => {
    setColorChoice(null)
    setTintChoice(null)
    setGrayChoice(null)
    setRadiusChoice(null)
    setSurfacesChoice(null)
    write({ primaryColor: null, tint: null, gray: null, radius: null, surfaces: null })
  }

  const scheme = useColorScheme()
  const checks = useMemo(() => {
    const scales = scalesForColor(effectiveColor, scheme, { tint: effectiveTint, gray: effectiveGray })
    return contrastChecks(themeTokens({ ...scales, scheme }), { accentOnly: true })
  }, [effectiveColor, scheme, effectiveTint, effectiveGray])
  // Akzent-Raster: welche Radix-Skala gilt gerade — oder eine eigene Farbe?
  const accentName = matchAccentScale(effectiveColor, "light")
  const [customOpen, setCustomOpen] = useState(false)
  const showSliders = accentName === null || customOpen
  const setAccentScale = (hex: string) => {
    setCustomOpen(false)
    setColorChoice(hex)
    write({ primaryColor: hex })
  }

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
          <div className="truncate text-sm font-semibold">Theme</div>
          <div className="truncate text-xs text-muted-foreground">{group.name}</div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* Die Form des Radix-Playgrounds, Block fuer Block und mit seinen
            Woertern — wer den Playground kennt, findet sich sofort zurecht.
            Ohne Appearance und Scaling: die gehoeren dem Menschen am Geraet,
            nicht dem Space. Die Werte sind eine Stufe reicher als bei Radix:
            eine eigene Farbe neben den 25 Skalen, die Toenung neben den
            sechs Neutralen. Wer nur Radix-Werte nimmt, ist exakt bei Radix. */}
        <section className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Accent color</h3>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Accent color">
            {accentSwatches("light").map(({ name, hex }) => {
              const active = accentName === name && !customOpen
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`Accent ${name}`}
                  title={name}
                  onClick={() => setAccentScale(hex)}
                  style={{ backgroundColor: hex }}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110",
                    active && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                  )}
                >
                  {active && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              )
            })}
            {/* Die eigene Farbe — Logo-Farbe, Waehler, Regler. Das ist unsere
                Erweiterung; sie steht als ein Kreis neben den Skalen. */}
            <button
              type="button"
              role="radio"
              aria-checked={showSliders}
              aria-label="Accent eigene Farbe"
              title="Eigene Farbe"
              onClick={() => setCustomOpen(true)}
              style={accentName === null ? { backgroundColor: effectiveColor } : undefined}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary",
                showSliders && "border-solid border-foreground",
              )}
            >
              {accentName === null ? <Check className="h-3.5 w-3.5 text-white" /> : <span className="text-sm leading-none">+</span>}
            </button>
          </div>

          {showSliders && (
            <div className="space-y-2 pt-1">
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
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Gray color</h3>
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Gray color">
            <button
              type="button"
              role="radio"
              aria-checked={effectiveGray === null}
              aria-label="Gray auto"
              title="auto"
              onClick={() => setGray(null)}
              className={cn(
                "h-7 rounded-full border px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
                effectiveGray === null && "border-foreground text-foreground",
              )}
            >
              auto
            </button>
            {graySwatches(scheme).map(({ name, hex }) => {
              const active = effectiveGray === name
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`Gray ${name}`}
                  title={name}
                  onClick={() => setGray(name)}
                  style={{ backgroundColor: hex }}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110",
                    active && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                  )}
                >
                  {active && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              )
            })}
          </div>
          {/* Die Toenung — unsere Erweiterung neben Radix' Neutralen. 0 ist
              exakt Radix; reallife.network liegt mit seinem Creme bei 50. */}
          <label className="flex items-center gap-3 pt-1 text-xs">
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
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Radius</h3>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Rundung">
            {RADIUS_ORDER.map((step, i) => (
              <button
                key={step}
                type="button"
                role="radio"
                aria-checked={effectiveRadius === step}
                aria-label={`Rundung ${step}`}
                onClick={() => setRadius(step)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border p-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
                  effectiveRadius === step && "border-foreground text-foreground",
                )}
              >
                {/* Die Ecke, wie sie der Playground zeigt. */}
                <span
                  aria-hidden
                  className="block h-7 w-7 border-l-2 border-t-2 border-primary bg-primary/15"
                  style={{ borderTopLeftRadius: ["0px", "4px", "8px", "12px", "18px"][i] }}
                />
                {["None", "Small", "Medium", "Large", "Full"][i]}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Panel background</h3>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Flächen">
            {([["solid", "Solid"], ["translucent", "Translucent"]] as const).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={effectiveSurfaces === kind}
                aria-label={`Flächen ${kind}`}
                onClick={() => setSurfaces(kind)}
                className={cn(
                  "h-8 rounded-md border text-xs text-muted-foreground transition-colors hover:text-foreground",
                  effectiveSurfaces === kind && "border-foreground text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

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

        {(colorChoice != null || tintChoice != null || grayChoice != null || radiusChoice != null || surfacesChoice != null) && (
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
