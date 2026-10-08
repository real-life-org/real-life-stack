// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life/data-interface"
import { MockConnector } from "@real-life/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { MemoryFocusProvider, useItemFocus } from "../src/hooks/use-item-focus"
import { resolveTypePresentation } from "../src/components/preview/type-presentation"
import { edgeTargets } from "../src/components/preview/use-item-edges"

/**
 * S3, Teil B: Item-Kanten (C3) lesen. Spec: shared-components → „Item-Detail
 * aus dem Register", Widget-Paare C3, Detail-Anatomie Regel 4; Entscheidung 19
 * („Braucht" eingehend, „Ermöglicht" ausgehend).
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"

const item = (id: string, type: string, data: Record<string, unknown>, relations: Item["relations"] = []): Item => ({
  id, type, createdBy: ME, createdAt: "2026-09-20T10:00:00.000Z", data, relations,
})

const PROJECT = item("p1", "project", { title: "Gartenprojekt" })
const BEETPLAN = item("t-beet", "task", { title: "Beetplan für den Herbst", status: "open" })
const ERNTE = item("t-ernte", "task", { title: "Ernte einholen", status: "done" })
const KOMPOST = item("t-kompost", "task", { title: "Kompost umsetzen", status: "in-progress" }, [
  { predicate: "blocks", target: "item:t-beet" },
  { predicate: "blocks", target: "item:t-ernte" },
  { predicate: "blocks", target: "item:weg" },
  { predicate: "partOf", target: "item:p1" },
])
// Eingehend: Diese Aufgabe blockiert den Kompost → beim Kompost „Braucht".
const SCHUBKARRE = item("t-karre", "task", { title: "Schubkarre reparieren", status: "open" }, [
  { predicate: "blocks", target: "item:t-kompost" },
])
// Ein Item anderen Typs mit derselben Kante ist kein Ziel (Manifest: otherKind task).
const FREMD = item("x-post", "post", { content: "Ich blockiere" }, [{ predicate: "blocks", target: "item:t-kompost" }])

let host: HTMLDivElement
let root: Root

async function settle() {
  for (let round = 0; round < 5; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

let focused: string | null = null
function FocusSpy(): ReactNode {
  focused = useItemFocus().itemId ?? null
  return null
}

async function render(node: ReactNode, items: Item[] = [PROJECT, BEETPLAN, ERNTE, KOMPOST, SCHUBKARRE, FREMD]) {
  const connector = new MockConnector(
    {
      items,
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [{ id: ME, displayName: "Ich" }],
      groupMembers: { g: [ME] },
      groupItems: { g: items.map((i) => i.id) },
    } as never,
    { allowFixtureAuthors: true },
  )
  await connector.init()
  connector.setCurrentGroup("g")
  await act(async () => {
    root.render(
      createElement(ConnectorProvider, { connector: connector as never },
        createElement(MemoryFocusProvider, { module: "kanban", scope: "g" } as never, node, createElement(FocusSpy))),
    )
  })
  await settle()
}

const row = (id: string) => host.querySelector(`[data-meta-row="${id}"]`)
const chipTitles = (el: Element | null) => [...(el?.querySelectorAll("[data-item-ref]") ?? [])].map((c) => c.textContent?.replace(" (erledigt)", "").trim())

beforeEach(() => {
  focused = null
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe("C3 lesen: Item-Kanten der Aufgabe", () => {
  it("Braucht (eingehend), Ermöglicht (ausgehend), Teil von — je eine Zeile mit Label", async () => {
    const Meta = resolveTypePresentation("task").detail
    await render(createElement(Meta, { item: KOMPOST }))
    expect(row("blocks:to")?.textContent).toContain("Braucht")
    expect(chipTitles(row("blocks:to"))).toEqual(["Schubkarre reparieren"])
    expect(row("blocks:from")?.textContent).toContain("Ermöglicht")
    // Das nicht auflösbare Ziel erscheint nicht (08, Regel 8).
    expect(chipTitles(row("blocks:from"))).toEqual(["Beetplan für den Herbst", "Ernte einholen"])
    expect(row("partOf:from")?.textContent).toContain("Teil von")
    expect(chipTitles(row("partOf:from"))).toEqual(["Gartenprojekt"])
  })

  it("Chips in der Typfarbe des Ziels; ein erledigtes Ziel ist durchgestrichen", async () => {
    const Meta = resolveTypePresentation("task").detail
    await render(createElement(Meta, { item: KOMPOST }))
    const ernte = host.querySelector('[data-item-ref="t-ernte"]')
    expect(ernte?.querySelector(".line-through")).toBeTruthy()
    expect(ernte?.textContent).toContain("(erledigt)")
    const beet = host.querySelector('[data-item-ref="t-beet"]')
    expect(beet?.querySelector(".line-through")).toBeNull()
    const taskBadge = resolveTypePresentation("task").badge!.className.split(" ")[0]!
    expect(beet?.querySelector("button")?.className).toContain(taskBadge)
  })

  it("ein Klick öffnet das Ziel in derselben Panel-Instanz (Fokus wechselt)", async () => {
    const Meta = resolveTypePresentation("task").detail
    await render(createElement(Meta, { item: KOMPOST }))
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-item-ref="p1"] button')!.click()
    })
    await settle()
    expect(focused).toBe("p1")
  })

  it("ohne Kanten keine Zeile, keine leere Box", async () => {
    const Meta = resolveTypePresentation("task").detail
    const leer = item("t-leer", "task", { title: "Leer" })
    await render(createElement(Meta, { item: leer }), [leer])
    expect(host.innerHTML).toBe("")
  })

  it("„+N“ ohne Platz: drei Chips, dann ein Knopf, der alle zeigt", async () => {
    const many = Array.from({ length: 5 }, (_, i) => item(`t-${i}`, "task", { title: `Aufgabe ${i}`, status: "open" }))
    const hub = item("t-hub", "task", { title: "Knoten" }, many.map((m) => ({ predicate: "blocks", target: `item:${m.id}` })))
    const Meta = resolveTypePresentation("task").detail
    await render(createElement(Meta, { item: hub }), [hub, ...many])
    const more = row("blocks:from")?.querySelector<HTMLButtonElement>("[data-more]")
    expect(more?.textContent).toBe("+2")
    expect(chipTitles(row("blocks:from"))).toHaveLength(3)
    await act(async () => more!.click())
    expect(chipTitles(row("blocks:from"))).toHaveLength(5)
  })
})

describe("edgeTargets (rein)", () => {
  const blocksFrom = resolveTypePresentation("task").edges!.find((e) => e.predicate === "blocks" && e.itemRole === "from")!
  const blocksTo = resolveTypePresentation("task").edges!.find((e) => e.predicate === "blocks" && e.itemRole === "to")!

  it("eingehend nur von Items der Gegenstelle, jedes einmal", () => {
    const doppelt = item("t-d", "task", { title: "Doppelt" }, [
      { predicate: "blocks", target: "item:t-kompost" },
      { predicate: "blocks", target: "item:t-kompost" },
    ])
    const targets = edgeTargets(KOMPOST, blocksTo, [SCHUBKARRE, FREMD, doppelt, KOMPOST], "task")
    expect(targets.map((t) => t.item.id)).toEqual(["t-karre", "t-d"])
  })

  it("ausgehend auch über space:{id}/item:, nie das Item selbst", () => {
    const selbst = item("t-s", "task", { title: "S" }, [
      { predicate: "blocks", target: "item:t-s" },
      { predicate: "blocks", target: "space:g/item:t-beet" },
    ])
    const spaceOf = () => "g"
    expect(edgeTargets(selbst, blocksFrom, [selbst, BEETPLAN], "task", spaceOf).map((t) => t.item.id)).toEqual(["t-beet"])
  })

  it("Codex R1/1: Targets sind space-lokal — kein Treffer über Space-Grenzen (04)", () => {
    const spaces: Record<string, string> = { "t-s": "g", "t-beet": "g", "t-fremd": "h" }
    const spaceOf = (id: string) => spaces[id] ?? null
    const fremd = item("t-fremd", "task", { title: "Fremd" })
    const selbst = item("t-s", "task", { title: "S" }, [
      { predicate: "blocks", target: "space:other/item:t-beet" },
      { predicate: "blocks", target: "item:t-fremd" },
    ])
    expect(edgeTargets(selbst, blocksFrom, [BEETPLAN, fremd], "task", spaceOf)).toEqual([])
    // Eingehend: ein Item in einem anderen Space mit item:t-s meint ein anderes t-s.
    const drüben = item("t-fremd", "task", { title: "Fremd" }, [{ predicate: "blocks", target: "item:t-s" }])
    expect(edgeTargets(selbst, blocksTo, [drüben], "task", spaceOf)).toEqual([])
    const qualifiziert = item("t-fremd", "task", { title: "Fremd" }, [{ predicate: "blocks", target: "space:g/item:t-s" }])
    expect(edgeTargets(selbst, blocksTo, [qualifiziert], "task", spaceOf).map((t) => t.item.id)).toEqual(["t-fremd"])
  })
})

describe("C3 schreiben: Formular der Aufgabe", () => {
  it("Register → Formular: Braucht (eingehend, S3b), Ermöglicht und Teil von als Felder", async () => {
    const { contentTypeFromRegister } = await import("../src/components/composer/content-types")
    const config = contentTypeFromRegister("task")
    expect(config.itemRelations).toEqual([
      { predicate: "blocks", label: "Braucht", placeholder: "@ Aufgabe suchen…", targetType: "task", incoming: true },
      { predicate: "blocks", label: "Ermöglicht", placeholder: "@ Aufgabe suchen…", targetType: "task" },
      { predicate: "partOf", label: "Teil von", placeholder: "@ Projekt suchen…", targetType: "project" },
    ])
    expect(config.defaultWidgets).toContain("item-relation")
    // Formularreihenfolge: Titel → Beschreibung → Meta (Menschen → Zeit → Item-Kanten → Werte) → Tags.
    expect(config.defaultWidgets).toEqual(["title", "text", "people", "date", "item-relation", "status", "tags"])
  })

  it("Abbildung: nur die Prädikate der Felder werden ersetzt; bleibende Kanten behalten Stelle und meta", async () => {
    const { mapComposerSubmission, itemToComposerData } = await import("../src/components/composer/content-types")
    const existing = item("t-x", "task", { title: "X", status: "open" }, [
      { predicate: "assignedTo", target: "global:u-me" },
      { predicate: "blocks", target: "item:t-beet", meta: { role: "hard" } },
      { predicate: "blocks", target: "item:t-ernte" },
      { predicate: "relatedTo", target: "item:fremd" },
    ])
    const initial = itemToComposerData(existing)
    expect(initial["relation:blocks"]).toEqual(["item:t-beet", "item:t-ernte"])
    expect(initial["relation:partOf"]).toEqual([])
    const mapped = mapComposerSubmission(
      { contentType: "task", isPublic: false, data: { ...initial, "relation:blocks": ["item:t-beet", "item:t-karre"], "relation:partOf": ["item:p1"] } } as never,
      { mode: "edit", existingItem: existing },
    )!
    // Die Personen-Kanten ordnet der Personen-Mapper hinter die übrigen (S2).
    expect(mapped.relations).toEqual([
      { predicate: "blocks", target: "item:t-beet", meta: { role: "hard" } },
      { predicate: "relatedTo", target: "item:fremd" },
      { predicate: "assignedTo", target: "global:u-me" },
      { predicate: "blocks", target: "item:t-karre" },
      { predicate: "partOf", target: "item:p1" },
    ])
    expect(mapped.data).not.toHaveProperty("relation:blocks")
    expect(mapped.data).not.toHaveProperty("relation:partOf")
  })

  it("Widget: @-Suche über Aufgaben des Space fügt hinzu, ✕ entfernt; das Item selbst wird nie angeboten", async () => {
    const { ItemRelationWidget } = await import("../src/components/composer/widgets/item-relation-widget")
    let value: string[] = ["item:t-beet"]
    const Harness = () => {
      const [v, setV] = useState<string[]>(value)
      value = v
      return createElement(ItemRelationWidget, { label: "Ermöglicht", predicate: "blocks", targetType: "task", value: v, onChange: setV, excludeId: "t-kompost", spaceId: "g" })
    }
    await render(createElement(Harness))
    const input = host.querySelector<HTMLInputElement>('[data-item-relation-field="blocks"] input')!
    await act(async () => {
      input.focus()
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(input, "@schub")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await settle()
    const options = [...host.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim())
    expect(options).toEqual(["Schubkarre reparieren"])
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    expect(value).toEqual(["item:t-beet", "item:t-karre"])
    // Ohne Suchtext: alle Aufgaben außer dem Item selbst, den gewählten und Nicht-Aufgaben.
    await act(async () => {
      input.blur()
      input.focus()
    })
    const all = [...host.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim())
    expect(all).not.toContain("Kompost umsetzen")
    expect(all).not.toContain("Beetplan für den Herbst")
    expect(all).toContain("Ernte einholen (erledigt)")
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="Beetplan für den Herbst entfernen"]')!.click()
    })
    expect(value).toEqual(["item:t-karre"])
  })
})

describe("B15 item-ref und Rückwärts-Listen aus dem Register", () => {
  it("Detail: eine abgedeckte item-ref-Zeile entfällt (covers), eine nicht abgedeckte erscheint als Chip oder Text", async () => {
    const { RegisterMeta } = await import("../src/components/preview/register-meta")
    const field = { key: "basedOn", widget: "item-ref" as const, pos: "meta" as const, label: "Beruht auf", ref: { type: "task", missing: "nicht verfügbare Aufgabe" } }
    const a = item("n1", "note", { title: "Notiz", basedOn: "item:t-beet" })
    const b = item("n2", "note", { title: "Notiz", basedOn: "item:weg" })
    await render(createElement("div", null,
      createElement(RegisterMeta, { item: a, fields: [field] }),
      createElement(RegisterMeta, { item: b, fields: [field] }),
      createElement("div", { id: "covered" }, createElement(RegisterMeta, { item: a, fields: [field], lists: [{ query: "x", label: "X", covers: ["basedOn"] }] })),
    ), [BEETPLAN, a, b])
    const rows = [...host.querySelectorAll('[data-meta-row="basedOn"]')]
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toContain("Beruht auf")
    expect(rows[0]!.querySelector('[data-item-ref="t-beet"]')).toBeTruthy()
    expect(rows[1]!.textContent).toContain("nicht verfügbare Aufgabe")
    expect(host.querySelector("#covered")?.innerHTML).toBe("")
  })

  it("Aussage: variantOf ist ein festes item-ref, die Liste family deckt es ab", () => {
    const st = resolveTypePresentation("statement")
    expect(st.fields?.find((f) => f.key === "variantOf")).toMatchObject({ widget: "item-ref", edit: "fixed", ref: { type: "statement" } })
    expect(st.lists).toEqual([{ query: "family", label: "Fassungen", action: { id: "create-variant", label: "+ Variante" }, covers: ["variantOf"] }])
    expect(st.reverse?.name).toBe("RegisterReverseSlot")
  })

  it("Formular einer Variante: „Variante von“ steht fest, mit Schloss, nicht bearbeitbar", async () => {
    const { ContentComposer } = await import("../src/components/composer/content-composer")
    const { pickContentTypes } = await import("../src/components/composer/content-types")
    const ORIGIN = item("s-a", "statement", { title: "Wir öffnen den Garten" })
    await render(createElement(ContentComposer, {
      contentTypes: pickContentTypes("statement"),
      initialContentType: "statement",
      initialData: { title: "Wir öffnen den Garten sonntags", variantOf: "item:s-a" },
      onSubmit: () => {},
    } as never), [ORIGIN])
    const fixed = host.querySelector("[data-fixed-ref]")
    expect(fixed?.textContent).toContain("Variante von")
    expect(fixed?.textContent).toContain("Wir öffnen den Garten")
    expect(fixed?.querySelector('[aria-label="nicht änderbar"]')).toBeTruthy()
    expect(fixed?.querySelector("input")).toBeNull()
  })

  it("ohne Wert kein festes Feld (neue Aussage)", async () => {
    const { ContentComposer } = await import("../src/components/composer/content-composer")
    const { pickContentTypes } = await import("../src/components/composer/content-types")
    await render(createElement(ContentComposer, { contentTypes: pickContentTypes("statement"), initialContentType: "statement", onSubmit: () => {} } as never), [])
    expect(host.querySelector("[data-fixed-ref]")).toBeNull()
  })

  it("Rückwärts-Liste über eine eingehende Kante (pos list): alle offenen Einträge als kompakte Zeilen, Klick öffnet", async () => {
    const { RegisterReverse } = await import("../src/components/preview/register-reverse")
    const beet = item("beet", "place", { title: "Beet 3" })
    const t1 = item("t1", "task", { title: "Umgraben", status: "open" }, [{ predicate: "partOf", target: "item:beet" }])
    const t2 = item("t2", "task", { title: "Säen", status: "done" }, [{ predicate: "partOf", target: "item:beet" }])
    const t3 = item("t3", "task", { title: "Anderswo", status: "open" }, [{ predicate: "partOf", target: "item:p1" }])
    const edges = [{ predicate: "partOf", itemRole: "to" as const, storage: "embedded" as const, widget: "item-relation" as const, pos: "list" as const, label: "Offene Aufgaben", list: { filter: "open" as const } }]
    // Die Gegenstelle aus dem Manifest: place kennt (partOf, to) nicht → jedes Item.
    await render(createElement(RegisterReverse, { item: beet, edges }), [beet, t1, t2, t3])
    const list = host.querySelector('[data-reverse-list="partOf:to"]')
    expect(list?.textContent).toContain("Offene Aufgaben")
    expect([...host.querySelectorAll("[data-list-row]")].map((r) => r.getAttribute("data-list-row"))).toEqual(["t1"])
    // Die Zeile ist die einzeilige ItemPreview (Detail-Anatomie Regel 8, S3b).
    expect(host.querySelector('[data-list-row="t1"] article')?.getAttribute("data-preview-density")).toBe("row")
    await act(async () => host.querySelector<HTMLElement>('[data-list-row="t1"] [role="button"]')!.click())
    await settle()
    expect(focused).toBe("t1")
  })
})

describe("Codex Runde 1", () => {
  it("Befund 2: ohne Space im Formular keine Suche über alle Spaces", async () => {
    const { ItemRelationWidget } = await import("../src/components/composer/widgets/item-relation-widget")
    await render(createElement(ItemRelationWidget, { label: "Ermöglicht", predicate: "blocks", targetType: "task", value: [], onChange: () => {} }))
    expect(host.querySelector("[data-needs-space]")?.textContent).toContain("Space")
    expect(host.querySelector('[data-item-relation-field="blocks"] input')).toBeNull()
  })

  it("Befund 2: ein Space-Wechsel im Formular leert die gewählten Ziele", async () => {
    const { ContentComposer } = await import("../src/components/composer/content-composer")
    const { contentTypeFromRegister } = await import("../src/components/composer/content-types")
    const config = { ...contentTypeFromRegister("task"), groupOptions: [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], defaultGroup: "g" }
    const seen: Array<Record<string, unknown>> = []
    let api: { patchData: (p: Record<string, unknown>) => void } | null = null
    const apiRef = { get current() { return api }, set current(v) { api = v } }
    await render(createElement(ContentComposer, {
      contentTypes: [config], initialContentType: "task", apiRef,
      initialData: { title: "T", group: "g", "relation:blocks": ["item:t-beet"] },
      onChange: (d: { data: Record<string, unknown> }) => seen.push(d.data), onSubmit: () => {},
    } as never))
    expect(seen.at(-1)?.["relation:blocks"]).toEqual(["item:t-beet"])
    await act(async () => api!.patchData({ group: "h" }))
    await settle()
    expect(seen.at(-1)?.["relation:blocks"]).toEqual([])
  })

  it("Befund 4: einen bearbeitbaren Item-Verweis zu entfernen macht das Formular ungespeichert", async () => {
    const { ContentComposer } = await import("../src/components/composer/content-composer")
    const config = {
      id: "note", label: "Notiz", defaultWidgets: ["title", "item-ref"],
      itemRefs: [{ key: "basedOn", label: "Beruht auf", targetType: "task", missing: "weg", fixed: false }],
      groupOptions: [{ id: "g", name: "Garten" }], defaultGroup: "g",
    }
    const dirty: boolean[] = []
    await render(createElement(ContentComposer, {
      contentTypes: [config], initialContentType: "note",
      initialData: { title: "N", group: "g", basedOn: "item:t-beet" },
      onDirtyChange: (d: boolean) => dirty.push(d), onSubmit: () => {},
    } as never))
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Beetplan für den Herbst entfernen"]')!.click())
    await settle()
    expect(dirty.at(-1)).toBe(true)
  })
})

describe("Codex Runde 2", () => {
  it("withSpaceChange: im selben Zustand, über alle Typen, space-qualifizierte Ziele bleiben", async () => {
    const { withSpaceChange } = await import("../src/components/composer/content-composer")
    const d = { group: "g", "relation:blocks": ["item:t-beet", "space:g/item:t-ernte"], "relation:partOf": ["item:p1"], basedOn: "item:t-beet", other: "item:x" }
    const next = withSpaceChange(d, { group: "h" }, ["basedOn"])
    expect(next).toEqual({ group: "h", "relation:blocks": ["space:g/item:t-ernte"], "relation:partOf": [], basedOn: "", other: "item:x" })
    // Erstes Setzen und gleicher Space: nichts
    expect(withSpaceChange({ group: "", "relation:blocks": ["item:a"] }, { group: "g" }, [])["relation:blocks"]).toEqual(["item:a"])
    expect(withSpaceChange(d, { group: "g" }, ["basedOn"])).toEqual(d)
  })

  it("liveUpdate: ein Space-Wechsel sendet keinen Zwischenstand mit alten Zielen", async () => {
    const { ContentComposer } = await import("../src/components/composer/content-composer")
    const { contentTypeFromRegister } = await import("../src/components/composer/content-types")
    const config = { ...contentTypeFromRegister("task"), groupOptions: [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], defaultGroup: "g" }
    const submitted: Array<Record<string, unknown>> = []
    let api: { patchData: (p: Record<string, unknown>) => void } | null = null
    const apiRef = { get current() { return api }, set current(v) { api = v } }
    await render(createElement(ContentComposer, {
      contentTypes: [config], initialContentType: "task", apiRef, liveUpdate: true,
      initialData: { title: "T", group: "g", "relation:blocks": ["item:t-beet"] },
      onSubmit: (d: { data: Record<string, unknown> }) => { submitted.push(d.data) },
    } as never))
    await act(async () => api!.patchData({ group: "h" }))
    await settle()
    const inH = submitted.filter((s) => s.group === "h")
    expect(inH.length).toBeGreaterThan(0)
    for (const s of inH) expect(s["relation:blocks"]).toEqual([])
  })

  it("feste Anzeige: ein Ziel aus einem anderen Space erscheint als fehlend", async () => {
    const { FixedItemRefField } = await import("../src/components/composer/widgets/item-relation-widget")
    await render(createElement(FixedItemRefField, { label: "Variante von", value: "space:other/item:t-beet", missing: "nicht verfügbar", spaceId: "g" }))
    await settle()
    expect(host.textContent).toContain("nicht verfügbar")
    expect(host.textContent).not.toContain("Beetplan")
  })
})

describe("Codex Runde 3", () => {
  it("feste Anzeige ohne Space-Capability: ein qualifiziertes Ziel gilt als fehlend", async () => {
    const { FixedItemRefField } = await import("../src/components/composer/widgets/item-relation-widget")
    const { ConnectorProvider: P } = await import("../src/hooks/connector-context")
    const plain = new MockConnector({ items: [BEETPLAN], groups: [], users: [{ id: ME, displayName: "Ich" }] } as never, { allowFixtureAuthors: true })
    await plain.init()
    const view = { init: () => plain.init(), dispose: () => plain.dispose(), getItems: (f: never) => plain.getItems(f), getItem: (id: string) => plain.getItem(id), observe: (f: never) => plain.observe(f), observeItem: (id: string) => plain.observeItem(id) }
    await act(async () => {
      root.render(createElement(P, { connector: view as never }, createElement(FixedItemRefField, { label: "V", value: "space:other/item:t-beet", missing: "fehlt" })))
    })
    await settle()
    expect(host.textContent).toContain("fehlt")
  })

  it("ein erhaltenes space-qualifiziertes Ziel erscheint nach dem Wechsel weiter als Chip", async () => {
    const { ItemRelationWidget } = await import("../src/components/composer/widgets/item-relation-widget")
    await render(createElement(ItemRelationWidget, { label: "Ermöglicht", predicate: "blocks", targetType: "task", value: ["space:g/item:t-beet"], onChange: () => {}, spaceId: "h" }))
    expect(host.querySelector('[data-relation-chip="t-beet"]')?.textContent).toContain("Beetplan")
  })
})
