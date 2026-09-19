import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { createComposerMapping, textFieldFor } from "../src/components/composer/composer-mapping"
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
    expect(payload?.data).toEqual({ title: "Erntedank", description: "Wir teilen.", start: "2026-09-19T14:00", end: "2026-09-19T18:00" })
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

describe("editInitialData", () => {
  it("is the inverse of the mapper: text from the type's field, people from its predicate", () => {
    expect(editInitialData(task)).toEqual({ title: "Beete umgraben", text: "Vor dem Regen.", status: "open", people: ["alt"], tags: [] })
    expect(editInitialData(event)).toMatchObject({ text: "Wir teilen.", start: "2026-09-19T14:00", end: "2026-09-19T18:00" })
  })
})
