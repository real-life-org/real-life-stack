import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  contactHref,
  contactKind,
  formatNumber,
  numberError,
  parseNumberInput,
  normalizeUrl,
  safeHref,
  urlLabel,
  contactError,
  urlError,
  toneClass,
  CHIP_TONES,
} from "../src/lib/field-values"

/**
 * Die Wert-Widgets B7, B9, B12 (S4a) teilen einen Datenvertrag zwischen Lese-
 * und Schreibform (shared-components → Widget-Paare). Diese Hilfen sind der
 * Vertrag, React-frei: Was die Schreibform prüft und speichert, liest die
 * Leseform genauso.
 */

describe("url (B9): nur http und https, nie javascript:", () => {
  it("nimmt http- und https-Adressen unverändert", () => {
    expect(normalizeUrl("https://gartenprojekt.org/beete")).toBe("https://gartenprojekt.org/beete")
    expect(normalizeUrl("http://example.org")).toBe("http://example.org/")
  })

  it("ergänzt https bei einer bloßen Domain, wie man sie tippt", () => {
    expect(normalizeUrl("gartenprojekt.org")).toBe("https://gartenprojekt.org/")
    expect(normalizeUrl("  meet.jit.si/gartenprojekt  ")).toBe("https://meet.jit.si/gartenprojekt")
  })

  it("lehnt jedes andere Schema und Nicht-Adressen ab", () => {
    for (const bad of ["hallo", "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "ftp://x.org", "mailto:a@b.de", "vbscript:x", "hallo welt", "", "   "]) {
      expect(normalizeUrl(bad), bad).toBeNull()
    }
  })

  it("safeHref: die Leseform verlinkt nur, was sicher ist", () => {
    expect(safeHref("https://gartenprojekt.org")).toBe("https://gartenprojekt.org/")
    expect(safeHref("javascript:alert(1)")).toBeNull()
    expect(safeHref(" javascript:alert(1)")).toBeNull()
    expect(safeHref(42)).toBeNull()
  })

  it("urlLabel zeigt die Adresse ohne Schema und ohne Schrägstrich am Ende", () => {
    expect(urlLabel("https://gartenprojekt.org/")).toBe("gartenprojekt.org")
    expect(urlLabel("https://www.codeberg.org/garten")).toBe("codeberg.org/garten")
  })

  it("urlError nennt den Grund, leer ist kein Fehler", () => {
    expect(urlError("")).toBeNull()
    expect(urlError("gartenprojekt.org")).toBeNull()
    expect(urlError("javascript:alert(1)")).toMatch(/http/)
  })
})

describe("contact (B12): Telefon oder E-Mail mit Sprung", () => {
  it("erkennt die Art am Wert", () => {
    expect(contactKind("+49 170 1234567")).toBe("phone")
    expect(contactKind("(030) 123-45 67")).toBe("phone")
    expect(contactKind("lena@example.org")).toBe("email")
    expect(contactKind("ruf mich an")).toBeNull()
    expect(contactKind("12")).toBeNull()
  })

  it("baut tel: und mailto: ohne Leerzeichen und ohne fremde Zeichen", () => {
    expect(contactHref("+49 170 123 45 67")).toBe("tel:+491701234567")
    expect(contactHref("(030) 123-45 67")).toBe("tel:0301234567")
    expect(contactHref("lena@example.org")).toBe("mailto:lena@example.org")
    expect(contactHref("javascript:alert(1)")).toBeNull()
    expect(contactHref("a@b.de?subject=x")).toBeNull()
  })

  it("contactError: leer ist kein Fehler, Unerkanntes schon", () => {
    expect(contactError("")).toBeNull()
    expect(contactError("lena@example.org")).toBeNull()
    expect(contactError("irgendwas")).toMatch(/Telefon/)
  })
})

describe("number (B7): Zahl mit Einheit, Grenzen aus dem Register", () => {
  it("liest Eingaben mit Punkt oder Komma, leer ist kein Wert", () => {
    expect(parseNumberInput("12")).toBe(12)
    expect(parseNumberInput("1,5")).toBe(1.5)
    expect(parseNumberInput(" 300 ")).toBe(300)
    expect(parseNumberInput(7)).toBe(7)
    expect(parseNumberInput("")).toBeUndefined()
    expect(parseNumberInput(undefined)).toBeUndefined()
    expect(Number.isNaN(parseNumberInput("zwölf"))).toBe(true)
  })

  it("numberError prüft Zahl, min und max", () => {
    expect(numberError("", { min: 0 })).toBeNull()
    expect(numberError("5", { min: 0, max: 10 })).toBeNull()
    expect(numberError("-1", { min: 0 })).toMatch(/0/)
    expect(numberError("11", { max: 10 })).toMatch(/10/)
    expect(numberError("abc", {})).toMatch(/Zahl/)
  })

  it("#544: formatNumber kürzt nie still — 0,001 kg bleibt 0,001 kg", () => {
    expect(formatNumber(0.001, "kg")).toBe("0,001 kg")
    expect(formatNumber(12, "h")).toBe("12 h")
    expect(formatNumber(12.5)).toBe("12,5")
    expect(formatNumber(0.123456789)).toBe("0,123456789")
    expect(formatNumber(1e-7)).toBe("0,0000001")
    expect(formatNumber(-2.5, "€")).toBe("-2,5 €")
    expect(formatNumber(-0)).toBe("0")
  })

  it("#544 (Codex): werttreu auch jenseits von 20 Stellen — nie „0“ für einen Wert ungleich 0", () => {
    expect(formatNumber(1e-21)).toBe("1e-21")
    expect(formatNumber(-1e-21)).toBe("-1e-21")
    expect(formatNumber(Number.MIN_VALUE)).toBe("5e-324")
    expect(formatNumber(1.2345678901234568e-10)).toBe("1,2345678901234568e-10")
    expect(formatNumber(Number.MAX_VALUE)).toBe("1,7976931348623157e308")
    expect(formatNumber(1e21)).toBe("1e21")
    expect(formatNumber(123456789012345680000)).toBe("123.456.789.012.345.680.000")
    // Zurücklesbar: dieselbe Zahl, nichts gekürzt.
    for (const n of [1e-21, Number.MIN_VALUE, 1.2345678901234568e-10, Number.MAX_VALUE, 0.1 + 0.2]) {
      expect(Number(formatNumber(n).replace(/\./g, "").replace(",", ".")), String(n)).toBe(n)
    }
  })

  it("#544 (Codex): Grenzmeldungen nennen die Grenze exakt", () => {
    expect(numberError("0", { min: 1e-21 })).toBe("Mindestens 1e-21")
    expect(numberError("0", { max: -1e-21 })).toBe("Höchstens -1e-21")
  })

  it("formatNumber schreibt deutsch mit Einheit", () => {
    expect(formatNumber(12, "h")).toBe("12 h")
    expect(formatNumber(1500, "€")).toBe("1.500 €")
    expect(formatNumber(1.5)).toBe("1,5")
  })
})

describe("Ton eines Chips", () => {
  it("kennt eine feste Palette; Unbekanntes und nichts ist neutral", () => {
    expect(toneClass("green")).toContain("green")
    expect(toneClass("rose")).toContain("rose")
    expect(toneClass("irgendwas")).toContain("bg-muted")
    expect(toneClass(undefined)).toContain("bg-muted")
  })
})

describe("Die Töne melden ihre Klassen an (wie die Tag-Palette)", () => {
  it("jede Klasse eines farbigen Tons steht in globals.css als @source inline", () => {
    const css = readFileSync(join(__dirname, "../src/styles/globals.css"), "utf8")
    const angemeldet = new Set([...css.matchAll(/@source inline\(\s*"([^"]*)"\s*\)/g)].flatMap((m) => m[1]!.split(/\s+/)))
    for (const tone of CHIP_TONES.filter((t) => t !== "neutral")) {
      for (const klasse of toneClass(tone).split(/\s+/)) expect(angemeldet.has(klasse), `${tone}: ${klasse}`).toBe(true)
    }
  })
})
