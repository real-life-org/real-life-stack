/**
 * Zwölfstufige Farbskalen aus einer frei gewählten Farbe.
 *
 * Eine Skala ist kein Farbverlauf, sondern ein Satz Rollen: Stufe 1–2 tragen
 * Flächen, 3–5 Komponenten in Ruhe/Hover/aktiv, 6–8 Rahmen und Fokus, 9–10
 * die solide Füllung, 11–12 Text. Radix hat diese Abstufungen über Jahre
 * abgestimmt; frei zu interpolieren führte zu Skalen, die rechnerisch
 * stimmen und trotzdem schlecht aussehen.
 *
 * Darum wird hier nicht interpoliert, sondern eine erprobte Skala als
 * VORLAGE genommen und zur Wunschfarbe verschoben:
 *
 *  1. Die Vorlage ist die Skala, deren Stufe 9 der Wunschfarbe am nächsten
 *     liegt — gemessen über alle drei Achsen, nicht nur den Farbton. Nur so
 *     landet ein blasses Braun bei `bronze` und nicht bei `orange`, das
 *     denselben Farbton trägt, aber die vierfache Buntheit hat.
 *  2. Stufe 9 trifft die Wunschfarbe exakt.
 *  3. Die Enden bleiben, wo sie sind: Stufe 1 ist beinahe die Hintergrund-
 *     farbe des Schemas, Stufe 12 die Textfarbe. Verschöbe man sie mit,
 *     liefen helle Farben oben aus dem Bereich und die Skala verlöre ihren
 *     Zweck.
 *  4. Dazwischen wird die Verschiebung linear ausgeblendet.
 *
 * Gemessen an allen 25 Akzentskalen, und zwar strenger als im Betrieb: jede
 * Skala wird aus ihrer eigenen Stufe 9 rekonstruiert, ohne sich selbst als
 * Vorlage nehmen zu dürfen (siehe `color-scales.test.ts`).
 *
 *   hell    Mittel 0.0103, schlechtester Fall 0.0567 (orange8)
 *   dunkel  Mittel 0.0111, schlechtester Fall 0.0588 (amber8)
 *   Abstand zweier benachbarter Stufen: 0.0699 (hell) / 0.0747 (dunkel)
 *
 * Der mittlere Fehler ist also rund ein Siebtel eines Stufenabstands, und
 * auch der schlechteste Fall bleibt darunter: jede abgeleitete Stufe liegt
 * näher an ihrem Ziel als an der Nachbarstufe und trägt damit ihre Rolle
 * noch richtig. Im Betrieb ist der Fehler kleiner, weil dort die wirklich
 * nächste Vorlage zur Verfügung steht.
 */

import * as radix from "@radix-ui/colors"

import { oklchToHex, parseColor, type Oklch } from "./oklch"

/** Die zwölf Stufen einer Skala, Stufe 1 zuerst. */
export type ColorScale = readonly [
  string, string, string, string, string, string,
  string, string, string, string, string, string,
]

export type ColorScheme = "light" | "dark"

/**
 * Die neutralen Skalen. Sie stehen NEBEN den Akzentfarben und kommen als
 * Vorlage nicht in Frage: ihre Stufe 9 ist beinahe unbunt, jede bunte
 * Wunschfarbe würde beim Verschieben grotesk übersättigt.
 */
const GRAY_SCALE_NAMES = ["gray", "mauve", "slate", "sage", "olive", "sand"] as const

export type GrayScaleName = (typeof GRAY_SCALE_NAMES)[number]

/** Alle Akzentskalen, die Radix mitbringt — die möglichen Vorlagen. */
export const ACCENT_SCALE_NAMES: readonly string[] = Object.keys(radix)
  .filter((key) => /^[a-z]+$/.test(key))
  .filter((key) => !(GRAY_SCALE_NAMES as readonly string[]).includes(key))
  .filter((key) => `${key}1` in (radix as Record<string, Record<string, string>>)[key])
  .sort()

