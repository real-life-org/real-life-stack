// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getLanguage,
  setLanguage,
  getLocale,
  subscribeLanguage,
  applyLanguageConfig,
  extendMessages,
  formatRelativeTime,
  formatFullDateTime,
  formatDate,
  getI18n,
  type MessageParams,
} from "../src/i18n"
import { resetI18nForTests } from "../src/testing"

// Diese Suite prüft die Auflösung auch für App- und fehlende Schlüssel —
// darum über `tDynamic` des aktuellen Bündels, nicht über das streng getypte `t`.
const t = (key: string, params?: MessageParams) => getI18n().tDynamic(key, params)


/**
 * Die i18n-Laufzeit ist eine dünne Schicht über `Intl` — getestet werden die
 * Regeln, die NICHT von Intl kommen: die Vorrangketten (Sprache und Text),
 * Platzhalter, Plural-Auswahl und der Sprachzustand.
 */
describe("i18n-Laufzeit", () => {
  beforeEach(() => {
    resetI18nForTests()
    setLanguage("de")
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    resetI18nForTests()
    vi.restoreAllMocks()
    // fakeBrowserLanguages legt eine eigene Instanz-Eigenschaft an (configurable),
    // die die jsdom-Vorgabe am Prototyp nur ÜBERDECKT — löschen stellt sie wieder her.
    delete (navigator as unknown as Record<string, unknown>).languages
  })

  describe("Sprachzustand", () => {
    it("wechselt die Sprache und benachrichtigt Abonnenten", () => {
      const listener = vi.fn()
      subscribeLanguage(listener)

      setLanguage("en")

      expect(getLanguage()).toBe("en")
      expect(listener).toHaveBeenCalledTimes(1)
      expect(t("userMenu.contacts")).toBe("Contacts")
    })

    it("persistiert die Nutzerwahl", () => {
      setLanguage("en")
      expect(localStorage.getItem("rls.language")).toBe("en")
    })

    it("persistiert auch eine Wahl, die der aktuellen Sprache entspricht", () => {
      // Sprache kam von der Instanz-Vorgabe; der Nutzer bestätigt sie ausdrücklich.
      resetI18nForTests()
      applyLanguageConfig({ defaultLanguage: "en" })
      setLanguage("en")
      expect(localStorage.getItem("rls.language")).toBe("en")
      // Eine spätere, andere Instanz-Vorgabe gewinnt nicht mehr.
      applyLanguageConfig({ defaultLanguage: "de" })
      expect(getLanguage()).toBe("en")
    })

    it("benachrichtigt nicht, wenn sich nichts ändert", () => {
      const listener = vi.fn()
      subscribeLanguage(listener)
      setLanguage("de")
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe("Instanz-Konfiguration", () => {
    it("übernimmt die Instanz-Vorgabe, solange der Nutzer nie gewählt hat", () => {
      resetI18nForTests() // verwirft auch die localStorage-Wahl aus beforeEach
      applyLanguageConfig({ defaultLanguage: "en" })
      expect(getLanguage()).toBe("en")
    })

    it("lässt die Instanz-Vorgabe NICHT über die Nutzerwahl gewinnen", () => {
      // setLanguage("de") in beforeEach ist eine persistierte Nutzerwahl.
      setLanguage("en")
      applyLanguageConfig({ defaultLanguage: "de" })
      expect(getLanguage()).toBe("en")
    })

    it("Instanz-Override schlägt Toolkit-Wörterbuch — der White-Label-Kern", () => {
      applyLanguageConfig({ strings: { de: { "userMenu.contacts": "Vertraute" } } })
      expect(t("userMenu.contacts")).toBe("Vertraute")
      // ... aber nur in der Sprache, für die er gilt.
      setLanguage("en")
      expect(t("userMenu.contacts")).toBe("Contacts")
    })

    it("Instanz-Override schlägt auch App-Erweiterungen", () => {
      extendMessages({ de: { "app.greeting": "Hallo" } })
      applyLanguageConfig({ strings: { de: { "app.greeting": "Moin" } } })
      expect(t("app.greeting")).toBe("Moin")
    })

    it("ignoriert eine unbekannte Sprache in der Vorgabe", () => {
      applyLanguageConfig({ defaultLanguage: "fr" })
      expect(getLanguage()).toBe("de")
    })

    it("übernimmt nur String-Werte aus strings — ein Objekt verdeckt sonst den Rückfall", () => {
      // config.json ist ungeprüftes JSON: ein Objekt an dieser Stelle wäre für
      // t() ein „vorhandener" Eintrag, den es nicht rendern kann — der Rückfall
      // aufs Wörterbuch käme nie zum Zug.
      applyLanguageConfig({
        strings: {
          de: { "userMenu.contacts": { nested: "kaputt" }, "userMenu.profile": "Steckbrief" },
          fr: { "userMenu.contacts": "Contacts" },
        } as unknown as Record<string, Record<string, string>>,
      })

      expect(t("userMenu.contacts")).toBe("Kontakte") // Wörterbuch, nicht das Objekt
      expect(t("userMenu.profile")).toBe("Steckbrief") // der gültige Nachbar gilt trotzdem
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("userMenu.contacts"))
    })
  })

  describe("Formatierungs-Locale ≠ Nachrichtensprache", () => {
    function fakeBrowserLanguages(languages: string[]) {
      Object.defineProperty(navigator, "languages", { value: languages, configurable: true })
    }

    it("behält die regionale Locale des Browsers, wenn sie zur Sprache passt", () => {
      // en-GB-Nutzer: Wörterbuch „en", aber Datum 18/08/2026 — nicht 8/18/26.
      fakeBrowserLanguages(["en-GB", "de-DE"])
      setLanguage("en")
      expect(getLocale()).toBe("en-GB")
      expect(formatFullDateTime(new Date("2026-08-18T14:32:00"))).toContain("18 August")
    })

    it("en-GB: Wörterbuch `en`, Intl `en-GB`", () => {
      fakeBrowserLanguages(["en-GB"])
      setLanguage("en")
      const i18n = getI18n()
      expect(i18n.language).toBe("en")
      expect(i18n.locale).toBe("en-GB")
      expect(i18n.t("userMenu.contacts")).toBe("Contacts")
      expect(formatDate(new Date("2026-08-18T14:32:00"))).toBe("18 Aug")
      expect(formatDate(new Date("2026-08-18T14:32:00"), { dateStyle: "short" })).toBe("18/08/2026")
      expect(i18n.formatTime(new Date("2026-08-18T14:32:00"))).toBe("14:32")
    })

    it("en-US: Wörterbuch `en`, Intl `en-US`", () => {
      fakeBrowserLanguages(["en-US"])
      setLanguage("en")
      const i18n = getI18n()
      expect(i18n.language).toBe("en")
      expect(i18n.locale).toBe("en-US")
      expect(formatDate(new Date("2026-08-18T14:32:00"))).toBe("Aug 18")
      expect(formatDate(new Date("2026-08-18T14:32:00"), { dateStyle: "short" })).toBe("8/18/26")
      expect(i18n.formatTime(new Date("2026-08-18T14:32:00"))).toMatch(/^02:32\sPM$/)
    })

    it("fällt auf die nackte Sprache zurück, wenn keine Browser-Locale passt", () => {
      fakeBrowserLanguages(["de-DE"])
      setLanguage("en")
      expect(getLocale()).toBe("en")
    })

    it("nimmt die passende Locale auch von hinterer Position", () => {
      fakeBrowserLanguages(["en-US", "de-AT"])
      setLanguage("de")
      expect(getLocale()).toBe("de-AT")
    })
  })

  describe("Textauflösung", () => {
    it("fällt für App-Schlüssel ohne Übersetzung auf die deutsche Referenz zurück", () => {
      extendMessages({ de: { "app.only": "Nur deutsch" } })
      setLanguage("en")
      expect(t("app.only")).toBe("Nur deutsch")
    })

    it("gibt bei gänzlich fehlendem Schlüssel den Schlüssel zurück und warnt", () => {
      expect(t("gibt.es.nicht")).toBe("gibt.es.nicht")
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("gibt.es.nicht"))
    })

    it("ersetzt Platzhalter", () => {
      expect(t("item.editedBy", { name: "Timo", date: "18. Aug." })).toBe(
        "Bearbeitet von Timo am 18. Aug.",
      )
    })

    it("lässt einen fehlenden Parameter sichtbar stehen", () => {
      // Ein sichtbarer Platzhalter ist ein auffindbarer Fehler, eine still
      // verschluckte Lücke nicht.
      expect(t("item.editedBy", { name: "Timo" })).toBe("Bearbeitet von Timo am {date}")
    })
  })

  describe("Plural", () => {
    it("wählt die Kategorie über Intl.PluralRules der aktiven Sprache", () => {
      extendMessages({
        de: { "app.groups": { one: "{count} Gruppe", other: "{count} Gruppen" } },
        en: { "app.groups": { one: "{count} group", other: "{count} groups" } },
      })

      expect(t("app.groups", { count: 1 })).toBe("1 Gruppe")
      expect(t("app.groups", { count: 7 })).toBe("7 Gruppen")
      setLanguage("en")
      expect(t("app.groups", { count: 1 })).toBe("1 group")
    })

    it("fällt ohne count auf `other` zurück und warnt", () => {
      extendMessages({ de: { "app.groups": { one: "{count} Gruppe", other: "Gruppen" } } })
      expect(t("app.groups")).toBe("Gruppen")
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("app.groups"))
    })
  })

  describe("Zeitformatierung über die aktive Sprache", () => {
    it("formatiert relative Zeit je Sprache", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600_000)
      expect(formatRelativeTime(threeHoursAgo)).toContain("vor 3")
      setLanguage("en")
      expect(formatRelativeTime(threeHoursAgo)).toContain("3 hr")
    })

    it("zeigt Zukunftszeiten als Zukunft, nicht als „gerade eben“", () => {
      // Mit Vorzeichen-Schwellen fiel JEDE Zukunftszeit in den ersten Ast:
      // ein Termin in drei Stunden hieß „gerade eben".
      const inThreeHours = new Date(Date.now() + 3 * 3600_000)
      expect(formatRelativeTime(inThreeHours)).toContain("in 3")
      setLanguage("en")
      expect(formatRelativeTime(inThreeHours)).toContain("in 3 hr")
    })

    it("sagt „morgen“ für den nächsten Tag", () => {
      const tomorrow = new Date(Date.now() + 25 * 3600_000)
      expect(formatRelativeTime(tomorrow)).toBe("morgen")
      setLanguage("en")
      expect(formatRelativeTime(tomorrow)).toBe("tomorrow")
    })

    it("sagt „gestern“ in der Sprache des Nutzers", () => {
      const yesterday = new Date(Date.now() - 25 * 3600_000)
      expect(formatRelativeTime(yesterday)).toBe("gestern")
      setLanguage("en")
      expect(formatRelativeTime(yesterday)).toBe("yesterday")
    })

    it("formatiert den vollen Zeitstempel je Sprache", () => {
      const date = new Date("2026-08-18T14:32:00")
      expect(formatFullDateTime(date)).toContain("August")
      expect(formatFullDateTime(date)).toContain("14:32")
      setLanguage("en")
      expect(formatFullDateTime(date)).toMatch(/2:32|14:32/)
    })
  })

  describe("Bündel = konsistenter Schnappschuss (rls#290)", () => {
    it("ein Bündel bleibt bei seinem Stand, auch nach einem Sprachwechsel", () => {
      const snapshot = getI18n()
      setLanguage("en")
      expect(snapshot.language).toBe("de")
      expect(snapshot.t("userMenu.contacts")).toBe("Kontakte")
      expect(getI18n().t("userMenu.contacts")).toBe("Contacts")
    })

    it("ist ohne Änderung stabil, und jede Änderung ergibt ein neues Bündel", () => {
      const a = getI18n()
      expect(getI18n()).toBe(a)
      extendMessages({ de: { "app.x": "X" } })
      const b = getI18n()
      expect(b).not.toBe(a)
      expect(b.language).toBe("de") // gleiche Sprache, trotzdem neuer Stand
      applyLanguageConfig({ strings: { de: { "app.x": "Y" } } })
      expect(getI18n()).not.toBe(b)
      // Das ältere Bündel sieht die spätere Erweiterung nicht.
      expect(a.t("app.x")).toBe("app.x")
      expect(b.t("app.x")).toBe("X")
      expect(getI18n().t("app.x")).toBe("Y")
    })

    it("benachrichtigt Abonnenten auch bei Text-Änderungen ohne Sprachwechsel", () => {
      const listener = vi.fn()
      subscribeLanguage(listener)
      extendMessages({ de: { "app.y": "Y" } })
      applyLanguageConfig({ strings: { de: { "app.y": "Z" } } })
      expect(listener).toHaveBeenCalledTimes(2)
    })
  })

  describe("Rundung der relativen Zeit ist symmetrisch", () => {
    afterEach(() => vi.useRealTimers())

    it("59,5 Minuten sind in beiden Richtungen eine Stunde", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-08-18T12:00:00Z"))
      setLanguage("en")
      const half = 59.5 * 60_000
      const now = Date.now()
      expect(formatRelativeTime(new Date(now - half))).toBe("1 hr. ago")
      expect(formatRelativeTime(new Date(now + half))).toBe("in 1 hr.")
    })
  })

  describe("Übernommene Pluralwerte sind Kopien (rls#290)", () => {
    it("ein späteres Ändern des Aufrufer-Objekts verändert keinen Schnappschuss", () => {
      const plural = { one: "eine Gruppe", other: "alte Gruppen" }
      extendMessages({ de: { "app.groups": plural } })
      const old = getI18n()
      const listener = vi.fn()
      subscribeLanguage(listener)

      plural.other = "neue Gruppen"

      expect(old.t("app.groups" as never, { count: 2 })).toBe("alte Gruppen")
      expect(getI18n()).toBe(old) // keine stille neue Identität …
      expect(getI18n().t("app.groups" as never, { count: 2 })).toBe("alte Gruppen")
      expect(listener).not.toHaveBeenCalled() // … und keine Benachrichtigung

      // Erst ein erneutes Übernehmen bringt den neuen Text — als neuer Stand.
      extendMessages({ de: { "app.groups": plural } })
      expect(getI18n().t("app.groups" as never, { count: 2 })).toBe("neue Gruppen")
      expect(old.t("app.groups" as never, { count: 2 })).toBe("alte Gruppen")
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it("friert die eigene Kopie ein, nicht das Objekt des Aufrufers", () => {
      const plural = { one: "eine Gruppe", other: "Gruppen" }
      extendMessages({ de: { "app.groups": plural } })
      expect(Object.isFrozen(plural)).toBe(false)
      plural.one = "geändert" // darf nicht werfen
      expect(getI18n().t("app.groups" as never, { count: 1 })).toBe("eine Gruppe")
    })
  })

  describe("Sitzungswahl ohne beschreibbaren Speicher (rls#615)", () => {
    it("eine ausdrückliche Wahl gilt die Sitzung über, auch wenn setItem wirft", () => {
      resetI18nForTests("de")
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("QuotaExceededError")
      })
      setLanguage("en")
      expect(setItem).toHaveBeenCalled()
      expect(localStorage.getItem("rls.language")).toBeNull()

      applyLanguageConfig({ defaultLanguage: "de" })

      expect(getLanguage()).toBe("en")
    })
  })

  describe("Nur eigene Schlüssel — nichts aus Object.prototype (rls#617)", () => {
    const geerbt = ["toString", "__proto__", "constructor", "hasOwnProperty", "valueOf"]

    it.each(geerbt)("„%s“ ist ein unbekannter Schlüssel, mit und ohne Parameter", (key) => {
      expect(t(key)).toBe(key)
      expect(t(key, { count: 1 })).toBe(key)
      expect(t(key, { name: "x" })).toBe(key)
      setLanguage("en")
      expect(t(key, { count: 2 })).toBe(key)
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(key))
    })

    it("ein registrierter Schlüssel „toString“ gilt wie jeder andere, mit Rückfallkette", () => {
      extendMessages({ de: { toString: "Als Text" } } as never)
      expect(t("toString")).toBe("Als Text")
      setLanguage("en")
      expect(t("toString")).toBe("Als Text") // deutsche Referenz als Rückfall
      applyLanguageConfig({ strings: { en: { toString: "As text" } } })
      expect(t("toString")).toBe("As text")
    })

    it("ein Plural-Eintrag unter „constructor“ wählt seine Kategorie", () => {
      extendMessages({ de: { constructor: { one: "{count} Bau", other: "{count} Bauten" } } } as never)
      expect(t("constructor", { count: 1 })).toBe("1 Bau")
      expect(t("constructor", { count: 3 })).toBe("3 Bauten")
    })

    it("ein Platzhalter „{toString}“ greift nicht auf geerbte Parameter zu", () => {
      extendMessages({ de: { "app.ph": "Wert: {toString}" } } as never)
      expect(t("app.ph", {})).toBe("Wert: {toString}")
      expect(t("app.ph", { toString: "eigen" })).toBe("Wert: eigen")
    })

    it("ein „__proto__“-Schlüssel in der Eingabe verschmutzt nichts", () => {
      const app = JSON.parse('{"de": {"__proto__": {"other": "App-Proto", "polluted": "ja"}}}')
      const instance = JSON.parse('{"de": {"__proto__": "Instanz-Proto"}, "__proto__": {"en": {"x": "y"}}}')
      extendMessages(app)
      expect(t("__proto__", { count: 2 })).toBe("App-Proto")
      applyLanguageConfig({ strings: instance })
      expect(t("__proto__")).toBe("Instanz-Proto")
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
      expect(({} as Record<string, unknown>).other).toBeUndefined()
      expect(({} as Record<string, unknown>).en).toBeUndefined()
      // Andere Schlüssel lösen unverändert auf.
      expect(t("userMenu.contacts")).toBe("Kontakte")
      expect(t("polluted")).toBe("polluted")
    })
  })
})
