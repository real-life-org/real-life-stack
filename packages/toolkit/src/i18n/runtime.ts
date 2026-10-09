/**
 * i18n-Laufzeit des Toolkits — eine dünne Schicht über `Intl`.
 *
 * **Warum kein i18next:** das Toolkit ist eine Bibliothek. Es besitzt die
 * Texte, die es selbst rendert, und darf dafür keine Initialisierung der
 * Host-App voraussetzen — die App, die sie vergisst, zeigt sonst rohe
 * Schlüssel. Plural entscheidet `Intl.PluralRules`, Datum und Zeit formatiert
 * `Intl.DateTimeFormat`; was hier liegt, ist nur Nachschlagen, Platzhalter und
 * der Sprachzustand. Die Wörterbücher sind 1:1 nach JSON übersetzbar, damit
 * ein späterer Wechsel zu einem Übersetzungswerkzeug den Bestand behält.
 *
 * **Vorrangkette der Sprache:** Nutzerwahl (localStorage) → Instanz-Vorgabe
 * (`config.json`, siehe {@link applyLanguageConfig}) → Browsersprache → `de`.
 *
 * **Vorrangkette je Text:** Instanz-Override → App-Erweiterung → Toolkit-
 * Wörterbuch → deutsche Referenz. Die Instanz-Ebene ist kein Randfall,
 * sondern der White-Label-Kern: eine Instanz muss „Gruppe" in „Kreis"
 * umbenennen können, ohne einen Build anzufassen.
 */
import { de, type AppMessages, type Message, type MessageKey, type ToolkitMessageKey } from "./de"
import { en } from "./en"

export type { AppMessages, Message, MessageKey, ToolkitMessageKey }

export type Language = "de" | "en"

export const SUPPORTED_LANGUAGES: readonly Language[] = ["de", "en"]

const STORAGE_KEY = "rls.language"

const builtin: Record<Language, Record<string, Message>> = { de, en }

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function storedLanguage(): Language | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY)
    return isLanguage(raw) ? raw : null
  } catch {
    return null // Safari-Privatmodus u.ä. — Zugriff darf die App nie kosten.
  }
}

function browserLanguage(): Language | null {
  if (typeof navigator === "undefined") return null
  // Nur der primäre Subtag zählt: `en-US` und `en-GB` sind beide unser `en`.
  const primary = (navigator.language ?? "").toLowerCase().split("-")[0]
  return isLanguage(primary) ? primary : null
}

/**
 * Formatierungs-Locale ≠ Nachrichtensprache (rls#289).
 *
 * `en` wählt das Wörterbuch — aber ein `en-GB`-Browser erwartet `18/08/2026`,
 * kein `8/18/26`. Für `Intl` bleibt deshalb die volle regionale Locale des
 * Browsers erhalten, sofern ihr primärer Subtag zur gewählten Sprache passt;
 * erst wenn keine passt (deutscher Browser, englisch gewählt), fällt die
 * Formatierung auf die nackte Sprache zurück.
 */
function resolveLocale(language: Language): string {
  if (typeof navigator !== "undefined") {
    const candidates = navigator.languages ?? [navigator.language]
    for (const tag of candidates) {
      if (typeof tag === "string" && tag.toLowerCase().split("-")[0] === language) return tag
    }
  }
  return language
}

/** Eine Text-Ebene je Sprache (App-Erweiterungen oder Instanz-Overrides). */
type Layer = Readonly<Record<Language, Readonly<Record<string, Message>>>>

/**
 * Eine Schlüssel-Map ohne Prototyp (rls#617): `toString`, `constructor`,
 * `__proto__` sind darin gewöhnliche Schlüssel — vorhanden nur, wenn jemand
 * sie einträgt — und eine Zuweisung an `__proto__` legt einen Eintrag an,
 * statt einen Prototyp zu setzen.
 */
/**
 * `Object.hasOwn` ohne ES2022-Lib: Apps, die Toolkit-Quellen mit älterem
 * `lib` prüfen (apps/network), und ältere WebViews kennen es nicht.
 */
function hasOwn(target: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(target, key)
}

function messageMap<V>(from?: Readonly<Record<string, V>>): Record<string, V> {
  const map = Object.create(null) as Record<string, V>
  if (from) for (const key of Object.keys(from)) map[key] = from[key]
  return map
}

/**
 * Nachschlagen nur unter EIGENEN Schlüsseln (rls#617). Das deckt auch die
 * eingebauten Wörterbücher ab, die gewöhnliche Objekte sind: ohne diese
 * Prüfung fand `lookup` für `toString` die geerbte Funktion und
 * `interpolate` warf.
 */
