import { describe, expect, it } from "vitest"
import { composeTypeManifest, TOOLKIT_TYPE_LAYER } from "@real-life/data-interface"

import { contentTypesFromRegister, resolveContentType, pickContentTypes } from "../src/components/composer/content-types"
import { setTypeManifest } from "../src/components/preview/type-presentation"
import { defaultColumns } from "../src/components/kanban/kanban-board"

/**
 * Bis zum 21.09.2026 setzte die Referenz-App die Inhaltstypen selbst
 * zusammen — mit einer Handliste der Ids und `APP_EXTRAS`. Jetzt kommt alles
 * aus dem Register (Spec 06; Spec 01 „Der Modul-Host", Regel 1: ein
 * Toolkit-Typ läuft ohne eine Zeile in der App).
 */
describe("Inhaltstypen aus dem Register", () => {
  setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER]))

  it("kennt jeden Toolkit-Typ mit Darstellung, in Manifest-Reihenfolge — keine Handliste", () => {
    expect(contentTypesFromRegister().map((t) => t.id)).toEqual([
      "post", "event", "place", "task", "person", "project", "resource", "statement",
    ])
  })

  it("trägt die früheren APP_EXTRAS als Darstellung des Typs", () => {
    const task = resolveContentType("task")!
    expect(task.submitLabel).toBeUndefined()
    expect(task.widgetLabels).toEqual({ text: "Beschreibung", date: "Fällig" })
    // Der Kern deklariert keine role-Werte (Regel 20, Option D): kein Qualifier im Formular.
    expect(task.peopleRelations).toEqual([{ predicate: "assignedTo", label: "Zugewiesen", placeholder: "Zuweisen…" }])
    expect(task.defaultStatus).toBe("open")
    expect(task.groupRequired).toBe(true)
    expect(resolveContentType("post")?.submitLabel).toBe("Posten")
    expect(resolveContentType("statement")?.submitLabel).toBe("Einbringen")
  })

  it("nimmt die Kanban-Spalten als Statuswerte — dieselben wie das Board", () => {
    expect(resolveContentType("task")?.statusOptions?.map(({ id, label }) => ({ id, label }))).toEqual(defaultColumns.map((c) => ({ id: c.id, label: c.label })))
    // Ton der Pille aus der Rolle (06, Regel 21).
    expect(resolveContentType("task")?.statusOptions?.map((o) => o.tone)).toEqual(["neutral", "warning", "success"])
  })

  it("leitet die Personenfelder aus den Personen-Kanten der Feld- und Kantenliste ab", () => {
    expect(resolveContentType("task")?.peopleRelations?.map((p) => p.predicate)).toEqual(["assignedTo"])
    expect(resolveContentType("event")?.peopleRelations?.map((p) => p.predicate)).toEqual(["invited"])
    expect(resolveContentType("post")?.peopleRelations).toBeUndefined()
    expect(resolveContentType("post")?.peopleRelation).toBeUndefined()
  })

  it("nimmt Widgets und Beschriftung aus dem Darstellungs-Register", () => {
    const statement = resolveContentType("statement")!
    expect(statement.label).toBe("Aussage")
    // variantOf (B15, fest) steht als Meta-Feld im Formular, sichtbar nur mit Wert (S3).
    expect(statement.defaultWidgets).toEqual(["title", "text", "item-ref", "tags"])
  })

  it("antwortet auf einen unbekannten Typ mit undefined statt zu werfen", () => {
    expect(resolveContentType("sighting")).toBeUndefined()
  })

  it("wählt eine Teilmenge in Register-Reihenfolge, egal wie sie gefragt wird", () => {
    expect(pickContentTypes("event", "post").map((t) => t.id)).toEqual(["post", "event"])
  })
})
