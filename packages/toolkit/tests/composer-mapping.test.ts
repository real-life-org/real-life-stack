import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { createComposerMapping, textFieldFor } from "../src/components/composer/composer-mapping"
import { toStoredDateTime } from "../src/components/composer/date-widget-state"
import type { ContentTypeConfig } from "../src/components/composer/content-composer"

const TYPES: ContentTypeConfig[] = [
  { id: "post", label: "Beitrag", defaultWidgets: ["title", "text"] },
  { id: "event", label: "Termin", defaultWidgets: ["title", "text", "date"] },
  {
    id: "task", label: "Aufgabe", defaultWidgets: ["title", "text", "people"],
    defaultStatus: "open", peopleRelation: { predicate: "assignedTo" },
  },
]
const { mapSubmission, editInitialData } = createComposerMapping(TYPES)

const task: Item = {
  id: "t1", type: "task", createdAt: "2026-09-13T10:00:00.000Z", createdBy: "u9",
  data: { title: "Beete umgraben", description: "Vor dem Regen.", status: "open", meetingLink: "https://x" },
  relations: [{ predicate: "commentOn", target: "item:x" }, { predicate: "assignedTo", target: "global:alt" }],
}
const event: Item = {
  id: "e1", type: "event", createdAt: "2026-09-13T10:00:00.000Z", createdBy: "u9",
  data: { title: "Erntefest", description: "Wir teilen.", start: "2026-09-19T14:00", end: "2026-09-19T18:00" },
}
const create = { mode: "create" as const, existingItem: null }
const edit = (existingItem: Item) => ({ mode: "edit" as const, existingItem })

describe("text field per type", () => {
  it("is content for posts and description for everything else", () => {
    expect(textFieldFor("post")).toBe("content")
    expect(textFieldFor("event")).toBe("description")
    expect(textFieldFor("event", { id: "event", label: "", defaultWidgets: [], textField: "content" })).toBe("content")
  })
})

describe("create", () => {
  it("strips the composer's empty defaults so a post never carries status or media", () => {
    const payload = mapSubmission(
      { contentType: "post", isPublic: true, data: { title: "Hallo", text: "Welt", status: "", media: [], tags: [], people: [] } },
      create,
    )
    expect(payload).toEqual({ type: "post", data: { title: "Hallo", content: "Welt" } })
  })

  it("gives a status-bearing type its default column", () => {
    const payload = mapSubmission({ contentType: "task", isPublic: true, data: { title: "Neu", status: "" } }, create)
    expect(payload?.data).toEqual({ title: "Neu", status: "open" })
  })

  it("writes people as relations, not as data", () => {
    const payload = mapSubmission({ contentType: "task", isPublic: true, data: { title: "Neu", people: ["u1"] } }, create)
    expect(payload?.data).not.toHaveProperty("people")
    expect(payload?.relations).toEqual([{ predicate: "assignedTo", target: "global:u1" }])
  })
})

describe("edit", () => {
  it("keeps fields the form does not show and removes a field the person cleared", () => {
    const payload = mapSubmission(
      { contentType: "task", isPublic: true, data: { title: "Beete umgraben", text: "", status: "" } },
      edit(task),
    )
    expect(payload?.data).toEqual({ title: "Beete umgraben", meetingLink: "https://x" })
  })

  it("never lets a title edit leak status onto an event", () => {
    const payload = mapSubmission(
      { contentType: "event", isPublic: true, data: { ...editInitialData(event), title: "Erntedank", status: "", group: "" } },
      edit(event),
    )
    // An older item's zone-less times are written back with the author's offset.
    expect(payload?.data).toEqual({ title: "Erntedank", description: "Wir teilen.", start: toStoredDateTime("2026-09-19T14:00"), end: toStoredDateTime("2026-09-19T18:00") })
    expect(payload?.data).not.toHaveProperty("status")
  })

  it("replaces the type's people relation and leaves other relations alone", () => {
    const payload = mapSubmission(
      { contentType: "task", isPublic: true, data: { title: "Beete umgraben", people: ["u1"] } },
      edit(task),
    )
    expect(payload?.relations).toEqual([
      { predicate: "commentOn", target: "item:x" },
      { predicate: "assignedTo", target: "global:u1" },
    ])
  })
})

describe("timed values", () => {
  it("stores a zone-less start from a calendar click with the author's offset", () => {
    const payload = mapSubmission({ contentType: "event", isPublic: true, data: { title: "Treffen", start: "2026-09-19T14:00" } }, create)
    const o = -new Date("2026-09-19T14:00").getTimezoneOffset()
    const sign = o >= 0 ? "+" : "-"
    const abs = Math.abs(o)
    expect(payload?.data.start).toBe(`2026-09-19T14:00:00${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`)
  })

  it("keeps an all-day start as a bare date", () => {
    const payload = mapSubmission({ contentType: "event", isPublic: true, data: { title: "Fest", start: "2026-09-19" } }, create)
    expect(payload?.data.start).toBe("2026-09-19")
  })
})

describe("editInitialData", () => {
  it("is the inverse of the mapper: text from the type's field, people from its predicate", () => {
    expect(editInitialData(task)).toEqual({ title: "Beete umgraben", text: "Vor dem Regen.", status: "open", people: ["alt"], tags: [] })
    expect(editInitialData(event)).toMatchObject({ text: "Wir teilen.", start: "2026-09-19T14:00", end: "2026-09-19T18:00" })
  })
})

describe("Klassenmengen im Bearbeiten (Spec 06, Regel 8 und 9; Codex zu rls#417)", () => {
  const mehrklassig: Item = {
    id: "m1", type: ["post", "statement"] as unknown as string, createdAt: "2026-09-21T10:00:00.000Z", createdBy: "u9",
    data: { title: "Beides", content: "Alter Text" },
  }

  it("bearbeitet mit der Vorlage der ersten Klasse, speichert aber die ganze Menge", () => {
    const out = mapSubmission(
      { contentType: "post", data: { title: "Beides", text: "Neuer Text", tags: [] } },
      { existingItem: mehrklassig },
    )
    expect(out.type).toEqual(["post", "statement"])
    expect(out.data.content).toBe("Neuer Text")
  })

  it("belegt das Formular aus der Vorlage der ersten Klasse vor", () => {
    expect(editInitialData(mehrklassig).text).toBe("Alter Text")
  })
})
