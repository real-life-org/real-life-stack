// @vitest-environment jsdom
import { act, createElement, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Sparkles, Download } from "lucide-react"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

let currentMembers: { id: string; displayName?: string; isAdmin?: boolean }[] = []
vi.mock("../src/hooks/use-groups", () => ({
  useMembers: () => ({ data: currentMembers, isLoading: false }),
}))

const {
  GroupDialog,
  viewGroupData,
} = await import("../src/components/layout/group-dialog")
import type { AppSpaceSection, AppSpaceSectionContext } from "../src/components/layout/group-dialog"

const ME = "did:key:zME"
const GROUP = { id: "g1", name: "Karabirrdt", data: { dream: "Ein Garten fuer alle", modules: ["feed"] } }

/**
 * rls#551: Eine App traegt eigene Abschnitte in den Space-Dialog ein, statt
 * einen zweiten Dialog neben dem Switcher zu bauen (Spec 01, Overlay-Regel 5).
 * Geschrieben wird nur `Group.data`, flach als Merge-Patch (Spec 04,
 * Space-Metadaten, Regeln 2 und 3).
 */
describe("GroupDialog: App-Abschnitte", () => {
  let root: Root
  let onUpdateGroup: ReturnType<typeof vi.fn>

  const traum = (extra: Partial<AppSpaceSection> = {}): AppSpaceSection => ({
    id: "traum",
    label: "Traum",
    icon: Sparkles,
    render: (ctx) => createElement(TraumProbe, { ctx }),
    ...extra,
  })

  let lastCtx: AppSpaceSectionContext | null = null
  function TraumProbe({ ctx }: { ctx: AppSpaceSectionContext }) {
    lastCtx = ctx
    return createElement("div", { "data-testid": "traum" }, `Traum: ${String(ctx.group.data?.dream ?? "—")}`)
  }

  const renderDialog = (props: Record<string, unknown> = {}) => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: GROUP } as never,
          currentUserId: ME,
          onCreateGroup: async () => {},
          onUpdateGroup,
          onDeleteGroup: async () => {},
          appSections: [traum()],
          ...props,
        }),
      )
    })
  }

  const menuEntry = (label: string) =>
    Array.from(document.querySelectorAll("nav button")).find((b) =>
      b.textContent?.startsWith(label),
    ) as HTMLButtonElement | undefined
  const menuLabels = () => Array.from(document.querySelectorAll("nav button")).map((b) => b.textContent ?? "")
  const region = () => document.querySelector('[role="region"]')

  beforeEach(() => {
    document.body.innerHTML = ""
    lastCtx = null
    onUpdateGroup = vi.fn(async () => {})
    currentMembers = [{ id: ME, displayName: "Ich", isAdmin: true }]
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(() => { act(() => root.unmount()) })

  it("fuehrt App-Abschnitte nach den eigenen Bereichen im Menue", () => {
    renderDialog()
    const labels = menuLabels()
    expect(labels.at(-1)).toMatch(/^Traum/)
    expect(labels.findIndex((l) => l.startsWith("Module"))).toBeLessThan(labels.length - 1)
  })

  it("zeigt den Abschnitt der App als Flaeche mit ihrem Namen", () => {
    renderDialog()
    act(() => { menuEntry("Traum")!.click() })
    expect(region()?.getAttribute("aria-label")).toBe("Traum")
    expect(document.querySelector("[data-testid='traum']")?.textContent).toBe("Traum: Ein Garten fuer alle")
    expect(lastCtx?.canEdit).toBe(true)
  })

  it("setzt die Ueberschrift der App-Abschnitte, wenn eine genannt ist", () => {
    renderDialog({ appSectionsTitle: "Karabirrdt" })
    expect(document.querySelector("nav")?.textContent).toContain("Karabirrdt")
  })

  it("reicht patchData flach als Group.data-Patch an onUpdateGroup durch (null loescht)", async () => {
    renderDialog({ initialSection: "traum" })
    await act(async () => { await lastCtx!.patchData({ dream: "Neu", horizon: null }) })
    expect(onUpdateGroup).toHaveBeenCalledTimes(1)
    expect(onUpdateGroup).toHaveBeenCalledWith("g1", { data: { dream: "Neu", horizon: null } })
  })

  it("zeigt den eigenen Schreibstand auch nach einem Bereichswechsel", async () => {
    renderDialog({ initialSection: "traum" })
    await act(async () => { await lastCtx!.patchData({ dream: "Neu" }) })
    act(() => { menuEntry("Mitglieder")!.click() })
    act(() => { menuEntry("Traum")!.click() })
    // `mode.group` ist der Stand vom Oeffnen; ohne Ueberlagerung kaeme hier
    // wieder der alte Traum zurueck.
    expect(document.querySelector("[data-testid='traum']")?.textContent).toBe("Traum: Neu")
  })

  it("nimmt einen fehlgeschlagenen Patch zurueck, meldet ihn und reicht die Ablehnung weiter", async () => {
    onUpdateGroup = vi.fn(async () => { throw new Error("Relay nicht erreichbar") })
    renderDialog({ initialSection: "traum" })
    let rejected: unknown = null
    await act(async () => { await lastCtx!.patchData({ dream: "Neu" }).catch((e) => { rejected = e }) })
    expect((rejected as Error | null)?.message).toBe("Relay nicht erreichbar")
    expect(document.querySelector("[data-testid='traum']")?.textContent).toBe("Traum: Ein Garten fuer alle")
    expect(document.body.textContent).toContain("Relay nicht erreichbar")
  })

  it("behaelt nach einem gescheiterten Folge-Patch den zuvor gespeicherten Stand", async () => {
    let fail = false
    onUpdateGroup = vi.fn(async () => { if (fail) throw new Error("weg") })
    renderDialog({ initialSection: "traum" })
    await act(async () => { await lastCtx!.patchData({ dream: "A" }) })
    fail = true
    await act(async () => { await lastCtx!.patchData({ dream: "B" }).catch(() => {}) })
    expect(document.querySelector("[data-testid='traum']")?.textContent).toBe("Traum: A")
    fail = false
    await act(async () => { await lastCtx!.patchData({ dream: null }) })
    fail = true
    await act(async () => { await lastCtx!.patchData({ dream: "C" }).catch(() => {}) })
    expect(document.querySelector("[data-testid='traum']")?.textContent, "gespeicherte Loeschung bleibt").toBe("Traum: —")
  })

  it("schreibt Patches nacheinander in Aufrufreihenfolge, nie parallel", async () => {
    const pending: { patch: unknown; resolve: () => void }[] = []
    onUpdateGroup = vi.fn((_id: string, updates: { data: unknown }) => new Promise<void>((resolve) => { pending.push({ patch: updates.data, resolve }) }))
    renderDialog({ initialSection: "traum" })
    let a!: Promise<void>, b!: Promise<void>
    act(() => { a = lastCtx!.patchData({ dream: "A" }); b = lastCtx!.patchData({ dream: "B", horizon: "H" }) })
    await act(async () => { await Promise.resolve() })
    expect(pending.map((p) => p.patch), "B wartet, bis A gespeichert ist").toEqual([{ dream: "A" }])
    expect(document.querySelector("[data-testid='traum']")?.textContent, "Anzeige zeigt die letzte Eingabe").toBe("Traum: B")
    await act(async () => { pending[0].resolve(); await a })
    await act(async () => { await Promise.resolve() })
    expect(pending.map((p) => p.patch)).toEqual([{ dream: "A" }, { dream: "B", horizon: "H" }])
    await act(async () => { pending[1].resolve(); await b })
    expect(document.querySelector("[data-testid='traum']")?.textContent).toBe("Traum: B")
  })

  it("blendet einen Abschnitt aus, dessen visible wirft, der Dialog bleibt stehen", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    renderDialog({ appSections: [traum(), { id: "kaputt", label: "Kaputt", icon: Download, visible: () => { throw new Error("visible kaputt") }, render: () => "x" }] })
    expect(menuEntry("Traum")).toBeTruthy()
    expect(menuEntry("Kaputt")).toBeUndefined()
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it("oeffnet mit initialSection direkt im App-Abschnitt, auch beim naechsten Oeffnen", () => {
    renderDialog({ initialSection: "traum" })
    expect(region()?.getAttribute("aria-label")).toBe("Traum")
    act(() => { menuEntry("Mitglieder")!.click() })
    renderDialog({ initialSection: "traum", open: false })
    renderDialog({ initialSection: "traum", open: true })
    expect(region()?.getAttribute("aria-label")).toBe("Traum")
  })

  it("oeffnet mit initialSection auch einen eigenen Bereich", () => {
    renderDialog({ initialSection: "invite", onInviteMember: async () => {} })
    expect(region()?.getAttribute("aria-label")).toBe("Einladen")
  })

  it("fragt visible nach dem Adminrecht und reicht canEdit weiter", () => {
    currentMembers = [{ id: ME, displayName: "Ich", isAdmin: false }]
    renderDialog({
      appSections: [traum(), { id: "export", label: "Export", icon: Download, visible: ({ isAdmin }: { isAdmin: boolean }) => isAdmin, render: () => "x" }],
      initialSection: "traum",
    })
    expect(menuEntry("Export")).toBeUndefined()
    expect(lastCtx?.canEdit).toBe(false)
  })

  it("springt in einen Admin-Abschnitt, sobald das Adminrecht eintrifft", () => {
    currentMembers = []
    const exportSection: AppSpaceSection = { id: "export", label: "Export", icon: Download, visible: ({ isAdmin }) => isAdmin, render: () => createElement("p", null, "Export-Flaeche") }
    renderDialog({ appSections: [exportSection], initialSection: "export" })
    expect(region()?.getAttribute("aria-label")).toBe("Mitglieder")
    currentMembers = [{ id: ME, displayName: "Ich", isAdmin: true }]
    renderDialog({ appSections: [exportSection], initialSection: "export" })
    expect(region()?.getAttribute("aria-label")).toBe("Export")
  })

  it("verwirft App-Abschnitte, deren Id einen eigenen Bereich oder einen anderen Abschnitt verdeckt", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    renderDialog({
      appSections: [traum(), traum({ label: "Traum 2" }), { id: "members", label: "Leute", icon: Sparkles, render: () => "x" }],
    })
    expect(menuEntry("Traum 2")).toBeUndefined()
    expect(menuEntry("Leute")).toBeUndefined()
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it("faengt einen Fehler im App-Abschnitt ein, der Dialog bleibt bedienbar", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    function Kaputt(): never { throw new Error("kaputt") }
    renderDialog({ appSections: [traum({ render: () => createElement(Kaputt) })], initialSection: "traum" })
    expect(region()?.textContent).toMatch(/Traum/)
    act(() => { menuEntry("Mitglieder")!.click() })
    expect(region()?.getAttribute("aria-label")).toBe("Mitglieder")
    err.mockRestore()
  })

  it("faengt auch eine render-Funktion ein, die selbst wirft", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    renderDialog({ appSections: [traum({ render: () => { throw new Error("render kaputt") } })], initialSection: "traum" })
    expect(document.querySelector("nav")).toBeTruthy()
    act(() => { menuEntry("Mitglieder")!.click() })
    expect(region()?.getAttribute("aria-label")).toBe("Mitglieder")
    err.mockRestore()
  })

  it("schneidet auf schmalen Schirmen keinen Eintrag ab: die Leiste bricht um statt zu scrollen", () => {
    renderDialog({ onInviteMember: async () => {}, appSections: [traum(), { id: "export", label: "Export", icon: Download, render: () => "x" }] })
    const row = document.querySelector("nav > div, nav [data-section-list]") as HTMLElement
    expect(row.className).toContain("flex-wrap")
    expect(row.className).not.toMatch(/(^|\s)overflow-x-auto/)
  })

  it("haelt Hooks zweier render-Funktionen auseinander (Wechsel zwischen App-Abschnitten)", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    const a: AppSpaceSection = { id: "a", label: "Alpha", icon: Sparkles, render: function A() { const [x] = useState("alpha"); return createElement("p", { "data-testid": "inhalt" }, x) } }
    const b: AppSpaceSection = { id: "b", label: "Beta", icon: Download, render: function B() { const [x] = useState("beta"); return createElement("p", { "data-testid": "inhalt" }, x) } }
    renderDialog({ appSections: [a, b], initialSection: "a" })
    expect(document.querySelector("[data-testid='inhalt']")?.textContent).toBe("alpha")
    act(() => { menuEntry("Beta")!.click() })
    expect(document.querySelector("[data-testid='inhalt']")?.textContent).toBe("beta")
    err.mockRestore()
  })

  it("laesst eine App-Abschnitts-Komponente eigenen Zustand halten", () => {
    function Zaehler() {
      const [n, setN] = useState(0)
      return createElement("button", { "data-testid": "z", onClick: () => setN(n + 1) }, String(n))
    }
    renderDialog({ appSections: [traum({ render: () => createElement(Zaehler) })], initialSection: "traum" })
    act(() => { (document.querySelector("[data-testid='z']") as HTMLButtonElement).click() })
    expect(document.querySelector("[data-testid='z']")?.textContent).toBe("1")
  })
})

/** Der Schreibstand: Stand vom Oeffnen, darueber Patches der Reihe nach (Merge-Patch, `null` loescht). */
describe("Ansicht des Schreibstands", () => {
  it("legt Patches der Reihe nach ueber den Stand vom Oeffnen", () => {
    expect(viewGroupData({ dream: "alt", modules: ["feed"] }, [{ dream: "A" }, { dream: "B", horizon: "H" }]))
      .toEqual({ dream: "B", horizon: "H", modules: ["feed"] })
  })

  it("null loescht den Schluessel in der Ansicht, ein spaeterer Wert setzt ihn wieder", () => {
    expect(viewGroupData({ dream: "alt", x: 1 }, [{ dream: null }])).toEqual({ x: 1 })
    expect(viewGroupData({ dream: "alt" }, [{ dream: null }, { dream: "neu" }])).toEqual({ dream: "neu" })
  })
})