export const GRAY_SCALE_OPTIONS: readonly GrayScaleName[] = GRAY_SCALE_NAMES

/**
 * Ab welcher Buntheit eine Farbe als bunt gilt. Die neutralen Radix-Skalen
 * bleiben unter diesem Wert; alles darunter wird wie Grau behandelt.
 */
const NEUTRAL_CHROMA = 0.03
/** Unter dieser Helligkeit ist eine Füllung auf dunklem Grund dumpf. */
const DARK_FILL_LIGHTNESS_MIN = 0.6
/** Buntheit der neutralen Skala bei voller Tönung — gerade noch "neutral". */
const TINT_CHROMA_MAX = 0.03

/**
 * Eine benannte Radix-Skala als Hex-Werte.
 *
 * Die Dark-Variante nutzt DIESELBEN Schlüsselnamen wie die helle
 * (`jadeDark` enthält `jade1`…`jade12`) — sie ist als Überschreibung
 * derselben CSS-Variablen gedacht.
 */
export function namedScale(name: string, scheme: ColorScheme): ColorScale {
  const table = (radix as Record<string, Record<string, string>>)[
    scheme === "dark" ? `${name}Dark` : name
  ]
  if (!table) throw new Error(`Unbekannte Farbskala: ${name}`)
  return Array.from({ length: 12 }, (_, i) => table[`${name}${i + 1}`]) as unknown as ColorScale
}

/** Kürzester Abstand zweier Farbtöne auf dem Kreis, in Grad. */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Abstand zweier Farben. Der Farbton zählt nach Buntheit gewichtet: bei
 * zwei nahezu unbunten Farben ist er bedeutungslos, bei zwei kräftigen
 * entscheidet er.
 */
export function colorDistance(a: Oklch, b: Oklch): number {
  const hueWeight = (hueDistance(a.h, b.h) / 180) * Math.min(a.c, b.c) * 2
  return Math.hypot(a.l - b.l, a.c - b.c, hueWeight)
}

function toOklch(hex: string): Oklch {
  const parsed = parseColor(hex)
  if (!parsed) throw new Error(`Unlesbare Farbe: ${hex}`)
  return parsed
}

/**
 * Der Grauton, der eine Akzentfarbe ergänzt.
 *
 * Radix paart beides automatisch („Your accent color will be automatically
 * paired with a gray shade that complements it"): die sechs Neutralen tragen
 * je einen Hauch Farbton — `mauve` rötlich, `slate` bläulich, `sage`
 * grünlich, `olive` gelbgrün, `sand` gelb — und `gray` gar keinen.
 *
 * Gewählt wird nach dem Farbton der eigenen Stufe 9. Der Unterschied ist
 * klein: die Neutralen liegen untereinander rund siebenmal enger als zwei
 * benachbarte Stufen einer Skala. Er gestaltet darum nichts, er verhindert
 * nur, dass ein warmer Akzent auf kalten Flächen steht.
 */
export function grayFor(accent: Oklch): GrayScaleName {
  // Ohne Farbton gibt es nichts zu ergänzen.
  if (accent.c < NEUTRAL_CHROMA) return "gray"

  let best: GrayScaleName = "gray"
  let bestDistance = Infinity
  for (const name of GRAY_SCALE_NAMES) {
    const reference = toOklch(namedScale(name, "light")[8])
    // `gray` ist unbunt und hat keinen sinnvollen Farbton — es bleibt der
    // Fall für unbunte Akzente, nicht die Ergänzung für bunte.
    if (reference.c < 0.0005) continue
    const distance = hueDistance(accent.h, reference.h)
    if (distance < bestDistance) {
      bestDistance = distance
      best = name
    }
  }
  return best
}

/**
 * Die Vorlage für eine Wunschfarbe: die Skala mit der ähnlichsten Stufe 9.
 *
 * `exclude` dient dem Prüfstein — er misst, wie gut die Ableitung eine
 * Skala trifft, die sie NICHT als Vorlage haben darf.
 */
