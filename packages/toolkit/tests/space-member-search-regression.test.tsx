// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

/** Die Mitgliederliste ist das einzige, was dieser Test steuern muss. */
let currentMembers: { id: string; displayName?: string; isAdmin?: boolean }[] = []
vi.mock("../src/hooks/use-groups", () => ({
  useMembers: () => ({ data: currentMembers, isLoading: false }),
}))

const { GroupDialog } = await import("../src/components/layout/group-dialog")

function makeMembers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `did:key:person${i}`,
    displayName: `Person${i}`,
    isAdmin: i === 0,
  }))
}

/**
 * Regression zu #377: Das Suchfeld erschien erst ab neun Mitgliedern, der
 * Filter wirkte aber unabhaengig davon. Sank die Zahl waehrend einer Suche
 * unter die Schwelle — etwa weil das gesuchte Mitglied entfernt wurde oder
 * eine Synchronisierung eintraf — verschwand das Feld, der Suchbegriff blieb
 * und verbarg die uebrigen Mitglieder. Ohne Feld liess sich der Filter nicht
 * mehr loeschen; nur Schliessen und Wiederoeffnen half.
 */
describe("Mitgliedersuche bei sinkender Mitgliederzahl (#377)", () => {
  let host: HTMLDivElement
  let root: Root

  const renderDialog = () => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: "g1", name: "Testgruppe", data: {} } } as never,
          currentUserId: "did:key:person0",
          onCreateGroup: async () => {},
          onUpdateGroup: async () => {},
          onDeleteGroup: async () => {},
        }),
      )
    })
  }

  const searchField = () =>
    document.querySelector<HTMLInputElement>('input[placeholder="Suchen…"]')

  const shownNames = () =>
    Array.from(document.querySelectorAll("span"))
      .map((el) => el.textContent ?? "")
      .filter((t) => /^Person\d+/.test(t))

  beforeEach(() => {
    document.body.innerHTML = ""
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("haelt die Liste bedienbar, wenn die Zahl waehrend der Suche faellt", () => {
    currentMembers = makeMembers(9)
    renderDialog()

    const field = searchField()
    expect(field, "ab neun Mitgliedern gibt es ein Suchfeld").not.toBeNull()

    // Nach genau einem Mitglied suchen.
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!
      setter.call(field!, "Person8")
      field!.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(shownNames().some((n) => n.startsWith("Person8"))).toBe(true)

    // Genau dieses Mitglied faellt weg — acht bleiben, die Suche laeuft noch.
    currentMembers = makeMembers(9).filter((m) => m.displayName !== "Person8")
    renderDialog()

    expect(searchField(), "das Feld darf unter dem Suchbegriff nicht verschwinden").not.toBeNull()
    expect(searchField()!.value).toBe("Person8")

    // Und die Suche laesst sich loeschen, was alle acht wieder zeigt.
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!
      setter.call(searchField()!, "")
      searchField()!.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(shownNames().length).toBe(8)
  })
})
