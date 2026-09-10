import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { waehleProfilZiel } from "./profil-ziel"

const projektion = (userId: string): Item =>
  ({
    id: userId,
    type: "person",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: userId,
    data: { did: userId, displayName: "Kollegin" },
  }) as Item

const platzhalter = (id: string): Item =>
  ({
    id,
    type: "person",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "user-1",
    data: { displayName: "Ulf" },
  }) as Item

const post: Item = {
  id: "p1",
  type: "post",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "user-2",
  data: { content: "Hallo" },
} as Item

describe("Autor-Klick — ein Weg für Mitglieder, der Dialog für den Rest", () => {
  it("führt zum person-Item, wenn die Person im Space steht", () => {
    const ziel = waehleProfilZiel("user-2", [post, projektion("user-2")])
    expect(ziel).toEqual({ flaeche: "item", itemId: "user-2" })
  })

  it("bleibt beim Dialog, wenn die Person kein Mitglied des Space ist", () => {
    expect(waehleProfilZiel("user-9", [post, projektion("user-2")])).toEqual({ flaeche: "dialog" })
  })

  it("nimmt einen Platzhalter NICHT für eine Projektion — er hat kein did", () => {
    expect(waehleProfilZiel("platzhalter-1", [platzhalter("platzhalter-1")])).toEqual({
      flaeche: "dialog",
    })
  })

  it("gibt den Dialog frei, wenn der Aufrufer ihn ausdrücklich verlangt", () => {
    const ziel = waehleProfilZiel("user-2", [projektion("user-2")], { surface: "dialog" })
    expect(ziel).toEqual({ flaeche: "dialog" })
  })
})
