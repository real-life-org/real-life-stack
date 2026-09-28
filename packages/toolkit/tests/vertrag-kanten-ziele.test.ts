import { describe, expect, it } from "vitest"
import type { DataInterface, Item } from "@real-life-stack/data-interface"

import * as auflöser from "../src/lib/item-targets"
import {
  allSpacesScope,
  carrierScope,
  isItemTarget,
  resolveTarget,
  sameSpaceScope,
  spaceScope,
  survivesSpaceChange,
} from "../src/lib/item-targets"

/**
 * Vertrag „Ein Auflöser für Kanten-Ziele" (06, Verhältnis zu Relations,
 * Regel 6; 04, Target-Konventionen): `resolveTarget` ist die einzige
 * Schnittstelle; den Kontext bauen seine Fabriken; aggregierte Ansichten
 * nutzen „alle Spaces", ohne die Space-Prüfung abzuschalten.
 */

const item = (id: string, type: string | string[]): Item =>
  ({ id, type, createdAt: "2026-09-20T10:00:00.000Z", createdBy: "u", data: { title: id } }) as unknown as Item

const ORT = item("p", "place")
const AUFGABE = item("p", "task")
const MEHR = item("m", ["post", "place"])
const TRÄGER = item("t", "event")

/** Ein Connector, der nur Spaces kennt. */
const connectorWith = (spaces: Record<string, string>) =>
  ({ getItemGroupId: (id: string) => spaces[id] ?? null, moveItemToGroup: async () => undefined }) as unknown as DataInterface

describe("Auflöser: Schnittstelle", () => {
  it("exportiert keine Zerleger und Id-Helfer", () => {
    const names = Object.keys(auflöser)
    for (const intern of ["parseItemTarget", "targetItemId", "targetPointsTo", "isLocalItemTarget"]) expect(names).not.toContain(intern)
    expect(names).toContain("resolveTarget")
  })

  it("Kontexte sind opak: nur die Fabriken bauen sie", () => {
    const scope = sameSpaceScope()
    expect(Object.keys(scope)).toEqual([])
  })
})

describe("Auflöser: Regeln aus 04", () => {
  it("item: ist space-lokal zum Träger (Space vom Connector)", () => {
    const connector = connectorWith({ t: "g", p: "g" })
    expect(resolveTarget("item:p", carrierScope(connector, TRÄGER), [ORT])).toBe(ORT)
    expect(resolveTarget("item:p", carrierScope(connectorWith({ t: "g", p: "h" }), TRÄGER), [ORT])).toBeUndefined()
    // Ohne Spaces gibt es nur einen Bereich.
    expect(resolveTarget("item:p", carrierScope(null, TRÄGER), [ORT])).toBe(ORT)
  })

  it("space:{id}/item: zeigt genau in diesen Space; ohne Auskunft nicht prüfbar", () => {
    const connector = connectorWith({ t: "h", p: "g" })
    expect(resolveTarget("space:g/item:p", carrierScope(connector, TRÄGER), [ORT])).toBe(ORT)
    expect(resolveTarget("space:h/item:p", carrierScope(connector, TRÄGER), [ORT])).toBeUndefined()
    expect(resolveTarget("space:g/item:p", sameSpaceScope(), [ORT])).toBeUndefined()
  })

  it("Typ der Gegenstelle über alle Klassen", () => {
    expect(resolveTarget("item:p", sameSpaceScope({ otherKind: "place" }), [AUFGABE])).toBeUndefined()
    expect(resolveTarget("item:m", sameSpaceScope({ otherKind: "place" }), [MEHR])).toBe(MEHR)
    expect(resolveTarget("item:p", sameSpaceScope({ otherKind: "item" }), [AUFGABE])).toBe(AUFGABE)
  })

  it("Formular-Space mit Ids aus einer group-Abfrage", () => {
    const connector = connectorWith({})
    expect(resolveTarget("item:p", spaceScope(connector, "g", { knownInSpace: new Set(["p"]) }), [ORT])).toBe(ORT)
    expect(resolveTarget("item:p", spaceScope(connector, "g"), [ORT])).toBeUndefined()
  })

  it("Liste oder Map; kein Ziel ist undefined", () => {
    expect(resolveTarget("item:p", sameSpaceScope(), new Map([["p", ORT]]))).toBe(ORT)
    expect(resolveTarget("item:weg", sameSpaceScope(), [ORT])).toBeUndefined()
    expect(resolveTarget("global:u", sameSpaceScope(), [ORT])).toBeUndefined()
  })

  it("Space-Wechsel übersteht nur ein qualifiziertes Target", () => {
    expect(survivesSpaceChange("item:p")).toBe(false)
    expect(survivesSpaceChange("space:g/item:p")).toBe(true)
    expect(isItemTarget("space:g/item:a/item:b")).toBe(true)
  })
})

describe("Aggregat-Kontext „alle Spaces“: Prüfung bleibt an", () => {
  const spaces: Record<string, string> = { t: "g", p: "h" }
  const spaceOf = (id: string) => spaces[id] ?? null

  it("ein lokales Ziel in einem fremden Space ist keins", () => {
    expect(resolveTarget("item:p", allSpacesScope(spaceOf, TRÄGER), [ORT])).toBeUndefined()
  })

  it("ein qualifiziertes Ziel in den richtigen Space gilt, in einen anderen nicht", () => {
    expect(resolveTarget("space:h/item:p", allSpacesScope(spaceOf, TRÄGER), [ORT])).toBe(ORT)
    expect(resolveTarget("space:g/item:p", allSpacesScope(spaceOf, TRÄGER), [ORT])).toBeUndefined()
  })

  it("ein unbekannter Träger-Space: lokal kein Ziel (nicht abgeschaltet)", () => {
    const unbekannt = item("x", "event")
    expect(resolveTarget("item:p", allSpacesScope(spaceOf, unbekannt), [ORT])).toBeUndefined()
  })

  it("aus dem Connector wie aus einer Funktion", () => {
    expect(resolveTarget("space:h/item:p", allSpacesScope(connectorWith(spaces), TRÄGER), [ORT])).toBe(ORT)
  })
})
