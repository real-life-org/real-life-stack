// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { composeTypeManifest, TOOLKIT_TYPE_LAYER, type Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import {
  registerTypePresentation,
  resetTypePresentationForTests,
  resolveTypePresentation,
  setTypeManifest,
} from "../src/components/preview/type-presentation"
import type { EdgeEntry, FieldEntry } from "../src/components/preview/field-register"

/**
 * #557: Zusatz (`list.trailing`) und Gruppen (`list.group`) einer
 * Rückwärts-Liste über eine Kante (Spec 06, Regeln 10 und 22;
 * shared-components, Detail-Anatomie Regel 8; rls#572).
 *
 * Die Felddefinition kommt aus dem Register des Typs am anderen Endpunkt
 * (`otherKind`), der Wert aus `data[key]` jedes Eintrags. Nur status, select,
 * number, nicht `pos: "system"`. Gruppen: Reihenfolge der Optionen, dann
 * unbekannte Werte nach Id, bei number aufsteigend; „Ohne Angabe" zuletzt;
 * keine leeren Gruppen; ohne jeden Wert keine Gliederung.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"

// Die Karabirrdt-Form (nichtnormativ, Regel 22): Karten gehören zu einem
// Projekt (`partOf`), die Liste „Karten" steht am Projekt.
const MANIFEST = composeTypeManifest([
  TOOLKIT_TYPE_LAYER,
  {
    name: "app",
    definitions: [{ id: "card", vocabularies: [], relations: [{ predicate: "partOf", itemRole: "from", otherKind: "project" }] }],
    extensions: [{ id: "project", relations: [{ predicate: "partOf", itemRole: "to", otherKind: "card" }] }],
  },
])

const CARD_FIELDS: readonly FieldEntry[] = [
  { key: "title", widget: "title", pos: "head" },
  { key: "stage", widget: "number", pos: "module", label: "Stufe" },
  { key: "hours", widget: "number", pos: "meta", unit: "h" },
  {
    key: "state",
    widget: "status",
    pos: "meta",
    label: "Zustand",
    options: [
      { id: "open", label: "Offen", role: "open" },
      { id: "doing", label: "Dran", role: "active", tone: "warning" },
      { id: "done", label: "Fertig", role: "done" },
    ],
  },
  { key: "kind", widget: "select", pos: "meta", label: "Art", options: [{ id: "a", label: "Aussaat" }, { id: "b", label: "Bau" }] },
  { key: "note", widget: "text", pos: "content" },
  { key: "secret", widget: "number", pos: "system" },
]

const listEdge = (list: EdgeEntry["list"], extra: Partial<EdgeEntry> = {}): EdgeEntry => ({
  predicate: "partOf",
  itemRole: "to",
  storage: "embedded",
  widget: "item-relation",
  pos: "list",
  label: "Karten",
  list,
  ...extra,
})

function setup(list: EdgeEntry["list"], extra: Partial<EdgeEntry> = {}) {
  setTypeManifest(MANIFEST)
  registerTypePresentation("app", {
    definitions: [{ id: "card", label: "Karte", fields: CARD_FIELDS, badge: { icon: () => null, className: "bg-orange-50 text-orange-700 border-orange-200" } }],
    extensions: [{ id: "project", edges: [listEdge(list, extra)] }],
  })
}

afterEach(() => resetTypePresentationForTests())

describe("Kompositionsprüfung (Regel 22)", () => {
  it("trailing und group nennen ein Feld des Typs am anderen Endpunkt; pos module ist erlaubt", () => {
    setup({ trailing: "state", group: "stage" })
    expect(resolveTypePresentation("project").edges?.[0]?.list).toEqual({ trailing: "state", group: "stage" })
  })

  it("beide DÜRFEN dasselbe Feld nennen", () => {
    expect(() => setup({ trailing: "stage", group: "stage" })).not.toThrow()
  })

  it("ein Feld, das der Typ am anderen Endpunkt nicht führt, wird abgelehnt", () => {
    expect(() => setup({ trailing: "missing" })).toThrow(/trailing.*missing/)
    resetTypePresentationForTests()
    expect(() => setup({ group: "missing" })).toThrow(/group.*missing/)
  })

  it("nur status, select oder number", () => {
    expect(() => setup({ group: "note" })).toThrow(/status, select oder number/)
    resetTypePresentationForTests()
    expect(() => setup({ trailing: "title" })).toThrow(/status, select oder number/)
  })

  it("nicht pos system", () => {
    expect(() => setup({ trailing: "secret" })).toThrow(/system/)
  })

  it("nur an einer Rückwärts-Liste (pos list, itemRole to)", () => {
    expect(() => setup({ trailing: "state" }, { pos: "meta" })).toThrow(/pos "list"/)
  })

  it("eine andere Schicht rüstet trailing/group an einer Kante nicht nach (kein Override)", () => {
    setup({})
    expect(() =>
      registerTypePresentation("zweite", { extensions: [{ id: "project", edges: [listEdge({ trailing: "state" })] }] }),
    ).toThrow(/um/)
  })
})

// ---------------------------------------------------------------------------
// Darstellung

let host: HTMLDivElement
let root: Root

async function settle() {
  for (let round = 0; round < 5; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

const PROJECT: Item = { id: "p1", type: "project", createdBy: ME, createdAt: "2026-09-29T10:00:00.000Z", data: { title: "Karabirrdt" }, relations: [] }
let seq = 0
const card = (id: string, data: Record<string, unknown>, type = "card"): Item => ({
  id,
  type,
  createdBy: ME,
  createdAt: `2026-09-29T10:00:${String(seq++ % 60).padStart(2, "0")}.000Z`,
  data: { title: id, ...data },
  relations: [{ predicate: "partOf", target: "item:p1" }],
})

async function render(items: Item[]) {
  const all = [PROJECT, ...items]
  const connector = new MockConnector(
    {
      items: all,
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [{ id: ME, displayName: "Ich" }],
      groupMembers: { g: [ME] },
      groupItems: { g: all.map((i) => i.id) },
    } as never,
    { allowFixtureAuthors: true },
  )
  await connector.init()
  connector.setCurrentGroup("g")
  const Reverse = resolveTypePresentation("project").reverse!
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Reverse, { item: PROJECT })))
  })
  await settle()
}

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

const groups = () =>
  [...host.querySelectorAll("[data-list-group]")].map((g) => ({
    heading: g.querySelector("[data-list-group-heading]")?.textContent?.replace(/\s+/g, " ").trim(),
    rows: [...g.querySelectorAll("[data-list-row]")].map((r) => r.getAttribute("data-list-row")),
  }))
const rowIds = () => [...host.querySelectorAll("[data-list-row]")].map((r) => r.getAttribute("data-list-row"))
const trailingOf = (id: string) => host.querySelector(`[data-list-row="${id}"] [data-list-trailing]`)

describe("Gruppen (list.group)", () => {
  it("number: aufsteigend (numerisch), „Ohne Angabe“ zuletzt; Zwischenüberschrift mit Label und Anzahl; der Kopf behält die Gesamtzahl", async () => {
    setup({ group: "stage" })
    await render([
      card("c10", { stage: 10 }),
      card("c2", { stage: 2 }),
      card("leer", { stage: "" }),
      card("c1a", { stage: 1 }),
      card("ohne", {}),
      card("c1b", { stage: "1" }),
      card("null", { stage: null }),
    ])
    expect(groups()).toEqual([
      { heading: "Stufe 1 2", rows: ["c1a", "c1b"] },
      { heading: "Stufe 2 1", rows: ["c2"] },
      { heading: "Stufe 10 1", rows: ["c10"] },
      { heading: "Ohne Angabe 3", rows: ["leer", "ohne", "null"] },
    ])
    expect(host.querySelector("[data-reverse-list] h3")?.textContent?.replace(/\s+/g, " ").trim()).toBe("Karten 7")
  })

  it("status: Reihenfolge der Optionen, dann unbekannte Werte nach Id (ohne Zustandstext), „Ohne Angabe“ zuletzt; keine leeren Gruppen", async () => {
    setup({ group: "state" })
    await render([
      card("z", { state: "zzz" }),
      card("f", { state: "done" }),
      card("a", { state: "aaa" }),
      card("o", { state: "open" }),
      card("n", {}),
    ])
    expect(groups().map((g) => g.heading)).toEqual(["Offen 1", "Fertig 1", "aaa 1", "zzz 1", "Ohne Angabe 1"])
    // „Dran“ hat keinen Eintrag: keine leere Gruppe.
    expect(host.textContent).not.toContain("Dran")
  })

  it("die Gliederung behält die Reihenfolge der Einträge in jeder Gruppe (darauf setzt sort aus #545 auf; die Semantik von sort legt #572 nicht fest)", async () => {
    setup({ group: "stage" })
    await render([card("x1", { stage: 1 }), card("y2", { stage: 2 }), card("x2", { stage: 1 }), card("x3", { stage: 1 })])
    expect(groups()[0]?.rows).toEqual(["x1", "x2", "x3"])
  })

  it("gegliedert wird nach dem Filter: eine Gruppe, deren Einträge der Filter nimmt, entsteht nicht", async () => {
    setup({ group: "stage", filter: "open" })
    await render([card("a", { stage: 1, state: "open" }), card("b", { stage: 2, state: "done" })])
    expect(groups().map((g) => g.heading)).toEqual(["Stufe 1 1"])
  })

  it("hat kein Eintrag einen Wert, entfällt die Gliederung", async () => {
    setup({ group: "stage" })
    await render([card("a", {}), card("b", { stage: "" })])
    expect(host.querySelector("[data-list-group]")).toBeNull()
    expect(rowIds()).toEqual(["a", "b"])
  })

  it("Gruppen kappen nicht: alle Einträge, jeder einmal", async () => {
    setup({ group: "stage" })
    const many = Array.from({ length: 12 }, (_, i) => card(`k${i}`, { stage: i % 3 }))
    await render(many)
    expect(rowIds().sort()).toEqual(many.map((c) => c.id).sort())
  })
})

describe("Zusatz (list.trailing)", () => {
  it("eine Option als Wort in ihrem Ton, das Label als zugänglicher Name; ohne Wert steht dort nichts", async () => {
    setup({ trailing: "state" })
    await render([card("a", { state: "doing" }), card("b", {}), card("c", { state: "weird" })])
    const a = trailingOf("a")
    expect(a?.textContent).toContain("Dran")
    expect(a?.getAttribute("data-tone")).toBe("warning")
    expect(a?.querySelector(".sr-only")?.textContent).toContain("Zustand")
    expect(trailingOf("b")).toBeNull()
    // Ein unbekannter Wert steht als er selbst, neutral.
    expect(trailingOf("c")?.textContent).toContain("weird")
    expect(trailingOf("c")?.getAttribute("data-tone")).toBe("neutral")
  })

  it("eine Zahl mit Einheit; ohne Label kein zugänglicher Name", async () => {
    setup({ trailing: "hours" })
    await render([card("a", { hours: 1.5 })])
    expect(trailingOf("a")?.textContent?.trim()).toBe("1,5 h")
    expect(trailingOf("a")?.querySelector(".sr-only")).toBeNull()
  })

  it("Zusatz und Gruppen zusammen: gegliederte Zeilen mit dem Wert rechts", async () => {
    setup({ trailing: "stage", group: "state" })
    await render([card("a", { state: "open", stage: 3 }), card("b", { state: "doing", stage: 1 })])
    expect(groups().map((g) => g.heading)).toEqual(["Offen 1", "Dran 1"])
    expect(trailingOf("a")?.textContent).toContain("3")
  })
})

describe("Codex Runde 1", () => {
  it("Befund 4: eine select-Option ohne Ton trägt in Zwischenüberschrift und Zusatz die Typfarbe des Eintrags (Regel 21)", async () => {
    setup({ group: "kind", trailing: "kind" })
    await render([card("a", { kind: "a" })])
    const dot = host.querySelector("[data-list-group-heading] [data-tone-dot]")
    expect(dot?.getAttribute("data-tone")).toBe("type")
    expect(dot?.className).toContain("text-orange-700")
    expect(trailingOf("a")?.querySelector("[data-tone-dot]")?.className).toContain("text-orange-700")
  })
})
