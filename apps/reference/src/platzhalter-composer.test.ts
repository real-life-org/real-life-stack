import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import {
  ALL_CONTENT_TYPES,
  FEED_CREATE_TYPES,
  MAP_CREATE_TYPES,
  resolveContentType,
} from "./content-types"
import { itemToComposerData, mapComposerSubmission } from "./composer-mapping"

/**
 * Der Platzhalter: ein `person`-Item OHNE did, angelegt wie jeder Beitrag
 * (Spec 04 §Profile, Regel 5). Diese Tests halten fest, dass der Composer den
 * Typ fuehrt und seine Felder auf person/v1 abbildet — Titel ist der Name,
 * Freitext die Bio.
 */
describe("person als Composer-Typ", () => {
  it("steht im Composer-Register", () => {
    const person = resolveContentType("person")
    expect(person?.label).toBe("Person")
    expect(ALL_CONTENT_TYPES.map((t) => t.id)).toContain("person")
  })

  it("fuehrt Name, Bio, Ort und Tags — und kein did-Feld", () => {
    const person = resolveContentType("person")!
    expect(person.defaultWidgets).toEqual(["title", "text", "location", "tags"])
    expect(person.defaultWidgets).not.toContain("did")
  })

  it("verlangt den Namen: displayName ist Pflicht (person/v1)", () => {
    expect(resolveContentType("person")?.titleRequired).toBe(true)
  })

  it("sagt im Typ-Wahl-Hinweis, wofuer ein Platzhalter da ist", () => {
    expect(resolveContentType("person")?.hint).toContain("noch nicht im Netz")
  })

  it("laesst sich in Feed und Karte anlegen, wie post und event", () => {
    expect(FEED_CREATE_TYPES.map((t) => t.id)).toContain("person")
    expect(MAP_CREATE_TYPES.map((t) => t.id)).toContain("person")
  })
})

describe("Composer-Abbildung fuer person", () => {
  const submission = (data: Record<string, unknown>) => ({
    contentType: "person",
    isPublic: true,
    data: data as never,
  })
  /** Der Mapper kann `null` liefern (nichts zu speichern) — die Tests hier
   *  erwarten immer eine Nutzlast. */
  const mappe = (data: Record<string, unknown>, existingItem: Item | null = null) => {
    const payload = mapComposerSubmission(submission(data), {
      mode: existingItem ? "edit" : "create",
      existingItem,
    })
    expect(payload).not.toBeNull()
    return payload!
  }

  it("schreibt den Titel als displayName und den Text als bio", () => {
    const payload = mappe({ title: "Ulf", text: "Gartenbau" })
    expect(payload.type).toBe("person")
    expect(payload.data).toMatchObject({ displayName: "Ulf", bio: "Gartenbau" })
    expect(payload.data).not.toHaveProperty("title")
    expect(payload.data).not.toHaveProperty("description")
  })

  it("legt NIE ein did an — ein Platzhalter ist keine Projektion", () => {
    const payload = mappe({ title: "Ulf", text: "", did: "did:key:fremd" })
    expect(payload.data).not.toHaveProperty("did")
  })

  it("nimmt die Position aus dem Ort-Widget mit", () => {
    const payload = mappe({
      title: "Ulf",
      address: "Kassel",
      position: { type: "Point", coordinates: [9.5, 51.3] },
    })
    expect(payload.data).toMatchObject({
      address: "Kassel",
      position: { type: "Point", coordinates: [9.5, 51.3] },
    })
  })

  it("fuellt das Bearbeiten-Formular aus displayName und bio zurueck", () => {
    const item = {
      id: "platzhalter-1",
      type: "person",
      createdAt: "2026-09-01T10:00:00.000Z",
      createdBy: "user-1",
      data: { displayName: "Ulf", bio: "Gartenbau", address: "Kassel" },
      tags: ["nachbarschaft"],
    } as Item
    expect(itemToComposerData(item)).toMatchObject({
      title: "Ulf",
      text: "Gartenbau",
      address: "Kassel",
      tags: ["nachbarschaft"],
    })
  })

  it("loescht beim Bearbeiten eine geleerte Bio, behaelt aber den Namen", () => {
    const existing = {
      id: "platzhalter-1",
      type: "person",
      createdAt: "2026-09-01T10:00:00.000Z",
      createdBy: "user-1",
      data: { displayName: "Ulf", bio: "Gartenbau" },
    } as Item
    const payload = mappe({ title: "Ulf Neu", text: "" }, existing)
    expect(payload.data).toMatchObject({ displayName: "Ulf Neu" })
    expect(payload.data).not.toHaveProperty("bio")
  })
})
