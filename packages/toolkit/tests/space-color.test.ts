import { describe, it, expect } from "vitest"
import { getSpacePrimaryColor, getReadableTextColor, getItemColor } from "../src/lib/utils"
import { contrastRatio, parseColor } from "../src/lib/oklch"

const HEX6 = /^#[0-9a-fA-F]{6}$/

describe("getItemColor (custom > tag > group)", () => {
  const groupColor = "#123456"

  it("uses a valid custom data.color first", () => {
    expect(getItemColor({ data: { color: "#abcdef" }, tags: ["cafe"] }, { groupColor })).toBe("#abcdef")
  })

  it("falls back to the first tag's accent when no custom colour", () => {
    const c = getItemColor({ data: {}, tags: ["cafe"] }, { groupColor })
    expect(c).toMatch(HEX6)
    expect(c).not.toBe(groupColor)
  })

  it("falls back to the group colour without a custom colour or tags", () => {
    expect(getItemColor({ data: {}, tags: [] }, { groupColor })).toBe(groupColor)
    expect(getItemColor({}, { groupColor })).toBe(groupColor)
  })

  it("ignores an invalid custom colour", () => {
    expect(getItemColor({ data: { color: "not-a-hex" }, tags: [] }, { groupColor })).toBe(groupColor)
  })
})

describe("getSpacePrimaryColor", () => {
  it("returns an explicit valid hex unchanged", () => {
    expect(getSpacePrimaryColor("space-1", "#2563eb")).toBe("#2563eb")
  })

  it("falls back to a deterministic id color for missing/invalid input", () => {
    const fallback = getSpacePrimaryColor("space-1")
    expect(fallback).toMatch(HEX6)
    expect(getSpacePrimaryColor("space-1", null)).toBe(fallback)
    expect(getSpacePrimaryColor("space-1", "not-a-hex")).toBe(fallback)
    expect(getSpacePrimaryColor("space-1", "#fff")).toBe(fallback) // too short
  })

  it("is stable per id", () => {
    expect(getSpacePrimaryColor("alpha")).toBe(getSpacePrimaryColor("alpha"))
  })
})

describe("getReadableTextColor", () => {
  it("returns black on a light accent and white on a dark accent", () => {
    expect(getReadableTextColor("#ffffff")).toBe("#000000")
    expect(getReadableTextColor("#000000")).toBe("#ffffff")
    expect(getReadableTextColor("#2563eb")).toBe("#ffffff")
  })

  it("defaults to white for invalid input", () => {
    expect(getReadableTextColor("nope")).toBe("#ffffff")
  })

  /**
   * Die Wahl faellt nach dem tatsaechlichen Kontrast, nicht nach einer
   * Helligkeitsschwelle.
   *
   * Die alte Naeherung (YIQ, Schwelle 0.6) setzte auf mittleres Grau weissen
   * Text: 2.85:1. WCAG verlangt fuer Bedienelemente 3:1 — und Schwarz haette
   * dort 7.4:1 erreicht. Die Schwelle lag schlicht falsch; zwischen zwei
   * Kandidaten muss man nicht schaetzen, man kann rechnen.
   */
  it("waehlt auf mittlerem Grau die Farbe mit dem besseren Kontrast", () => {
    const grey = ["#999999", "#8c8c8c", "#a0a0a0", "#777777"]
    for (const hex of grey) {
      const chosen = getReadableTextColor(hex)
      const bg = parseColor(hex)!
      const better = contrastRatio(parseColor(chosen)!, bg)
      const other = contrastRatio(parseColor(chosen === "#000000" ? "#ffffff" : "#000000")!, bg)
      expect(better, `${hex}: ${chosen} = ${better.toFixed(2)}:1`).toBeGreaterThanOrEqual(other)
      expect(better, `${hex} erreicht die Latte fuer Bedienelemente`).toBeGreaterThanOrEqual(3)
    }
  })

  it("bleibt bei den eindeutigen Faellen, wie sie waren", () => {
    expect(getReadableTextColor("#ffff00")).toBe("#000000")
    expect(getReadableTextColor("#1a1a1a")).toBe("#ffffff")
  })
})
