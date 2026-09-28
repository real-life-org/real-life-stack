import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { parseItemTarget, resolveTarget, targetItemId, targetPointsTo } from "../src/lib/item-targets"

/**
 * Vertrag „Ein Auflöser für Kanten-Ziele" (06, Verhältnis zu Relations,
 * Regel 6; 04, Target-Konventionen): Space nach 04, Typ der Gegenstelle über
 * alle Klassen, Qualifikation `space:{id}/item:`.
 */

const item = (id: string, type: string | string[]): Item =>
  ({ id, type, createdAt: "2026-09-20T10:00:00.000Z", createdBy: "u", data: { title: id } }) as unknown as Item

const ORT = item("p", "place")
const AUFGABE = item("p", "task")
const MEHR = item("m", ["post", "place"])
const spaceOf = (id: string) => (id === "p" || id === "m" ? "g" : "anders")

describe("Auflöser für Kanten-Ziele", () => {
  it("zerlegt item: und space:{id}/item:, sonst nichts", () => {
    expect(parseItemTarget("item:p")).toEqual({ itemId: "p" })
    expect(parseItemTarget("space:g/item:p")).toEqual({ itemId: "p", space: "g" })
    expect(parseItemTarget("global:did:key:z6")).toBeNull()
    expect(parseItemTarget(42)).toBeNull()
    expect(targetItemId("space:g/item:a/item:b")).toBe("a/item:b")
  })

  it("item: ist space-lokal zum Träger", () => {
    expect(targetPointsTo("item:p", ORT, { carrierSpace: "g", spaceOf })).toBe(true)
    expect(targetPointsTo("item:p", ORT, { carrierSpace: "anders", spaceOf })).toBe(false)
    // Ohne Spaces gibt es nur einen Bereich.
    expect(targetPointsTo("item:p", ORT, { carrierSpace: null })).toBe(true)
  })

  it("space:{id}/item: zeigt genau in diesen Space; ohne Auskunft nicht prüfbar", () => {
    expect(targetPointsTo("space:g/item:p", ORT, { carrierSpace: "anders", spaceOf })).toBe(true)
    expect(targetPointsTo("space:anders/item:p", ORT, { carrierSpace: "g", spaceOf })).toBe(false)
    expect(targetPointsTo("space:g/item:p", ORT, { carrierSpace: null })).toBe(false)
  })

  it("Typ der Gegenstelle über alle Klassen; item und ohne Angabe: jeder Typ", () => {
    expect(targetPointsTo("item:p", AUFGABE, { carrierSpace: "g", spaceOf, otherKind: "place" })).toBe(false)
    expect(targetPointsTo("item:m", MEHR, { carrierSpace: "g", spaceOf, otherKind: "place" })).toBe(true)
    expect(targetPointsTo("item:p", AUFGABE, { carrierSpace: "g", spaceOf, otherKind: "item" })).toBe(true)
  })

  it("resolveTarget: aus Liste oder Map, sonst undefined", () => {
    expect(resolveTarget("item:p", [AUFGABE, ORT], { carrierSpace: "g", spaceOf, otherKind: "place" })).toBe(ORT)
    expect(resolveTarget("item:p", new Map([["p", ORT]]), { carrierSpace: "g", spaceOf })).toBe(ORT)
    expect(resolveTarget("item:weg", [ORT], { carrierSpace: "g", spaceOf })).toBeUndefined()
    expect(resolveTarget("global:u", [ORT], { carrierSpace: "g", spaceOf })).toBeUndefined()
  })
})
