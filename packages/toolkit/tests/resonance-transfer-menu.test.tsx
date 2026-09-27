// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"
import { ConnectorProvider } from "../src/hooks/connector-context"
import { ResonanceTransferMenu } from "../src/components/resonance/resonance-transfer"
import { ALL_PEOPLE } from "../src/lib/resonance-sort"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// jsdom's File lacks Blob.text(), which every browser has.
if (typeof File.prototype.text !== "function") {
  File.prototype.text = function text(this: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this)
    })
  }
}

/** Import through the real menu component against the MockConnector (resonance.md → Import). */

const existing: Item = {
  id: "s-1", type: "statement", createdBy: "u1", createdAt: "2026-09-27T10:00:00.000Z",
  data: { title: "Wir treffen uns montags" },
}

let host: HTMLDivElement
let root: Root
let connector: MockConnector

beforeEach(async () => {
  connector = new MockConnector({
    items: [existing],
    groups: [{ id: "g", name: "Garten", data: {} }],
    users: [{ id: "u1", displayName: "Uli" }],
    groupMembers: { g: ["u1"] },
    groupItems: { g: ["s-1"] },
  } as never)
  await connector.init()
  connector.setCurrentGroup("g")
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never },
      createElement(ResonanceTransferMenu, {
        space: "g", userId: "u1", shownStatements: [], verifiedRecords: [],
        contentHashes: new Map(), population: ALL_PEOPLE, tags: [],
      })))
  })
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
})

async function choose(content: string, name = "aussagen.json") {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
  const file = new File([content], name, { type: "application/json" })
  Object.defineProperty(input, "files", { value: [file], configurable: true })
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })) })
  for (let round = 0; round < 3; round++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
  return document.body.textContent ?? ""
}

const button = (label: string) => [...document.body.querySelectorAll("button")].find((el) => el.textContent?.trim() === label)

describe("ResonanceTransferMenu: import", () => {
  it("shows the plan, writes the new statements and skips what the person already has", async () => {
    const text = await choose(JSON.stringify({
      format: "resonance-import/1",
      statements: [
        { title: "Wir treffen uns montags" },
        { title: "Wir kochen zusammen", tags: ["essen"] },
        { title: "Wir kochen dienstags", variantOf: "item:s-1" },
      ],
    }))
    expect(text).toContain("2 Aussagen werden angelegt, 1 übersprungen")
    await act(async () => { button("Importieren")!.click() })
    for (let round = 0; round < 3; round++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
    expect(document.body.textContent).toContain("2 Aussagen angelegt, 1 übersprungen")

    const statements = await connector.getItems({ type: "statement" })
    const titles = statements.map((item) => item.data.title).sort()
    expect(titles).toEqual(["Wir kochen dienstags", "Wir kochen zusammen", "Wir treffen uns montags"])
    const created = statements.find((item) => item.data.title === "Wir kochen zusammen")!
    expect(created.createdBy).toBe("u1")
    expect(created.tags).toEqual(["essen"])
    expect(statements.find((item) => item.data.title === "Wir kochen dienstags")!.data.variantOf).toBe("item:s-1")
  })

  it("names broken entries and writes nothing", async () => {
    const text = await choose(JSON.stringify({ format: "resonance-import/1", statements: [{ title: "ok" }, { tags: ["x"] }] }))
    expect(text).toContain("enthält Fehler. Es wird nichts importiert.")
    expect(text).toContain("Eintrag 2:")
    expect(button("Importieren")).toBeUndefined()
    expect((await connector.getItems({ type: "statement" })).length).toBe(1)
  })

  it("reports a file that is not JSON", async () => {
    expect(await choose("kein json", "kaputt.json")).toContain("„kaputt.json“ ist keine gültige JSON-Datei.")
  })
})

describe("ResonanceTransferMenu: import from the overview", () => {
  it("asks for the target space first and places the statements there", async () => {
    await act(async () => { root.unmount() })
    connector.setCurrentGroup(null as never)
    root = createRoot(host)
    await act(async () => {
      root.render(createElement(ConnectorProvider, { connector: connector as never },
        createElement(ResonanceTransferMenu, {
          space: undefined, targetSpaces: [{ id: "g", name: "Garten" }], userId: "u1", shownStatements: [], verifiedRecords: [],
          contentHashes: new Map(), population: ALL_PEOPLE, tags: [],
        })))
    })
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="Weitere Aktionen"]')!
    await act(async () => { trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })) })
    const importItem = [...document.body.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent?.includes("Aussagen importieren"))!
    await act(async () => { (importItem as HTMLElement).click() })
    expect(document.body.textContent).toContain("In welchen Space sollen die Aussagen?")
    await act(async () => { button("Garten")!.click() })

    const text = await choose(JSON.stringify({
      format: "resonance-import/1",
      statements: [{ title: "Wir treffen uns montags" }, { title: "Aus der Übersicht" }],
    }))
    // Checked against the TARGET space: „montags" already exists there.
    expect(text).toContain("1 Aussage wird angelegt, 1 übersprungen")
    await act(async () => { button("Importieren")!.click() })
    for (let round = 0; round < 3; round++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
    const created = (await connector.getItems({ type: "statement" })).find((item) => item.data.title === "Aus der Übersicht")!
    expect(connector.getItemGroupId(created.id)).toBe("g")
  })
})
