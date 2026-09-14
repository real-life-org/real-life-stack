"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Check, Copy, Download, Moon, RotateCcw, Sun, TriangleAlert } from "lucide-react"

import { Button } from "../primitives/button"
import { cn } from "@/lib/utils"
import { observeColorScheme, resolveColorScheme, type ColorScheme } from "@/lib/color-scheme"
import { contrastLevel, formatOklch, oklchToHex, oklchToRgb, parseColor, type Oklch } from "@/lib/oklch"
import {
  applyTweaks,
  contrastReport,
  EMPTY_TWEAKS,
  hasTweaks,
  IDENTITY,
  isIdentity,
  loadStoredTweaks,
  readBaseTokens,
  resolveToken,
  storeTweaks,
  TOKEN_GROUPS,
  toThemeJson,
  type GlobalAdjust,
  type SchemeTweaks,
  type ThemeTweaks,
} from "@/lib/theme-tweaks"

export interface ThemeTweakerProps {
  /**
   * Schaltet zwischen hell und dunkel um. Die Klasse `dark` gehoert der App
   * (App.tsx haelt sie als Zustand); das Panel setzt sie darum nicht selbst,
   * sondern bittet den Aufrufer. Ohne Handler gibt es keinen Umschalter.
   */
  onToggleScheme?: () => void
  className?: string
}

/**
 * Regler fuer die Farbtokens des Toolkits — live, mit Werten, und am Ende
 * eine `theme.json` fuer die eigene Instanz (Spec 11).
 *
 * Content-only wie das DebugDashboard: wird in das geteilte Modul-Panel der
 * App gelegt oder in Storybook neben die Story.
 *
 * Bearbeitet wird immer das gerade sichtbare Schema. Beide Schemata werden
 * gehalten und gemeinsam exportiert — wer hell fertig hat und auf dunkel
 * wechselt, verliert nichts.
 */