function own<V>(map: Readonly<Record<string, V>>, key: string): V | undefined {
  return hasOwn(map, key) ? map[key] : undefined
}

const EMPTY_LAYER: Layer = Object.freeze({ de: Object.freeze(messageMap<Message>()), en: Object.freeze(messageMap<Message>()) })

/**
 * Der gesamte veränderliche Zustand als EIN unveränderlicher Stand (rls#290).
 *
 * Jede Änderung — Sprache, App-Erweiterung, Instanz-Override — ersetzt den
 * Stand, statt ihn zu mutieren. Damit ist ein `I18n`-Bündel, das an einen
 * Stand gebunden ist, in sich konsistent (`language` und `t` können nicht
 * auseinanderlaufen), und `useSyncExternalStore` sieht an der Identität des
 * Bündels JEDE Änderung, nicht nur einen Sprachwechsel.
 */
interface State {
  readonly language: Language
  /** App-Erweiterungen ({@link extendMessages}) — unter dem Instanz-Override. */
  readonly extensions: Layer
  /** Instanz-Overrides ({@link applyLanguageConfig}) — oberste Ebene. */
  readonly overrides: Layer
  /**
   * Hat der Nutzer in dieser Sitzung ausdrücklich gewählt (oder liegt eine
   * gespeicherte Wahl vor)? Steht im Stand, nicht nur im localStorage: ist der
   * Speicher nicht beschreibbar, gilt die Wahl trotzdem die Sitzung über und
   * eine spätere Instanz-Vorgabe übersteuert sie nicht (rls#615).
   */
  readonly userChosen: boolean
}

function initialState(): State {
  const stored = storedLanguage()
  return {
    language: stored ?? browserLanguage() ?? "de",
    extensions: EMPTY_LAYER,
    overrides: EMPTY_LAYER,
    userChosen: stored !== null,
  }
}

let state: State = initialState()

/** Das zum aktuellen Stand gebundene Bündel — einmal je Stand gebaut. */
let bundle: I18n | null = null

const listeners = new Set<() => void>()

function commit(next: State): void {
  state = next
  bundle = null
  for (const listener of listeners) listener()
}

export function getLanguage(): Language {
  return state.language
}

/** Die Locale, mit der `Intl` formatiert — regional, nicht nur die Sprache. */
export function getLocale(): string {
  return getI18n().locale
}

/**
 * Nutzerwahl — ab sofort ranghöchste Stufe: für die Sitzung im Stand,
 * darüber hinaus im localStorage, sofern er beschreibbar ist.
 */
export function setLanguage(language: Language): void {
  if (!isLanguage(language)) return
  // Auch eine Wahl, die der aktuellen Sprache entspricht, ist eine Wahl: kam
  // die aktuelle Sprache vom Browser oder der Instanz-Vorgabe, muss sie ab
  // jetzt trotzdem vor einer späteren Instanz-Vorgabe stehen.
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, language)
  } catch {
    /* nicht persistierbar — für die laufende Sitzung gilt die Wahl trotzdem */
  }
  if (language !== state.language || !state.userChosen) {
    commit({ ...state, language, userChosen: true })
  }
}

/**
 * Benachrichtigt bei jeder Änderung des Stands — Sprachwechsel, App-
 * Erweiterung, Instanz-Override. Rückgabe: abbestellen.
 */
