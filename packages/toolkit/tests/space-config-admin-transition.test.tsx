// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

let currentMembers: { id: string; displayName?: string; isAdmin?: boolean }[] = []
let loading = false
vi.mock("../src/hooks/use-groups", () => ({
  useMembers: () => ({ data: currentMembers, isLoading: loading }),
}))

const { GroupDialog } = await import("../src/components/layout/group-dialog")

const ME = "did:key:zME"

/**
 * `isAdmin` wird aus den Mitgliedern abgeleitet und steht beim Oeffnen noch
 * nicht fest — `useMembers` laedt. Der Modul-Bereich erscheint also NACH dem
 * ersten Rendern und kann ebenso wieder verschwinden, wenn das Adminrecht
 * entzogen wird oder eine Synchronisierung eine andere Wahrheit bringt.
 *
 * Die reinen Funktionen decken das ab, die Verdrahtung aber nicht: hier wird
 * der Uebergang an der echten Komponente gefahren, damit ein Umbau der
 * Flaeche nicht unbemerkt an den Hilfsfunktionen vorbei regressiert.
 */
describe("Bereichswechsel beim asynchronen Adminrecht", () => {
  let root: Root

  const renderDialog = () => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: "g1", name: "Gartenprojekt", data: {} } } as never,
          currentUserId: ME,
          onCreateGroup: async () => {},
          onUpdateGroup: async () => {},
          onDeleteGroup: async () => {},
        }),
      )
    })
  }

  const menuEntry = (label: string) =>
    Array.from(document.querySelectorAll("nav button")).find((b) =>
      b.textContent?.startsWith(label),
    ) as HTMLButtonElement | undefined

  // Der Bereich nennt sich fuer Screenreader ueber die Flaeche selbst; eine
  // sichtbare Ueberschrift waere die Wiederholung des Menueeintrags daneben.
  const heading = () =>
    document.querySelector('[role="region"]')?.getAttribute("aria-label") ?? ""

  beforeEach(() => {
    document.body.innerHTML = ""
    loading = false
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("blendet Module erst ein, wenn das Adminrecht eintrifft", () => {
    // Erster Lauf: die Mitglieder sind noch nicht da.
    loading = true
    currentMembers = []
    renderDialog()
    expect(menuEntry("Module"), "ohne Mitglieder kein Modul-Bereich").toBeUndefined()

    // Die Mitglieder treffen ein und weisen den eigenen Nutzer als Admin aus.
    loading = false
    currentMembers = [
      { id: ME, displayName: "Ich", isAdmin: true },
      { id: "did:key:zB", displayName: "Berta", isAdmin: false },
    ]
    renderDialog()
    expect(menuEntry("Module"), "jetzt gibt es den Modul-Bereich").toBeTruthy()
  })

  it("faellt aus Modulen zurueck, wenn das Adminrecht wegfaellt", () => {
    currentMembers = [{ id: ME, displayName: "Ich", isAdmin: true }]
    renderDialog()

    act(() => { menuEntry("Module")!.click() })
    expect(heading()).toBe("Module")

    // Adminrecht entzogen — der Bereich verschwindet unter der Auswahl.
    currentMembers = [{ id: ME, displayName: "Ich", isAdmin: false }]
    renderDialog()

    expect(menuEntry("Module")).toBeUndefined()
    // Entscheidend: KEINE leere Flaeche, sondern der erste Bereich.
    expect(heading()).toBe("Mitglieder")
    expect(document.body.textContent).toContain("Ich")
  })

  it("zeigt ohne Modulrecht und ohne Einladen gar kein Menue", () => {
    currentMembers = [{ id: ME, displayName: "Ich", isAdmin: false }]
    renderDialog()
    expect(document.querySelector("nav"), "ein einzelner Eintrag waere keine Wahl").toBeNull()
    expect(heading()).toBe("Mitglieder")
  })
})
