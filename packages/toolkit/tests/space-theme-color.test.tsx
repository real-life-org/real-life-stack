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

/**
 * Der Dialog ist ein FENSTER IN DEN SPACE: er traegt dessen Primaerfarbe,
 * auch wenn gerade ein anderer Space (oder die Uebersicht) aktiv ist. Sonst
 * stuenden im selben Dialog zwei Farben — das Menue in der Farbe des
 * bearbeiteten Space, der Einladen-Knopf in der der laufenden App.
 *
 * Gesetzt werden dieselben Variablen, die `use-workspace-routing` auf
 * `:root` legt, nur lokal. Damit ziehen alle Flaechen darin mit, statt dass
 * jede fuer sich eine Farbe inline bekommt.
 */
describe("Dialog traegt die Farbe des bearbeiteten Space", () => {
  let root: Root

  const renderDialog = () => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: "g1", name: "Gartenprojekt", data: {} } } as never,
          currentUserId: "did:key:zME",
          contacts: [{ id: "did:key:zTOM", name: "Tom", status: "active" as const }],
          onCreateGroup: async () => {},
          onUpdateGroup: async () => {},
          onDeleteGroup: async () => {},
          onInviteMember: async () => {},
        } as never),
      )
    })
  }

  const dialog = () => document.querySelector<HTMLElement>('[data-slot="dialog-content"]')!
  const activeEntry = () =>
    Array.from(document.querySelectorAll<HTMLButtonElement>("nav button"))
      .find((b) => b.getAttribute("aria-current") === "page")!

  beforeEach(() => {
    document.body.innerHTML = ""
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    renderDialog()
  })

  it("setzt die Primaerfarbe des Space auf dem Dialog", () => {
    expect(dialog().style.getPropertyValue("--primary")).not.toBe("")
    expect(dialog().style.getPropertyValue("--primary-foreground")).not.toBe("")
  })

  it("fuehrt sie bei einem Farbwechsel nach", async () => {
    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })

    const hex = SPACE_COLOR_SWATCHES[1]
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`button[aria-label="Primärfarbe ${hex}"]`)!.click()
    })
    expect(dialog().style.getPropertyValue("--primary")).toBe(hex)
  })

  it("laesst den aktiven Menueeintrag aus denselben Tokens schoepfen", () => {
    // Keine Inline-Farbe mehr: eine zweite Mechanik neben den Tokens waere
    // genau der Bruch, den dieser Dialog aufloest.
    expect(activeEntry().style.backgroundColor).toBe("")
    expect(activeEntry().className).toContain("bg-primary")
    expect(activeEntry().className).toContain("text-primary-foreground")
  })

  it("faerbt auch den Einladen-Knopf aus derselben Quelle", () => {
    const invite = Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent?.trim() === "Einladen" && !b.closest("nav"))
    expect(invite, "der Knopf im Mitglieder-Bereich").toBeTruthy()
    expect(invite!.style.backgroundColor).toBe("")
  })
})

/**
 * Der Saver lebt so lange wie der Dialog und liest das Ziel beim AUSFUEHREN.
 * Wird ein Speichern eingereiht, waehrend ein aelteres laeuft, und wechselt
 * der Dialog inzwischen auf einen anderen Space, schrieb der eingereihte
 * Vorgang die Farbe in den NEUEN Space — ein fremder Space bekam still die
 * Farbe, die man dem vorigen zugedacht hatte.
 *
 * Das Ziel muss darum am Wert haengen, nicht am Zeitpunkt der Ausfuehrung.
 */
describe("Farbspeichern bleibt an seinem Space", () => {
  let root: Root
  const calls: Array<{ id: string; color: unknown }> = []
  let release: (() => void) | undefined

  const renderFor = (groupId: string) => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: groupId, name: groupId, data: {} } } as never,
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          onUpdateGroup: (id: string, updates: { data?: { primaryColor?: unknown } }) => {
            calls.push({ id, color: updates.data?.primaryColor })
            // Der erste Aufruf haengt, bis der Test ihn loslaesst.
            return calls.length === 1
              ? new Promise<void>((resolve) => { release = resolve })
              : Promise.resolve()
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

  const pick = (hex: string) => {
    act(() => {
      document.querySelector<HTMLButtonElement>(`button[aria-label="Primärfarbe ${hex}"]`)!.click()
    })
  }

  beforeEach(() => {
    document.body.innerHTML = ""
    calls.length = 0
    release = undefined
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("schreibt einen eingereihten Vorgang nicht in den inzwischen geoeffneten Space", async () => {
    renderFor("space-a")
    openAppearance()

    pick(SPACE_COLOR_SWATCHES[1]) // laeuft, haengt
    pick(SPACE_COLOR_SWATCHES[2]) // wird eingereiht

    // Der Dialog zeigt jetzt einen ANDEREN Space.
    renderFor("space-b")

    await act(async () => {
      release?.()
      await Promise.resolve()
    })

    expect(calls).toHaveLength(2)
    expect(calls.map((c) => c.id), "beide Vorgaenge gehoeren space-a").toEqual(["space-a", "space-a"])
    expect(calls[1].color).toBe(SPACE_COLOR_SWATCHES[2])
  })
})

/**
 * Zeichen auf der Akzentflaeche muessen lesbar bleiben (Spec 04,
 * "Verwendung der Primaerfarbe", Regel 5). Der Haken war fest weiss — auf
 * einer hellen eigenen Farbe verschwand er im eigenen Untergrund.
 */
describe("Lesbarkeit und Benennung der Farbwahl", () => {
  let root: Root

  const renderWith = (primaryColor?: string) => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: {
            type: "edit",
            group: { id: "g1", name: "G", data: primaryColor ? { primaryColor } : {} },
          } as never,
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          onUpdateGroup: async () => {},
          onDeleteGroup: async () => {},
        } as never),
      )
    })
    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })
  }

  beforeEach(() => {
    document.body.innerHTML = ""
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("setzt den Haken auf einer hellen eigenen Farbe dunkel", () => {
    renderWith("#ffffff")
    const label = document.querySelector<HTMLElement>('input[type="color"]')!.closest("label")!
    const check = label.querySelector("svg")!
    expect(check.style.color).toBe("rgb(0, 0, 0)")
  })

  it("setzt ihn auf einer dunklen eigenen Farbe hell", () => {
    renderWith("#101010")
    const label = document.querySelector<HTMLElement>('input[type="color"]')!.closest("label")!
    expect(label.querySelector("svg")!.style.color).toBe("rgb(255, 255, 255)")
  })

  it("benennt den Farbwaehler fuer Vorlesehilfen", () => {
    renderWith()
    // `title` am umgebenden Label benennt das Bedienelement nicht.
    expect(document.querySelector('input[type="color"]')!.getAttribute("aria-label"))
      .toBe("Eigene Farbe")
  })
})