export function subscribeLanguage(listener: () => void): () => void {
  listenToBrowserLanguage()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let browserListenerAttached = false

/**
 * Ändert der Nutzer die Browsersprachen, kann sich die regionale Locale
 * ändern (rls#289) — abonnierte Komponenten sollen das sehen. Der Stand
 * selbst bleibt gleich; `getI18n()` baut das Bündel mit der neuen Locale.
 */
function listenToBrowserLanguage(): void {
  if (browserListenerAttached || typeof window === "undefined") return
  browserListenerAttached = true
  window.addEventListener("languagechange", () => {
    bundle = null
    for (const listener of listeners) listener()
  })
}

/**
 * Instanz-Konfiguration übernehmen — dieselbe Stelle im App-Start wie
 * `applyBranding` (Spec 11). Die Vorgabe greift nur, solange der Nutzer noch
 * nie gewählt hat: eine gespeicherte Wahl oder eine Wahl in dieser Sitzung
 * übersteuert die Instanz, nicht umgekehrt.
 */
export function applyLanguageConfig(config: {
  defaultLanguage?: string
  strings?: Record<string, Record<string, string>>
}): void {
  let next = state
  if (
    isLanguage(config.defaultLanguage) &&
    !next.userChosen &&
    storedLanguage() === null &&
    config.defaultLanguage !== next.language
  ) {
    next = { ...next, language: config.defaultLanguage }
  }
  if (isRecord(config.strings)) {
    const overrides: Record<Language, Record<string, Message>> = {
      de: messageMap(next.overrides.de),
      en: messageMap(next.overrides.en),
    }
    for (const [lang, messages] of Object.entries(config.strings)) {
      if (!isLanguage(lang)) {
        console.warn(`[i18n] strings["${lang}"] aus config.json: unbekannte Sprache — übersprungen.`)
        continue
      }
      if (!isRecord(messages)) {
        console.warn(`[i18n] strings["${lang}"] aus config.json ist kein Objekt — übersprungen.`)
        continue
      }
      // Nur Strings übernehmen: ein Objekt oder eine Zahl an dieser Stelle
      // würde den Rückfall auf das Wörterbuch VERDECKEN statt übersteuern —
      // t() fände einen Eintrag, könnte ihn aber nicht rendern.
      for (const [key, value] of Object.entries(messages)) {
        if (typeof value === "string") {
          overrides[lang][key] = value
        } else {
          console.warn(`[i18n] strings["${lang}"]["${key}"] ist kein Text — übersprungen.`)
        }
      }
    }
    next = { ...next, overrides: freezeLayer(overrides) }
  }
  if (next !== state) commit(next)
}

/** Die App-Schlüssel aus dem erweiterbaren Register {@link AppMessages}. */
export type AppMessageKey = Extract<keyof AppMessages, string>

/**
 * Eine Nachricht beim Übernehmen in den Stand kopieren (rls#290).
 *
 * Ein Plural-Objekt des Aufrufers darf nicht in den Stand wandern: ändert er
 * es danach, änderte sich jeder Schnappschuss, der es enthält — ohne neue
 * Identität, ohne Benachrichtigung. Die Kopie wird eingefroren, das Objekt des
 * Aufrufers bleibt unberührt. Unbrauchbare Werte (kein Text, kein `other`)
 * fallen mit Warnung heraus, statt den Rückfall zu verdecken.
 */
function intakeMessage(key: string, value: unknown): Message | undefined {
  if (typeof value === "string") return value
  if (isRecord(value) && hasOwn(value, "other") && typeof value.other === "string") {
    const copy = messageMap<string>()
    for (const [category, text] of Object.entries(value)) {
      if (typeof text === "string") copy[category] = text
    }
    return Object.freeze(copy) as Message
  }
  console.warn(`[i18n] "${key}" ist weder Text noch Plural-Objekt mit \`other\` — übersprungen.`)
  return undefined
}

/**
 * App-eigene Schlüssel nachtragen (unterhalb der Instanz-Overrides).
 * Für Texte, die nur die App kennt — Modul-Labels, App-Dialoge.
 *
 * Die Schlüssel sind gegen das Register {@link AppMessages} getypt (rls#614):
 * eine App trägt sie dort per Deklarationsverschmelzung ein. Die Werte werden
 * beim Übernehmen kopiert — späteres Ändern des übergebenen Objekts wirkt
 * nicht, erst ein erneuter Aufruf.
 */
export function extendMessages(
  messages: Partial<Record<Language, Partial<Record<AppMessageKey, Message>>>>,
): void {
  const extensions: Record<Language, Record<string, Message>> = {
    de: messageMap(state.extensions.de),
    en: messageMap(state.extensions.en),
  }
  for (const [lang, entries] of Object.entries(messages)) {
    if (!isLanguage(lang) || !isRecord(entries)) continue
    for (const [key, value] of Object.entries(entries)) {
      const message = intakeMessage(key, value)
      if (message !== undefined) extensions[lang][key] = message
    }
  }
  commit({ ...state, extensions: freezeLayer(extensions) })
}

function freezeLayer(layer: Record<Language, Record<string, Message>>): Layer {
  return Object.freeze({ de: Object.freeze(layer.de), en: Object.freeze(layer.en) })
}

/**
 * Nur für Tests — setzt Sprache, Overrides und Erweiterungen zurück.
 *
 * Mit `language` startet der Stand in dieser Sprache, OHNE sie als Nutzerwahl
 * zu persistieren — so nageln Suiten mit deutschen Literalen die Sprache fest,
 * statt sie still vom System zu erben (CI-Node meldet `en-US`).
 */
export function resetI18nForTests(language?: Language): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY)
  } catch { /* egal */ }
  state = initialState()
  if (language !== undefined) state = { ...state, language }
  bundle = null
  listeners.clear()
}

