// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PeopleWidget } from "../src/components/composer/widgets/people-widget"
import { useItemComposerProps } from "../src/hooks/use-item-composer-props"

vi.mock("../src/components/map/location-pick", () => ({ useLocationPick: () => ({ startPick: () => {}, canPick: false }) }))

/**
 * Das Personen-Feld (C1, Schreibform) zeigt Menschen wie die Menschen-Zeile
 * und der Space-Select: mit Avatar, ohne Bild mit Initialen. Der Avatar kommt
 * aus `User.avatarUrl` (Data Interface) über `useItemComposerProps`.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const OPTIONS = [
  { id: "anton", name: "Anton Tranelis", avatarUrl: "https://example.org/anton.png" },
  { id: "timo", name: "Timo" },
]

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
})

async function render(value: string[]) {
  await act(async () => {
    root.render(createElement(PeopleWidget, {
      value, onChange: () => {}, label: "Zugewiesen", options: OPTIONS, quickSuggestions: OPTIONS,
    }))
  })
}

describe("Personen-Feld mit Avataren", () => {
  it("der Chip einer ausgewählten Person trägt ihren Avatar, ohne Bild die Initialen", async () => {
    await render(["anton", "timo"])
    expect(host.querySelector('[data-person-chip="anton"] [data-avatar]')).not.toBeNull()
    const timo = host.querySelector('[data-person-chip="timo"] [data-avatar]')
    expect(timo?.textContent).toBe("T")
  })

  it("die Vorschlags-Chips und die Auswahlliste tragen Avatare", async () => {
    await render([])
    expect(host.querySelectorAll("[data-person-suggestion] [data-avatar]")).toHaveLength(2)
    const input = host.querySelector("input")!
    await act(async () => { input.dispatchEvent(new FocusEvent("focus", { bubbles: true })); input.focus() })
    const option = host.querySelector('[data-person-option="anton"] [data-avatar]')
    expect(option).not.toBeNull()
    expect(host.querySelector('[data-person-option="anton"]')?.textContent).toContain("AT")
  })
})

describe("useItemComposerProps", () => {
  it("reicht avatarUrl der Mitglieder an das Feld weiter", async () => {
    const members = [{ id: "anton", displayName: "Anton", avatarUrl: "https://example.org/anton.png" }, { id: "timo" }]
    let props: ReturnType<typeof useItemComposerProps> | undefined
    function Probe() {
      props = useItemComposerProps(members)
      return null
    }
    await act(async () => { root.render(createElement(Probe)) })
    expect(props?.peopleOptions).toEqual([
      { id: "anton", name: "Anton", avatarUrl: "https://example.org/anton.png" },
      { id: "timo", name: "timo" },
    ])
  })
})
