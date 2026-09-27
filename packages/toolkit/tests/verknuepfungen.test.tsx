// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

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
    expect(edgeTargets(selbst, blocksFrom, [selbst, BEETPLAN], "task").map((t) => t.item.id)).toEqual(["t-beet"])
  })
})

describe("C3 schreiben: Formular der Aufgabe", () => {
  it("Register → Formular: Ermöglicht und Teil von als Felder, Braucht nicht (liegt am anderen Item)", async () => {
    const { contentTypeFromRegister } = await import("../src/components/composer/content-types")
    const config = contentTypeFromRegister("task")
    expect(config.itemRelations).toEqual([
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
