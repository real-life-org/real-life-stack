// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

vi.mock("../src/hooks/use-groups", () => ({
  useMembers: () => ({ data: [{ id: "did:key:zME", displayName: "Ich", isAdmin: true }], isLoading: false }),
}))

const { GroupDialog } = await import("../src/components/layout/group-dialog")
const { SPACE_COLOR_SWATCHES } = await import("../src/lib/utils")

/**
 * Der Dialog bekommt die Gruppe als SNAPSHOT (`mode.group`) und behaelt ihn,
 * solange er offen ist — die Reference-App setzt ihn beim Oeffnen einmal.
 * Eine Anzeige, die direkt aus diesem Snapshot liest, bewegt sich nach einem
 * Klick also nicht: gespeichert wird, aber der Haken bleibt stehen und es
 * sieht aus, als sei nichts passiert. Name, Bild und Modulliste halten aus
 * genau diesem Grund lokalen Zustand; die Farbe muss es ebenso.
 */
describe("Primärfarbe im Bereich Aussehen", () => {
  let root: Root
  const saved: unknown[] = []
  let rejectSave = false

  const renderDialog = () => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          // Der Snapshot bleibt absichtlich unveraendert — wie in der App.
          mode: { type: "edit", group: { id: "g1", name: "Gartenprojekt", data: {} } } as never,
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          onUpdateGroup: async (_id: string, updates: unknown) => {
            saved.push(updates)
            if (rejectSave) throw new Error("Netzwerk weg")
          },
          onDeleteGroup: async () => {},
        } as never),
      )
    })
  }

  const openAppearance = () => {
    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })
  }

  const swatch = (hex: string) =>
    document.querySelector<HTMLButtonElement>(`button[aria-label="Primärfarbe ${hex}"]`)!

  const pressed = () =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Primärfarbe"]'))
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.getAttribute("aria-label"))

  beforeEach(() => {
    document.body.innerHTML = ""
    saved.length = 0
    rejectSave = false
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    renderDialog()
    openAppearance()
  })

  it("setzt den Haken sofort auf die angeklickte Farbe", async () => {
    const hex = SPACE_COLOR_SWATCHES[1]
    await act(async () => { swatch(hex).click() })
    expect(pressed()).toEqual([`Primärfarbe ${hex}`])
  })

  it("speichert die Farbe als Merge-Patch", async () => {
    const hex = SPACE_COLOR_SWATCHES[2]
    await act(async () => { swatch(hex).click() })
    expect(saved).toEqual([{ data: { primaryColor: hex } }])
  })

  it("folgt auch einem zweiten Klick auf eine andere Farbe", async () => {
    await act(async () => { swatch(SPACE_COLOR_SWATCHES[1]).click() })
    await act(async () => { swatch(SPACE_COLOR_SWATCHES[3]).click() })
    expect(pressed()).toEqual([`Primärfarbe ${SPACE_COLOR_SWATCHES[3]}`])
  })

  it("nimmt die Anzeige zurueck, wenn das Speichern scheitert", async () => {
    rejectSave = true
    const hex = SPACE_COLOR_SWATCHES[1]
    await act(async () => { swatch(hex).click() })
    // Kein Haken auf einer Farbe, die nicht gespeichert wurde.
    expect(pressed()).not.toEqual([`Primärfarbe ${hex}`])
    expect(document.body.textContent).toContain("Netzwerk weg")
  })
})
