import { describe, expect, it } from "vitest"
import { composeTypeManifest, TOOLKIT_TYPE_LAYER } from "@real-life-stack/data-interface"

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
    expect(task.widgetLabels).toEqual({ text: "Beschreibung", people: "Zugewiesen" })
    expect(task.defaultStatus).toBe("open")
    expect(task.groupRequired).toBe(true)
    expect(resolveContentType("post")?.submitLabel).toBe("Posten")
    expect(resolveContentType("statement")?.submitLabel).toBe("Einbringen")
  })

  it("nimmt die Kanban-Spalten als Statuswerte — dieselben wie das Board", () => {
    expect(resolveContentType("task")?.statusOptions).toEqual(defaultColumns.map((c) => ({ id: c.id, label: c.label })))
  })

  it("leitet peopleRelation aus der Manifest-Kante ab, deren Widget people ist", () => {
    expect(resolveContentType("task")?.peopleRelation).toEqual({ predicate: "assignedTo" })
    expect(resolveContentType("event")?.peopleRelation).toEqual({ predicate: "invited" })
    expect(resolveContentType("post")?.peopleRelation).toBeUndefined()
  })

  it("nimmt Widgets und Beschriftung aus dem Darstellungs-Register", () => {
    const statement = resolveContentType("statement")!
    expect(statement.label).toBe("Aussage")
    expect(statement.defaultWidgets).toEqual(["title", "text", "tags"])
  })

  it("antwortet auf einen unbekannten Typ mit undefined statt zu werfen", () => {
    expect(resolveContentType("sighting")).toBeUndefined()
  })

  it("wählt eine Teilmenge in Register-Reihenfolge, egal wie sie gefragt wird", () => {
    expect(pickContentTypes("event", "post").map((t) => t.id)).toEqual(["post", "event"])
  })
})