export type MessageParams = Record<string, string | number>

function lookup(s: State, language: Language, key: string): Message | undefined {
  return own(s.overrides[language], key) ?? own(s.extensions[language], key) ?? own(builtin[language], key)
}

/**
 * Platzhalter ersetzen. Ein fehlender Parameter bleibt als `{name}` sichtbar
 * stehen — ein sichtbarer Platzhalter ist ein auffindbarer Fehler, eine still
 * verschluckte Lücke nicht.
 */
function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    hasOwn(params, name) ? String(params[name]) : match,
  )
}

/**
 * Übersetzung + Formatierung als EIN Bündel (rls#290).
 *
 * In React kommt es ausschliesslich aus `useI18n()` — wer `t` hat, hat damit
 * zwangsläufig auch das Abo auf den Sprachwechsel. String-Helfer ausserhalb
 * von Komponenten nehmen das Bündel als Parameter und zwingen so ihren
 * Aufrufer, es zu besitzen.
 *
 * Ein Bündel ist an den Stand gebunden, aus dem es kam: `language`, `locale`
 * und alle Methoden beziehen sich auf denselben Stand, auch wenn danach die
 * Sprache wechselt. Ein neuer Stand ergibt ein neues Bündel.
 */
export interface I18n {
  language: Language
  /** Regionale Formatierungs-Locale — kann feiner sein als `language`. */
  locale: string
  setLanguage: typeof setLanguage
  /**
   * Text zur Sprache des Bündels — für Schlüssel, die der Compiler kennt.
   *
   * `key` ist streng getypt (rls#614): Toolkit-Schlüssel aus `de.ts` plus die
   * App-Schlüssel, die eine App im Register {@link AppMessages} einträgt. Ein
   * Tippfehler ist ein Compilerfehler, kein roher Schlüssel in der
   * Oberfläche. Für Schlüssel, die erst zur Laufzeit entstehen: `tDynamic`.
   *
   * Plural-Einträge brauchen `count` in den Parametern; die Kategorie wählt
   * `Intl.PluralRules` der Nachrichtensprache. Fehlt ein Schlüssel in der
   * Sprache, greift die deutsche Referenz; fehlt er ganz (bei App-Schlüsseln,
   * deren Text nie übergeben wurde), kommt der Schlüssel selbst zurück und
   * die Konsole meldet es.
   */
  t(key: MessageKey, params?: MessageParams): string
  /**
   * Wie `t`, aber für Schlüssel, die erst zur Laufzeit feststehen —
   * Register-Ids (`module.${id}.label`), Instanz-Texte aus `config.json`.
   * Bewusst ein eigener, sichtbarer Name: ein freier String an `t` würde die
   * Prüfung für alle Aufrufer wieder aushebeln.
   */
  tDynamic(key: string, params?: MessageParams): string
  /** Tag und Monat („18. Aug." / „18 Aug"), oder eigene `Intl`-Optionen. */
  formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string
  /** Uhrzeit („14:32" / „2:32 PM"). */
  formatTime(date: string | Date): string
  /** Voller Zeitstempel für Tooltips („18. August 2026 um 14:32"). */
  formatFullDateTime(date: string | Date): string
  /** Relative Zeit („vor 3 Std." / „3 hr. ago"), jenseits einer Woche das Datum. */
  formatRelativeTime(date: string | Date): string
}

/** Erkennt ein `I18n`-Bündel — für Helfer, die auch ihre alte Form ohne Bündel tragen (rls#291). */
export function isI18n(value: unknown): value is I18n {
  return (
    isRecord(value) &&
    typeof value.t === "function" &&
    typeof value.tDynamic === "function" &&
    typeof value.formatDate === "function" &&
    typeof value.formatTime === "function"
  )
}