export function pickTemplate(target: Oklch, exclude?: string): string {
  // Eine unbunte Wunschfarbe braucht eine unbunte Vorlage. Jede Akzentskala
  // traegt ihre eigene Buntheit in den Enden mit, die die Verschiebung nicht
  // erreicht — aus Weiss wurde so eine Skala mit rosa Textstufe.
  if (target.c < NEUTRAL_CHROMA) return "gray"

  let best = ACCENT_SCALE_NAMES[0]
  let bestDistance = Infinity
  for (const name of ACCENT_SCALE_NAMES) {
    if (name === exclude) continue
    const distance = colorDistance(target, toOklch(namedScale(name, "light")[8]))
    if (distance < bestDistance) {
      bestDistance = distance
      best = name
    }
  }
  return best
}

/**
 * Wie stark eine Stufe der Buntheits-Verschiebung folgt. Stufe 9 ganz, die
 * beiden Enden gar nicht, dazwischen linear.
 *
 * Nach unten sind es acht Stufen bis zum Ende, nach oben nur drei — die
 * Textstufen 11 und 12 liegen dichter an der Füllung und müssen schneller
 * zur Ruhe kommen, sonst färbt eine kräftige Wunschfarbe den Fließtext ein.
 */
function weightFor(index: number): number {
  const anchor = 8
  const span = index < anchor ? anchor : 11 - anchor
  return 1 - Math.min(1, Math.abs(index - anchor) / span)
}

/**
 * Wie weit sich die Helligkeitskurve verschieben lässt.
 *
 * Zwei Schranken wirken zusammen. Die erste ist inhaltlich: Stufe 9 ist eine
 * FÜLLFLÄCHE, sie trägt Text und hat Stufen über wie unter sich. Radix' eigene
 * Stufe 9 liegt darum ausnahmslos zwischen 0.540 und 0.918 — fast schwarz oder
 * fast weiß kann sie nicht sein. `FILL_LIGHTNESS_MIN`/`MAX` lassen etwas mehr
 * Spielraum nach unten (0.42), weil dunkle Wunschfarben verbreitet sind: der
 * Demo-Space „Money Printer" trägt `#2d5a3d` mit 0.44.
 *
 * Die zweite ist rechnerisch: keine Stufe darf aus dem darstellbaren Bereich
 * laufen.
 *
 * Das ist die eigentliche Schranke — keine gesetzte Zahl, sondern eine, die
 * aus der Vorlage folgt. Verschöbe man weiter, klemmten die äußeren Stufen
 * bei 0 oder 1 und fielen auf denselben Wert: bei `#ffffff` waren die
 * Stufen 2 bis 8 alle reines Weiß, bei `#000000` die Stufen 7 und 8 beide
 * `#010000` — normaler und hervorgehobener Rahmen nicht mehr zu
 * unterscheiden.
 *
 * Die Wunschfarbe behält dabei Farbton und Buntheit; nur ihre Helligkeit
 * wird so weit zurückgenommen, dass die Skala ihre Rollen noch trägt. Eine
 * Fläche, die Text tragen soll und über wie unter sich weitere Stufen hat,
 * kann eben nicht fast schwarz oder fast weiß sein.
 */
const FILL_LIGHTNESS_MIN = 0.42
const FILL_LIGHTNESS_MAX = 0.92

/** Kleinster Abstand, bei dem zwei Stufen verschiedene Hex-Werte ergeben. */
const MIN_LIGHTNESS_STEP = 0.004

