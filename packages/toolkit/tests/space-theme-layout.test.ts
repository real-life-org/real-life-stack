/**
 * Rundung und Flaechen: die zwei Achsen neben Farbe und Toenung.
 * Fuenf Stufen Rundung in Radix' Wortlaut, Flaechen deckend oder
 * durchscheinend. Alles, was aus `Group.data` kommt, ist ungeprueft.
 */
import { describe, expect, it } from "vitest"

import { layoutTokens, LAYOUT_TOKENS, RADIUS_ORDER, RADIUS_STEPS, readRadius, readSurfaces } from "../src/lib/space-theme"

describe("readRadius / readSurfaces", () => {
  it("nimmt nur bekannte Stufen", () => {
    for (const step of RADIUS_ORDER) expect(readRadius(step)).toBe(step)
    for (const bad of ["huge", "", 0.5, null, undefined, {}]) expect(readRadius(bad), String(bad)).toBeNull()
  })

  it("nimmt nur bekannte Flaechen", () => {
    expect(readSurfaces("solid")).toBe("solid")
    expect(readSurfaces("translucent")).toBe("translucent")
    for (const bad of ["glass", "", true, null, undefined]) expect(readSurfaces(bad), String(bad)).toBeNull()
  })
})

describe("layoutTokens", () => {
  it("setzt nur, was gegeben ist", () => {
    expect(layoutTokens({})).toEqual({})
    expect(layoutTokens({ radius: null, surfaces: null })).toEqual({})
  })

  it("uebersetzt die Rundung in die eine Variable", () => {
    expect(layoutTokens({ radius: "medium" })).toEqual({ "--radius": "0.5rem" })
    expect(layoutTokens({ radius: "none" })["--radius"]).toBe("0rem")
    // Die Stufen steigen streng — sonst waere die Reihenfolge der Knoepfe eine Luege.
    const rem = RADIUS_ORDER.map((s) => parseFloat(RADIUS_STEPS[s]))
    for (let i = 1; i < rem.length; i++) expect(rem[i]).toBeGreaterThan(rem[i - 1])
  })

  it("macht Flaechen deckend oder durchscheinend", () => {
    expect(layoutTokens({ surfaces: "solid" })).toEqual({ "--surface-alpha": "1", "--surface-blur": "0px" })
    expect(layoutTokens({ surfaces: "translucent" })).toEqual({ "--surface-alpha": "0.8", "--surface-blur": "12px" })
  })

  it("nennt jedes Token, das es setzen kann", () => {
    const all = layoutTokens({ radius: "full", surfaces: "solid" })
    expect(Object.keys(all).sort()).toEqual([...LAYOUT_TOKENS].sort())
  })
})