function createBundle(s: State): I18n {
  const language = s.language
  const locale = resolveLocale(language)

  const tDynamic: I18n["tDynamic"] = (key, params) => {
    const message = lookup(s, language, key) ?? lookup(s, "de", key)
    if (message === undefined) {
      console.warn(`[i18n] fehlender Schlüssel: ${key}`)
      return key
    }
    if (typeof message === "string") return interpolate(message, params)

    const count = typeof params?.count === "number" ? params.count : undefined
    if (count === undefined) {
      console.warn(`[i18n] Plural-Schlüssel ohne count: ${key}`)
      return interpolate(message.other, params)
    }
    // Plural gehört zum TEXT, nicht zur Region: Nachrichtensprache, nicht Locale.
    const category = new Intl.PluralRules(language).select(count)
    return interpolate(own(message as Record<string, string>, category) ?? message.other, params)
  }

  const t: I18n["t"] = (key, params) => tDynamic(key, params)

  // --- Datum und Zeit — über die REGIONALE Locale, nicht die Sprache (rls#289) ---

  const formatDate: I18n["formatDate"] = (date, options) =>
    new Intl.DateTimeFormat(locale, options ?? { day: "numeric", month: "short" }).format(new Date(date))

  const formatTime: I18n["formatTime"] = (date) =>
    new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(date))

  const formatFullDateTime: I18n["formatFullDateTime"] = (date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(date))

  /*
   * Trägt beide Richtungen: ein Termin in drei Stunden ist „in 3 Std.", nicht
   * „gerade eben" — mit Vorzeichen-Schwellen fielen alle Zukunftszeiten in den
   * ersten Ast. `numeric: "auto"` liefert „gestern"/„morgen" statt „vor 1 Tag".
   */
  const formatRelativeTime: I18n["formatRelativeTime"] = (date) => {
    const then = new Date(date)
    const diffMs = Date.now() - then.getTime() // > 0 = Vergangenheit, < 0 = Zukunft
    // Den BETRAG runden, dann das Vorzeichen wieder anlegen: Math.round rundet
    // −59,5 auf −59, +59,5 aber auf 60 — die Zukunft kippte sonst an anderen
    // Grenzen als die Vergangenheit. Und runden, nicht stutzen: „in 3
    // Stunden" liegt 2:59:59,9 in der Zukunft — trunc machte daraus „in 2 Std.".
    const sign = diffMs < 0 ? -1 : 1
    const absMinutes = Math.round(Math.abs(diffMs) / 60000)
    const absHours = Math.trunc(absMinutes / 60)
    const absDays = Math.trunc(absHours / 24)

    if (absMinutes < 1) return t("time.justNow")
    const short = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "short" })
    if (absMinutes < 60) return short.format(-sign * absMinutes, "minute")
    if (absHours < 24) return short.format(-sign * absHours, "hour")
    if (absDays < 7) {
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-sign * absDays, "day")
    }

    const sameYear = then.getFullYear() === new Date().getFullYear()
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      ...(sameYear ? {} : { year: "numeric" }),
    }).format(then)
  }

  return Object.freeze({
    language,
    locale,
    setLanguage,
    t,
    tDynamic,
    formatDate,
    formatTime,
    formatFullDateTime,
    formatRelativeTime,
  })
}

/**
 * Das Bündel zum aktuellen Stand — für Code AUSSERHALB von React (Tests,
 * Nicht-React-Aufrufer der String-Helfer). In Komponenten stattdessen
 * `useI18n()`; dieser Schnappschuss abonniert nichts.
 *
 * Stabil je Stand: zwei Aufrufe ohne Änderung dazwischen liefern dasselbe
 * Objekt — darauf stützt sich `useI18n()` als `useSyncExternalStore`-Snapshot.
 */
export function getI18n(): I18n {
  // Die Locale hängt zusätzlich an `navigator.languages` — ändert der Browser
  // sie, gilt der Stand als neu (siehe `languagechange` in subscribeLanguage).
  if (bundle === null || bundle.locale !== resolveLocale(state.language)) {
    bundle = createBundle(state)
  }
  return bundle
}

// --- Imperative Kurzformen für Nicht-React-Code: lesen den AKTUELLEN Stand ---

/** Text zur aktiven Sprache — siehe {@link I18n.t}. In React: `useI18n().t`. */
export function t(key: MessageKey, params?: MessageParams): string {
  return getI18n().t(key, params)
}

/** Wie {@link t} für Laufzeit-Schlüssel — siehe {@link I18n.tDynamic}. */
export function tDynamic(key: string, params?: MessageParams): string {
  return getI18n().tDynamic(key, params)
}

/** Tag und Monat zur aktiven Locale. In React: `useI18n().formatDate`. */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return getI18n().formatDate(date, options)
}

/** Uhrzeit zur aktiven Locale. In React: `useI18n().formatTime`. */
export function formatTime(date: string | Date): string {
  return getI18n().formatTime(date)
}

/** Voller Zeitstempel für Tooltips. In React: `useI18n().formatFullDateTime`. */
export function formatFullDateTime(date: string | Date): string {
  return getI18n().formatFullDateTime(date)
}

/** Relative Zeit zur aktiven Sprache. In React: `useI18n().formatRelativeTime`. */
export function formatRelativeTime(date: string | Date): string {
  return getI18n().formatRelativeTime(date)
}