/**
 * Hält die Reihenfolge der Vorlage ein.
 *
 * Die Verschiebung ist nach Stufe gewichtet — Stufe 9 folgt ihr ganz, die
 * Enden gar nicht. Dadurch kann eine Stufe ihre Vorgängerin überholen: bei
 * `#ffffff` blieb Stufe 1 bei der Vorlage stehen, während Stufe 2 nach oben
 * wanderte und heller wurde als sie. Hier bekommt jede Stufe mindestens
 * einen Hex-Schritt Abstand zur vorigen, in der Richtung, die die Vorlage
 * vorgibt. Im Normalfall ist der Abstand ohnehin größer und nichts ändert
 * sich.
 */
function keepOrder(lightness: readonly number[], template: readonly Oklch[]): number[] {
  const out = [...lightness]
  for (let i = 1; i < out.length; i++) {
    const direction = Math.sign(template[i].l - template[i - 1].l)
    if (direction === 0) continue
    const bound = out[i - 1] + direction * MIN_LIGHTNESS_STEP
    out[i] = direction > 0 ? Math.max(out[i], bound) : Math.min(out[i], bound)
  }
  return out.map((l) => Math.max(0, Math.min(1, l)))
}

function allowedShift(template: readonly Oklch[], wanted: number): number {
  let limit = Infinity
  template.forEach((step, index) => {
    const weight = weightFor(index)
    if (weight <= 0) return
    const room = wanted > 0 ? 1 - step.l : step.l
    limit = Math.min(limit, room / weight)
  })
  const magnitude = Math.min(Math.abs(wanted), limit)
  return wanted > 0 ? magnitude : -magnitude
}

export interface DeriveOptions {
  /** Nur für den Prüfstein: diese Skala nicht als Vorlage zulassen. */
  excludeTemplate?: string
}

/**
 * Leitet aus einer Farbe eine zwölfstufige Skala ab. Die Farbe landet auf
 * Stufe 9, der soliden Füllung — dort, wo eine Akzentfarbe wirkt.
 */
export function deriveColorScale(
  color: string,
  scheme: ColorScheme,
  options: DeriveOptions = {},
): ColorScale {
  const target = toOklch(color)
  const templateName = pickTemplate(target, options.excludeTemplate)
  const template = namedScale(templateName, scheme).map(toOklch)
  const anchor = template[8]

  // Erst auf den Bereich ziehen, in dem eine Füllfläche liegen kann, dann
  // die Verschiebung so begrenzen, dass keine Stufe klemmt.
  //
  // Im dunklen Schema liegt die Untergrenze höher: eine dunkle Farbe auf
  // dunklem Grund ist dumpf. Radix umgeht das, weil seine kuratierten Skalen
  // Stufe 9 nie so tief legen; wir lassen jede Farbe zu, also steht die Regel
  // hier. reallife.network/app macht es von Hand — hell Forest (L 0.42),
  // dunkel Sage (L 0.64). Im hellen Schema bleibt die Farbe, wie gewählt.
  const floor = scheme === "dark" ? DARK_FILL_LIGHTNESS_MIN : FILL_LIGHTNESS_MIN
  const fillL = Math.min(FILL_LIGHTNESS_MAX, Math.max(floor, target.l))
  const deltaL = allowedShift(template, fillL - anchor.l)
  const deltaH = target.h - anchor.h
  // Buntheit wird verhältnismäßig verschoben; eine Vorlage mit nahezu
  // unbunter Stufe 9 hat kein brauchbares Verhältnis und bleibt, wie sie ist.
  const ratioC = anchor.c > 0.001 ? target.c / anchor.c : 1


  const lightness = keepOrder(
    template.map((step, index) => step.l + deltaL * weightFor(index)),
    template,
  )

  return template.map((step, index) => {
    const weight = weightFor(index)
    return oklchToHex({
      l: lightness[index],
      c: Math.max(0, step.c * (1 + (ratioC - 1) * weight)),
      // Der Farbton dreht UNGEDAEMPFT mit: eine Skala ist eine Farbfamilie,
      // und ihre Textstufen gehoeren derselben an wie ihre Flaechen. Gedaempft
      // behielten Stufe 11 und 12 den Ton der Vorlage — der Fliesstext eines
      // rosa Space schimmerte dann rot.
      h: (step.h + deltaH + 360) % 360,
    })
  }) as unknown as ColorScale
}

