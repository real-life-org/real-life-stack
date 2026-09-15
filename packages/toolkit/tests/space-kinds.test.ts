// Space-Arten eines Netzwerks (Spec 04, "Netzwerk und Space-Art").
import { describe, it, expect, vi, afterEach } from "vitest"
import { parseSpaceKinds, kindIdFromLabel } from "../src/lib/space-kinds"

describe("parseSpaceKinds", () => {
  afterEach(() => vi.restoreAllMocks())

  it("ist leer ohne Eintrag", () => {
    expect(parseSpaceKinds(undefined)).toEqual([])
    expect(parseSpaceKinds(null)).toEqual([])
  })

  it("verwirft eine Liste, die kein Array ist, als Ganzes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(parseSpaceKinds({ id: "projekt" })).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("nimmt gueltige Eintraege in Reihenfolge und behaelt die Farbe", () => {
    const kinds = parseSpaceKinds([
      { id: "stiftung", label: "Stiftung", labelPlural: "Stiftungen", color: "#1B5E40" },
      { id: "projekt", label: "Projekt", labelPlural: "Projekte" },
    ])
    expect(kinds.map((k) => k.id)).toEqual(["stiftung", "projekt"])
    expect(kinds[0].color).toBe("#1B5E40")
    expect(kinds[1].color).toBeUndefined()
    expect(Object.isFrozen(kinds[0])).toBe(true)
  })

  it("verwirft nur den fehlerhaften Eintrag, die uebrigen gelten weiter (Regel 4)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const kinds = parseSpaceKinds([
      { id: "Projekt", label: "Projekt", labelPlural: "Projekte" }, // Grossbuchstabe
      { id: "stiftung", label: "", labelPlural: "Stiftungen" }, // leeres Label
      "verein", // kein Objekt
      { id: "verein", label: "Verein", labelPlural: "Vereine" },
      { id: "verein", label: "Nochmal", labelPlural: "Nochmals" }, // doppelt
    ])
    expect(kinds.map((k) => k.id)).toEqual(["verein"])
    expect(warn).toHaveBeenCalledTimes(4)
  })

  it("ignoriert eine unbrauchbare Farbe, behaelt aber den Eintrag", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const [kind] = parseSpaceKinds([{ id: "ort", label: "Ort", labelPlural: "Orte", color: "gruen" }])
    expect(kind.id).toBe("ort")
    expect(kind.color).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe("kindIdFromLabel", () => {
  it("bildet einen Schluessel aus der Einzahl, Umlaute aufgeloest", () => {
    expect(kindIdFromLabel("Stiftung")).toBe("stiftung")
    expect(kindIdFromLabel("Gärten & Höfe")).toBe("gaerten-hoefe")
    expect(kindIdFromLabel("  Straßen-Fest  ")).toBe("strassen-fest")
  })

  it("weicht bei Kollision mit einer Zahl aus", () => {
    expect(kindIdFromLabel("Projekt", ["projekt"])).toBe("projekt-2")
    expect(kindIdFromLabel("Projekt", ["projekt", "projekt-2"])).toBe("projekt-3")
  })

  it("bleibt innerhalb von 32 Zeichen und faellt bei leerem Namen auf 'art'", () => {
    const lang = kindIdFromLabel("a".repeat(50))
    expect(lang.length).toBeLessThanOrEqual(32)
    expect(kindIdFromLabel("a".repeat(50), [lang]).length).toBeLessThanOrEqual(32)
    expect(kindIdFromLabel("???")).toBe("art")
  })
})