export function ThemeTweaker({ onToggleScheme, className }: ThemeTweakerProps) {
  const [scheme, setScheme] = useState<ColorScheme>(() => resolveColorScheme())
  const [tweaks, setTweaks] = useState<ThemeTweaks>(() => loadStoredTweaks() ?? EMPTY_TWEAKS)
  const [bases, setBases] = useState<Partial<Record<ColorScheme, Record<string, Oklch>>>>({})
  const [raw, setRaw] = useState<Record<string, string>>({})
  const [openToken, setOpenToken] = useState<string | null>(null)

  // Basis des aktiven Schemas lesen — beim Mount und bei jedem Wechsel.
  const readBase = useCallback((s: ColorScheme) => {
    const { colors, raw } = readBaseTokens()
    setBases((prev) => ({ ...prev, [s]: colors }))
    setRaw(raw)
  }, [])

  useEffect(() => {
    readBase(scheme)
    return observeColorScheme((next) => {
      setScheme(next)
      setOpenToken(null)
      // Erst nach dem Umschalten lesen: die Klasse steht schon, das CSS des
      // neuen Schemas gilt bereits.
      readBase(next)
    })
  }, [readBase, scheme])

  // Jede Aenderung sofort auf das Dokument und in die Ablage.
  useEffect(() => {
    applyTweaks(tweaks, bases)
    storeTweaks(tweaks)
  }, [tweaks, bases])

  const base = bases[scheme] ?? {}
  const current = tweaks[scheme]

  const updateScheme = (patch: (s: SchemeTweaks) => SchemeTweaks) =>
    setTweaks((t) => ({ ...t, [scheme]: patch(t[scheme]) }))

  const setGlobal = (key: keyof GlobalAdjust, value: number) =>
    updateScheme((s) => ({ ...s, global: { ...s.global, [key]: value } }))

  const setToken = (name: string, color: Oklch) =>
    updateScheme((s) => ({ ...s, tokens: { ...s.tokens, [name]: color } }))

  const resetToken = (name: string) =>
    updateScheme((s) => {
      const tokens = { ...s.tokens }
      delete tokens[name]
      return { ...s, tokens }
    })

  const resetScheme = () => updateScheme(() => ({ tokens: {}, global: IDENTITY }))
  const resetAll = () => setTweaks(EMPTY_TWEAKS)

  const report = useMemo(() => contrastReport(base, current), [base, current])
  const failing = report.filter((r) => !r.ok).length
  const json = useMemo(() => JSON.stringify(toThemeJson(tweaks, bases), null, 2), [tweaks, bases])
  const dirty = hasTweaks(tweaks)

  return (
    <div className={cn("@container text-sm", className)}>
      {/* Kopf — pr-24 laesst Platz fuer die absoluten Knoepfe des AdaptivePanel */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-3 py-2 pr-24">
        <span className="text-xs font-semibold">Design</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {scheme === "dark" ? "dunkel" : "hell"}
        </span>
        {onToggleScheme && (
          <Button variant="ghost" size="icon-sm" onClick={onToggleScheme} title="Schema wechseln" aria-label="Schema wechseln">
            {scheme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </Button>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {failing > 0 ? (
            <span className="inline-flex items-center gap-1 text-destructive">
              <TriangleAlert className="size-3" /> {failing} Kontrast{failing === 1 ? "" : "e"} zu schwach
            </span>
          ) : (
            <span className="inline-flex items-center gap-1"><Check className="size-3" /> Kontraste ok</span>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-3">
        <Section title="Global" hint="wirkt auf alle Tokens dieses Schemas">
          <Slider label="Helligkeit" value={current.global.lightness} min={-0.3} max={0.3} step={0.005} digits={3} onChange={(v) => setGlobal("lightness", v)} />
          <Slider label="Kontrast" value={current.global.contrast} min={0.5} max={1.5} step={0.01} digits={2} onChange={(v) => setGlobal("contrast", v)} />
          <Slider label="Sättigung" value={current.global.chroma} min={0} max={2} step={0.01} digits={2} onChange={(v) => setGlobal("chroma", v)} />
          <Slider label="Farbton" value={current.global.hue} min={-180} max={180} step={1} digits={0} unit="°" onChange={(v) => setGlobal("hue", v)} />
          {!isIdentity(current.global) && (
            <Button variant="ghost" size="sm" className="self-start text-xs" onClick={() => updateScheme((s) => ({ ...s, global: IDENTITY }))}>
              <RotateCcw className="size-3" /> Regler zurück
            </Button>
          )}
        </Section>

        <Section title="Kontraste" hint="WCAG 2 · Text 4.5 · Rahmen/Groß 3">
          <ul className="flex flex-col gap-1">
            {report.map((r) => (
              <li key={`${r.fg}/${r.bg}`} className="flex items-center gap-2 text-xs">
                <PairSwatch fg={resolveToken(r.fg, base, current)} bg={resolveToken(r.bg, base, current)} />
                <span className="flex-1 truncate">{r.label}</span>
                <span className={cn("tabular-nums", r.ok ? "text-muted-foreground" : "font-medium text-destructive")}>
                  {r.ratio.toFixed(2)}
                </span>
                <span
                  className={cn(
                    "w-12 rounded px-1 text-center text-[10px] font-medium",
                    r.ok ? "bg-muted text-muted-foreground" : "bg-destructive/15 text-destructive",
                  )}
                >
                  {r.ok ? contrastLevel(r.ratio) : "✗"}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {TOKEN_GROUPS.map((group) => (
          <details key={group.id} open={group.id === "brand"} className="group/g">
            <summary className="cursor-pointer select-none text-xs font-semibold text-muted-foreground">
              {group.label}
              <span className="ml-1 font-normal">
                ({group.tokens.filter((t) => t.name in current.tokens).length}/{group.tokens.length} geändert)
              </span>
            </summary>
            <ul className="mt-1 flex flex-col">
              {group.tokens.map((t) => {
                const resolved = resolveToken(t.name, base, current)
                return (
                  <TokenRow
                    key={t.name}
                    name={t.name}
                    label={t.label}
                    raw={raw[t.name] ?? ""}
                    base={base[t.name]}
                    edited={current.tokens[t.name]}
                    resolved={resolved}
                    open={openToken === t.name}
                    onOpen={() => setOpenToken(openToken === t.name ? null : t.name)}
                    onChange={(c) => setToken(t.name, c)}
                    onReset={() => resetToken(t.name)}
                  />
                )
              })}
            </ul>
          </details>
        ))}

        <Section title="theme.json" hint="nach deploy/app/branding/ legen">
          <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] leading-snug">{json}</pre>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={json} disabled={!dirty} />
            <Button variant="outline" size="sm" className="text-xs" disabled={!dirty} onClick={() => download("theme.json", json)}>
              <Download className="size-3" /> Herunterladen
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" disabled={!dirty} onClick={resetScheme}>
              <RotateCcw className="size-3" /> {scheme === "dark" ? "Dunkel" : "Hell"} zurücksetzen
            </Button>
            <Button variant="ghost" size="sm" className="text-xs text-destructive" disabled={!dirty} onClick={resetAll}>
              Alles zurücksetzen
            </Button>
          </div>
        </Section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground">
        {title}
        {hint && <span className="ml-1 font-normal">· {hint}</span>}
      </h3>
      {children}
    </section>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  digits: number
  unit?: string
  onChange: (v: number) => void
}

/**
 * Regler mit Zahl daneben — beide bearbeitbar. Native `range`, weil ein
 * Radix-Slider hier nur Gewicht braechte: keine Tastatur-Feinheiten, die
 * `<input type=range>` nicht schon kann.
 */
function Slider({ label, value, min, max, step, digits, unit, onChange }: SliderProps) {
  const id = `tw-${label.replace(/\W+/g, "-")}`
  return (
    <div className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2">
      <label htmlFor={id} className="truncate text-xs text-muted-foreground">{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-primary"
      />
      <span className="flex items-center gap-0.5">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number(value.toFixed(digits))}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
          }}
          className="h-6 w-full rounded border border-input bg-background px-1 text-right font-mono text-[11px] tabular-nums"
        />
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </span>
    </div>
  )
}

interface TokenRowProps {
  name: string
  label: string
  raw: string
  base?: Oklch
  edited?: Oklch
  resolved?: Oklch
  open: boolean
  onOpen: () => void
  onChange: (c: Oklch) => void
  onReset: () => void
}

function TokenRow({ name, label, raw, base, edited, resolved, open, onOpen, onChange, onReset }: TokenRowProps) {
  // Der Regler bewegt den Einzelwert (vor den globalen Reglern) — sonst
  // liefe er der Anzeige hinterher, sobald ein globaler Regler steht.
  const working = edited ?? base
  const gamut = resolved ? oklchToRgb(resolved).inGamut : true

  return (
    <li className={cn("rounded-md", open && "bg-muted/60")}>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted"
        aria-expanded={open}
      >
        <Swatch color={resolved} />
        <span className="flex-1 truncate text-xs">
          {label}
          <span className="ml-1 font-mono text-[10px] text-muted-foreground">--{name}</span>
        </span>
        {edited && <span className="size-1.5 rounded-full bg-primary" title="geändert" />}
        {!gamut && <TriangleAlert className="size-3 text-warning" aria-label="außerhalb des sRGB-Farbraums" />}
        <span className="font-mono text-[10px] text-muted-foreground">{resolved ? oklchToHex(resolved) : "—"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 px-1.5 pb-2 pt-1">
          {working ? (
            <>
              <Slider label="L · Hell" value={working.l} min={0} max={1} step={0.005} digits={3} onChange={(l) => onChange({ ...working, l })} />
              <Slider label="C · Bunt" value={working.c} min={0} max={0.4} step={0.002} digits={3} onChange={(c) => onChange({ ...working, c })} />
              <Slider label="H · Ton" value={working.h} min={0} max={360} step={0.5} digits={1} unit="°" onChange={(h) => onChange({ ...working, h })} />
              <RawInput value={edited ? formatOklch(edited) : raw} onCommit={(c) => onChange(c)} />
              {!gamut && (
                <p className="text-[10px] text-warning">
                  Außerhalb des sRGB-Farbraums — der Bildschirm zeigt die nächste darstellbare Farbe.
                </p>
              )}
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Wert nicht als Farbe lesbar: <code className="font-mono">{raw || "(leer)"}</code>
            </p>
          )}
          <div className="flex items-center gap-2">
            {base && <span className="text-[10px] text-muted-foreground">Basis {formatOklch(base)}</span>}
            {edited && (
              <Button variant="ghost" size="sm" className="ml-auto h-6 text-[11px]" onClick={onReset}>
                <RotateCcw className="size-3" /> zurück
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

/** Freitext fuer den Wert — jede CSS-Farbe, die der Parser kennt. Uebernommen bei Enter oder Verlassen. */
function RawInput({ value, onCommit }: { value: string; onCommit: (c: Oklch) => void }) {
  const [text, setText] = useState(value)
  const [bad, setBad] = useState(false)
  useEffect(() => {
    setText(value)
    setBad(false)
  }, [value])
  const commit = () => {
    const parsed = parseColor(text)
    if (parsed) onCommit(parsed)
    setBad(!parsed)
  }
  return (
    <input
      type="text"
      value={text}
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit()
      }}
      aria-invalid={bad || undefined}
      className={cn(
        "h-6 w-full rounded border border-input bg-background px-1.5 font-mono text-[11px]",
        bad && "border-destructive",
      )}
      title="oklch(), #hex, rgb(), hsl()"
    />
  )
}

function Swatch({ color, className }: { color?: Oklch; className?: string }) {
  return (
    <span
      className={cn("size-5 shrink-0 rounded border border-border", className)}
      style={color ? { backgroundColor: formatOklch(color) } : { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 3px, currentColor 3px 4px)", opacity: 0.3 }}
    />
  )
}

/** Vordergrund als "Aa" auf dem Hintergrund — der Kontrast, wie er aussieht, neben der Zahl. */
function PairSwatch({ fg, bg }: { fg?: Oklch; bg?: Oklch }) {
  return (
    <span
      className="flex h-5 w-8 shrink-0 items-center justify-center rounded border border-border text-[10px] font-semibold"
      style={{ backgroundColor: bg ? formatOklch(bg) : undefined, color: fg ? formatOklch(fg) : undefined }}
    >
      Aa
    </span>
  )
}

function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      timer.current = setTimeout(() => setDone(false), 1500)
    } catch {
      // Ohne Zwischenablage (unsicherer Kontext) bleibt der Text im <pre> markierbar.
    }
  }
  return (
    <Button variant="outline" size="sm" className="text-xs" disabled={disabled} onClick={copy}>
      {done ? <Check className="size-3" /> : <Copy className="size-3" />} {done ? "Kopiert" : "Kopieren"}
    </Button>
  )
}

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }))
  const a = Object.assign(document.createElement("a"), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
