/**
 * Eine Aenderung an `Group.data` MUSS die Beobachter erreichen.
 *
 * `createObservable.set` verwirft ein Array, dessen Elemente dieselben
 * Referenzen tragen. Mutierte der Mock das Gruppenobjekt an Ort und Stelle,
 * sah der Beobachter "nichts Neues" — die App las weiter alte Daten,
 * obwohl updateGroup den neuen Wert zurueckgab.
 */
import { describe, expect, it } from "vitest"

import { MockConnector } from "../src/mock-connector"

describe("MockConnector.updateGroup", () => {
  it("benachrichtigt Beobachter auch bei einer reinen data-Aenderung", async () => {
    const c = new MockConnector()
    await c.init()
    const first = c.observeGroups().current[0]
    const seen: unknown[] = []
    c.observeGroups().subscribe((groups) => seen.push(groups.find((g) => g.id === first.id)?.data?.radius))

    await c.updateGroup(first.id, { data: { radius: "full" } })

    expect(seen, "der Beobachter hat den neuen Wert gesehen").toEqual(["full"])
    expect(c.observeGroups().current.find((g) => g.id === first.id)?.data?.radius).toBe("full")
    expect(c.observeGroups().current.find((g) => g.id === first.id), "neues Objekt, nicht das alte").not.toBe(first)
  })

  it("fuehrt die aktuelle Gruppe mit", async () => {
    const c = new MockConnector()
    await c.init()
    const first = c.observeGroups().current[0]
    await c.setCurrentGroup(first.id)
    await c.updateGroup(first.id, { data: { tint: 0.4 } })
    expect(c.observeCurrentGroup().current?.data?.tint).toBe(0.4)
  })
})
