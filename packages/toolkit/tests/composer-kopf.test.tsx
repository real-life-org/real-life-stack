// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { composeTypeManifest, TOOLKIT_TYPE_LAYER } from "@real-life-stack/data-interface"

import { ContentComposer, type ContentComposerProps, type ContentTypeConfig } from "../src/components/composer/content-composer"
import { pickContentTypes } from "../src/components/composer/content-types"
import { setTypeManifest } from "../src/components/preview/type-presentation"

/**
 * Antons Entscheidung vom 27.09.2026 (shared-components, Edit-Regeln):
 * Formular = Kopf (Typ, Space) → Titel → Beschreibung (eingeklappt, wenn
 * leer) → Felder in der Reihenfolge der Meta-Zeilen → Tags. Typ und Space
 * sind kompakte Auswahlfelder im Kopf, keine Pillen.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER]))

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

async function render(props: Partial<ContentComposerProps> & { contentTypes: ContentTypeConfig[] }) {
  await act(async () => {
    root.render(createElement(ContentComposer, { onSubmit: () => {}, ...props }))
  })
}

const GROUPS = [
  { id: "a", name: "Garten" },
  { id: "b", name: "Hof" },
]
const withGroups = (types: ContentTypeConfig[], defaultGroup?: string): ContentTypeConfig[] =>
  types.map((t) => ({
    ...t,
    groupOptions: GROUPS,
    ...(defaultGroup ? { defaultGroup } : {}),
    defaultWidgets: [...t.defaultWidgets, "group"],
  }))

const typeSelect = () => host.querySelector<HTMLSelectElement>('select[aria-label="Typ"]')
const spaceSelect = () => host.querySelector<HTMLSelectElement>('select[aria-label="Space"]')
const pos = (el: Element | null) => {
  expect(el).not.toBeNull()
  return [...host.querySelectorAll("*")].indexOf(el!)
}
const byText = (text: string) => [...host.querySelectorAll("span, label, button")].find((el) => el.textContent?.trim() === text) ?? null

describe("Kopf des Formulars: Typ und Space", () => {
  it("Erstellen: Typ als Auswahlfeld statt Pillen, Wechsel über das Feld", async () => {
    await render({ contentTypes: pickContentTypes("post", "event", "task") })
    const select = typeSelect()!
    expect([...select.options].map((o) => o.value)).toEqual(["post", "event", "task"])
    expect(byText("Event")).toBeNull() // keine Pille mehr
    await act(async () => {
      select.value = "task"
      select.dispatchEvent(new Event("change", { bubbles: true }))
    })
    expect(typeSelect()!.value).toBe("task")
    expect(host.textContent).toContain("Zugewiesen")
  })

  it("ein einziger Typ steht fest im Kopf", async () => {
    await render({ contentTypes: pickContentTypes("task"), mode: "task" })
    expect(typeSelect()).toBeNull()
    expect(host.querySelector('[data-slot="composer-type"]')?.textContent).toContain("Task")
  })

  it("Space als Auswahlfeld im Kopf, vor dem Titel; Pflichtmarkierung ohne Space", async () => {
    await render({ contentTypes: withGroups(pickContentTypes("task")), mode: "task" })
    const select = spaceSelect()!
    expect([...select.options].filter((o) => o.value).map((o) => o.textContent)).toEqual(["Garten", "Hof"])
    expect(select.getAttribute("aria-invalid")).toBe("true")
    expect(pos(select)).toBeLessThan(pos(host.querySelector('input[placeholder="Titel"], input')))
  })

  it("mit gesetztem Space keine Pflichtmarkierung", async () => {
    await render({ contentTypes: withGroups(pickContentTypes("task"), "a"), mode: "task" })
    expect(spaceSelect()!.value).toBe("a")
    expect(spaceSelect()!.getAttribute("aria-invalid")).not.toBe("true")
  })

  it("nur ein möglicher Space: feste Anzeige statt Auswahl", async () => {
    const [task] = pickContentTypes("task")
    await render({
      contentTypes: [{ ...task!, groupOptions: [GROUPS[0]!], defaultGroup: "a", defaultWidgets: [...task!.defaultWidgets, "group"] }],
      mode: "task",
    })
    expect(spaceSelect()).toBeNull()
    expect(host.querySelector('[data-slot="composer-space"]')?.textContent).toContain("Garten")
  })
})

describe("Reihenfolge: Titel → Beschreibung → Meta-Felder → Tags", () => {
  it("task: Titel, eingeklappte Beschreibung, Zugewiesen, Fällig, Status, Tags", async () => {
    await render({ contentTypes: pickContentTypes("task"), mode: "task" })
    const reihe = [
      host.querySelector("input"),
      byText("+ Beschreibung"),
      byText("Zugewiesen"),
      byText("Fällig"),
      byText("Status"),
      byText("Tags"),
    ]
    for (let i = 1; i < reihe.length; i++) expect(pos(reihe[i - 1]!)).toBeLessThan(pos(reihe[i]!))
  })

  it("die eingeklappte Beschreibung klappt auf", async () => {
    await render({ contentTypes: pickContentTypes("task"), mode: "task" })
    await act(async () => (byText("+ Beschreibung") as HTMLButtonElement).click())
    expect(byText("+ Beschreibung")).toBeNull()
    expect(host.querySelector('[contenteditable="true"], textarea')).not.toBeNull()
  })

  it("mit Text bleibt die Beschreibung offen; ein Beitrag ohne Titel klappt nie ein", async () => {
    await render({ contentTypes: pickContentTypes("task"), mode: "task", initialData: { title: "T", text: "Da steht was" } })
    expect(byText("+ Beschreibung")).toBeNull()
    await render({ contentTypes: pickContentTypes("post"), mode: "post" })
    expect(byText("+ Text")).toBeNull()
    expect(host.textContent).not.toContain("+ Beschreibung")
  })
})

describe("Codex Runde 4: der Space im Kopf", () => {
  it("genau ein möglicher Space ohne Vorgabe wird gesetzt und gespeichert", async () => {
    const [task] = pickContentTypes("task")
    let submitted: Record<string, unknown> | undefined
    await render({
      contentTypes: [{ ...task!, groupOptions: [GROUPS[0]!], defaultWidgets: [...task!.defaultWidgets, "group"] }],
      mode: "task",
      initialData: { title: "T" },
      onSubmit: ({ data }) => { submitted = data },
    })
    expect(host.querySelector('[data-slot="composer-space"]')?.textContent).toContain("Garten")
    const speichern = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Erstellen"))!
    await act(async () => speichern.click())
    expect(submitted?.group).toBe("a")
  })

  it("Gruppenoptionen ohne group in defaultWidgets: der Space steht trotzdem im Kopf", async () => {
    const [task] = pickContentTypes("task")
    await render({ contentTypes: [{ ...task!, groupOptions: GROUPS }], mode: "task" })
    expect(spaceSelect()).not.toBeNull()
  })
})
