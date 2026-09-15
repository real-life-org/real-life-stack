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
vi.mock("../src/hooks/use-groups", () => ({
  useMembers: () => ({ data: currentMembers, isLoading: false }),
}))

const { GroupDialog } = await import("../src/components/layout/group-dialog")

const CONTACTS = [
  { id: "did:key:zTOM", name: "Tom Richter", status: "active" as const },
  { id: "did:key:zNINA", name: "Nina Kowalski", status: "active" as const },
  { id: "did:key:zPENDING", name: "Noch Unbestaetigt", status: "pending" as const },
]

/**
 * Einladen ist ein eigener Bereich, kein Unterzustand von Mitgliedern
 * (Entwurf "Space Menu", Turn 4). Eingeladen wird nur, wen man persoenlich
 * verifiziert hat — es gibt keine Einladung per Link. Die Quelle ist darum
 * dieselbe wie zuvor: aktive Kontakte, die noch nicht Mitglied sind.
 */
describe("Bereich Einladen (Entwurf Turn 4)", () => {
  let root: Root
  const invited: string[] = []

  const renderDialog = () => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: "g1", name: "Gartenprojekt", data: {} } } as never,
          currentUserId: "did:key:zME",
          contacts: CONTACTS,
          onCreateGroup: async () => {},
          onUpdateGroup: async () => {},
          onDeleteGroup: async () => {},
          onInviteMember: async (_g: string, id: string) => { invited.push(id) },
        } as never),
      )
    })
  }

  const menuEntry = (label: string) =>
    Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.startsWith(label))

  const contactSearch = () =>
    document.querySelector<HTMLInputElement>('input[placeholder="Kontakt suchen…"]')

  const shownContacts = () =>
    Array.from(document.querySelectorAll("span"))
      .map((el) => el.textContent ?? "")
      .filter((t) => t === "Tom Richter" || t === "Nina Kowalski" || t === "Noch Unbestaetigt")

  const type = (input: HTMLInputElement, value: string) => {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value",
      )!.set!
      setter.call(input, value)
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }

  beforeEach(() => {
    document.body.innerHTML = ""
    invited.length = 0
    currentMembers = [{ id: "did:key:zME", displayName: "Ich", isAdmin: true }]
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    renderDialog()
  })

  it("erscheint als eigener Menueeintrag", () => {
    expect(menuEntry("Einladen")).toBeTruthy()
  })

  it("zeigt nur verifizierte Nicht-Mitglieder", () => {
    act(() => { menuEntry("Einladen")!.click() })
    const names = shownContacts()
    expect(names).toContain("Tom Richter")
    expect(names).toContain("Nina Kowalski")
    // `pending` ist nicht verifiziert und darf nicht einladbar sein.
    expect(names).not.toContain("Noch Unbestaetigt")
  })

  it("filtert die Kontakte ueber die Suche", () => {
    act(() => { menuEntry("Einladen")!.click() })
    type(contactSearch()!, "nina")
    expect(shownContacts()).toEqual(["Nina Kowalski"])
  })

  it("meldet, wenn die Suche nichts findet — ohne die Liste zu verlieren", () => {
    act(() => { menuEntry("Einladen")!.click() })
    type(contactSearch()!, "zzz")
    expect(shownContacts()).toEqual([])
    expect(document.body.textContent).toContain("Kein Kontakt gefunden")
    // Das Suchfeld bleibt, sonst liesse sich der Filter nicht loeschen (#377).
    expect(contactSearch()).not.toBeNull()
    type(contactSearch()!, "")
    expect(shownContacts()).toHaveLength(2)
  })

  /** "+ Einladen" in den Mitgliedern springt hierher, statt aufzuklappen. */
  it("wird vom Knopf in den Mitgliedern angesteuert", () => {
    const jump = Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent?.trim() === "Einladen" && !b.closest("nav"))
    expect(jump, "der Knopf im Mitglieder-Bereich").toBeTruthy()
    act(() => { jump!.click() })
    expect(contactSearch(), "danach steht der Einladen-Bereich offen").not.toBeNull()
  })
})