/**
 * Beide Skalen für eine Farbe — das, was die Anwendung wirklich braucht.
 *
 * Die Akzentskala entsteht aus der Farbe, die neutrale wird dazu gewählt.
 * Als eine Funktion, damit kein Aufrufer die Paarung vergisst und damit
 * niemand außerhalb mit OKLCH hantieren muss.
 */
export interface ScaleOptions {
  /**
   * Tönung der neutralen Skala, 0–1. Bei 0 bleibt Radix' Paarung; bei 1
   * tragen alle Flächen den Farbton des Akzents so kräftig, wie es noch als
   * neutral durchgeht. reallife.network/app liegt mit seinem Creme bei
   * ungefähr 0.5.
   */
  tint?: number
}

export function scalesForColor(
  color: string,
  scheme: ColorScheme,
  options: ScaleOptions = {},
): { accent: ColorScale; gray: ColorScale } {
  const parsed = parseColor(color)
  const gray = namedScale(parsed ? grayFor(parsed) : "gray", scheme)
  const tint = clampTint(options.tint)
  // Eine unbunte Akzentfarbe hat keinen Farbton, der etwas bedeutet — bei
  // #808080 liegt er zufaellig bei Rosa. Getoent wird nur, wenn der Akzent
  // wirklich einen Ton hat (dieselbe Schwelle wie bei der Vorlagenwahl).
  const tintable = parsed !== null && parsed.c >= NEUTRAL_CHROMA
  return {
    accent: deriveColorScale(color, scheme),
    gray: tintable && tint > 0 ? tintGray(gray, parsed.h, tint) : gray,
  }
}

/** Der Wert kommt aus `Group.data` und ist ungeprüft. */
function clampTint(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

/**
 * Färbt eine neutrale Skala im gegebenen Farbton. Die Helligkeit jeder Stufe
 * bleibt, wie Radix sie gesetzt hat — getönt wird, nicht verschoben; so
 * gelten alle Kontraste der Paarung weiter.
 */
function tintGray(gray: ColorScale, hue: number, tint: number): ColorScale {
  return gray.map((hex) =>
    oklchToHex({ l: toOklch(hex).l, c: TINT_CHROMA_MAX * tint, h: hue }),
  ) as unknown as ColorScale
}

/** Was von Hand gesetzt wurde: Stufennummer (1–12) auf Hex-Wert. */
export type ScaleOverrides = Record<number | string, string>

/**
 * Einzelne Stufen von Hand setzen.
 *
 * Die Ableitung ist gut, aber nicht allwissend — manchmal will ein Space
 * genau diesen einen Ton. Überschrieben wird darum stufenweise und nicht
 * als ganze Skala: was gesetzt ist, gilt; was fehlt, kommt weiter aus der
 * Ableitung. Wird die Ableitung später besser, wirkt das auch in Spaces,
 * die eine Stufe angefasst haben.
 *
 * Die Werte kommen über `Group.data` aus dem Sync und sind damit ungeprüft:
 * unbekannte Stufen und unlesbare Farben werden still übergangen, statt die
 * Oberfläche eines Space unbrauchbar zu machen.
 */
export function withOverrides(
  scale: ColorScale,
  overrides: ScaleOverrides | undefined,
): ColorScale {
  if (!overrides) return scale
  const out = [...scale]
  let touched = false
  for (const [key, value] of Object.entries(overrides)) {
    const n = Number(key)
    if (!Number.isInteger(n) || n < 1 || n > 12) continue
    const parsed = typeof value === "string" ? parseColor(value) : null
    if (!parsed) continue
    // Normalisiert, damit die Skala durchgehend dasselbe Format trägt.
    out[n - 1] = oklchToHex(parsed)
    touched = true
  }
  return touched ? (out as unknown as ColorScale) : scale
}
