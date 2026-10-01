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

/** Farb-Ermittlung aus dem Bild, von Hand aufgeloest. */
const extractions: { src: string; resolve: (hex: string | null) => void }[] = []
vi.mock("../src/lib/image-utils", () => ({
  dominantColor: (src: string) => new Promise<string | null>((resolve) => { extractions.push({ src, resolve }) }),
  resizeImage: async () => "data:image/png;base64,AAAA",
}))

const { GroupDialog } = await import("../src/components/layout/group-dialog")
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

  it("gibt die Zusage des Aufrufers zurueck: patchData loest erst auf, wenn onUpdateGroup gespeichert hat", async () => {
    let resolve!: () => void
    onUpdateGroup = vi.fn(() => new Promise<void>((r) => { resolve = r }))
    renderDialog({ initialSection: "traum" })
    let done = false
    act(() => { void lastCtx!.patchData({ dream: "Neu" }).then(() => { done = true }) })
    await act(async () => { await Promise.resolve() })
    expect(done).toBe(false)
    await act(async () => { resolve(); await Promise.resolve() })
    expect(done).toBe(true)
  })

  it("zeigt Group.data so, wie der Aufrufer es liefert: eine bestaetigte Aenderung erscheint ueber ihn", async () => {
    renderDialog({ initialSection: "traum" })
    await act(async () => { await lastCtx!.patchData({ dream: "Neu" }) })
    expect(document.querySelector("[data-testid='traum']")?.textContent, "kein eigener Schreibstand").toBe("Traum: Ein Garten fuer alle")
    renderDialog({ initialSection: "traum", mode: { type: "edit", group: { ...GROUP, data: { ...GROUP.data, dream: "Neu" } } } })
    expect(document.querySelector("[data-testid='traum']")?.textContent).toBe("Traum: Neu")
  })

  it("laesst bei einem gescheiterten Patch den Stand des Aufrufers stehen, meldet ihn im Abschnitt und reicht die Ablehnung weiter", async () => {
    onUpdateGroup = vi.fn(async () => { throw new Error("Relay nicht erreichbar") })
    renderDialog({ initialSection: "traum" })
    let rejected: unknown = null
    await act(async () => { await lastCtx!.patchData({ dream: "Neu" }).catch((e) => { rejected = e }) })
    expect((rejected as Error | null)?.message).toBe("Relay nicht erreichbar")
    expect(document.querySelector("[data-testid='traum']")?.textContent).toBe("Traum: Ein Garten fuer alle")
    expect(region()?.textContent, "Meldung steht im Abschnitt").toContain("Relay nicht erreichbar")
  })

  it("nimmt die Meldung weg, sobald ein spaeterer Patch dieselben Schluessel schreibt — nicht bei anderen", async () => {
    let fail = true
    onUpdateGroup = vi.fn(async () => { if (fail) throw new Error("weg") })
    renderDialog({ initialSection: "traum" })
    await act(async () => { await lastCtx!.patchData({ dream: "A" }).catch(() => {}) })
    fail = false
    await act(async () => { await lastCtx!.patchData({ horizon: "H" }) })
    expect(region()?.textContent, "anderer Schluessel: Meldung bleibt").toContain("weg")
    await act(async () => { await lastCtx!.patchData({ dream: "B" }) })
    expect(region()?.textContent).not.toContain("weg")
  })

  it("haelt Fehler je Schluessel: ein zweiter Fehler oder ein Erfolg auf einem anderen Feld loescht die erste Meldung nicht", async () => {
    const failing = new Set(["dream", "horizon"])
    onUpdateGroup = vi.fn(async (_id: string, u: { data: Record<string, unknown> }) => {
      if (Object.keys(u.data).some((k) => failing.has(k))) throw new Error(`${Object.keys(u.data)[0]} weg`)
    })
    let exportCtx: AppSpaceSectionContext | null = null
    const exportSection: AppSpaceSection = { id: "export", label: "Export", icon: Download, render: (ctx) => { exportCtx = ctx; return "Export" } }
    renderDialog({ appSections: [traum(), exportSection], initialSection: "traum" })
    await act(async () => { await lastCtx!.patchData({ dream: "A" }).catch(() => {}) })
    act(() => { menuEntry("Export")!.click() })
    await act(async () => { await exportCtx!.patchData({ horizon: "H" }).catch(() => {}) })
    failing.delete("horizon")
    await act(async () => { await exportCtx!.patchData({ horizon: "H" }) })
    expect(region()?.textContent).not.toContain("horizon weg")
    act(() => { menuEntry("Traum")!.click() })
    expect(region()?.textContent, "dream ist weiter ungespeichert").toContain("dream weg")
  })

  it("fuehrt Module aus einer neuen Group nach: eine lokale Sortierung schreibt das fremd ergaenzte Modul mit", async () => {
    renderDialog({ initialSection: "modules", mode: { type: "edit", group: { ...GROUP, data: { modules: ["feed", "map"] } } } })
    renderDialog({ initialSection: "modules", mode: { type: "edit", group: { ...GROUP, data: { modules: ["feed", "map", "kanban"] } } } })
    const runter = document.querySelector("[aria-label='Feed nach unten']") as HTMLButtonElement
    await act(async () => { runter.click(); await new Promise((r) => setTimeout(r, 0)) })
    const last = onUpdateGroup.mock.calls.at(-1) as [string, { data: { modules: string[] } }]
    expect(last[1].data.modules).toEqual(["map", "feed", "kanban"])
  })

  it("fuehrt Rundung und Farbe aus einer neuen Group nach", () => {
    renderDialog({ initialSection: "theme", mode: { type: "edit", group: { ...GROUP, data: { radius: "small", primaryColor: "#2563eb" } } } })
    renderDialog({ initialSection: "theme", mode: { type: "edit", group: { ...GROUP, data: { radius: "large", primaryColor: "#e84b1c" } } } })
    expect(document.querySelector("[aria-label='Rundung large']")?.getAttribute("aria-checked")).toBe("true")
    expect((document.querySelector("[role=dialog]") as HTMLElement).style.getPropertyValue("--primary")).toBe("#e84b1c")
  })

  it("nimmt einen gescheiterten Modul-Patch auf den inzwischen gelieferten Stand zurueck, nicht auf den eigenen aelteren", async () => {
    let fail = false
    onUpdateGroup = vi.fn(async () => { if (fail) throw new Error("weg") })
    renderDialog({ initialSection: "modules", mode: { type: "edit", group: { ...GROUP, data: { modules: ["feed", "map"] } } } })
    await act(async () => { (document.querySelector("[aria-label='Feed nach unten']") as HTMLButtonElement).click(); await new Promise((r) => setTimeout(r, 0)) })
    // Eigene Sortierung gespeichert und vom Aufrufer geliefert; danach kommt
    // ein fremder Stand an.
    renderDialog({ initialSection: "modules", mode: { type: "edit", group: { ...GROUP, data: { modules: ["map", "feed"] } } } })
    renderDialog({ initialSection: "modules", mode: { type: "edit", group: { ...GROUP, data: { modules: ["map", "feed", "kanban"] } } } })
    fail = true
    await act(async () => { (document.querySelector("[aria-label='Karte nach unten']") as HTMLButtonElement).click(); await new Promise((r) => setTimeout(r, 0)) })
    const order = [...document.querySelectorAll("[aria-label$=' nach oben']")].map((b) => b.getAttribute("aria-label")!.replace(" nach oben", ""))
    expect(order, "zurueck auf den gelieferten Stand mit Kanban").toEqual(["Karte", "Feed", "Kanban"])
  })

  it("nimmt eine gescheiterte Sortierung auf den gelieferten Stand zurueck, auch wenn der wieder dem Ausgang gleicht", async () => {
    let fail = false
    onUpdateGroup = vi.fn(async () => { if (fail) throw new Error("weg") })
    const at = (modules: string[]) => ({ initialSection: "modules", mode: { type: "edit", group: { ...GROUP, data: { modules } } } })
    renderDialog(at(["feed", "map"]))
    await act(async () => { (document.querySelector("[aria-label='Feed nach unten']") as HTMLButtonElement).click(); await new Promise((r) => setTimeout(r, 0)) })
    renderDialog(at(["map", "feed"]))
    renderDialog(at(["feed", "map"])) // ein anderes Geraet stellt zurueck
    fail = true
    await act(async () => { (document.querySelector("[aria-label='Feed nach unten']") as HTMLButtonElement).click(); await new Promise((r) => setTimeout(r, 0)) })
    const order = [...document.querySelectorAll("[aria-label$=' nach oben']")].map((b) => b.getAttribute("aria-label")!.replace(" nach oben", ""))
    expect(order).toEqual(["Feed", "Karte"])
  })

  it("faellt bei eingefrorener Group nach einem Fehler auf den gelieferten Stand zurueck, nicht auf das zuletzt Gespeicherte", async () => {
    let fail = false
    onUpdateGroup = vi.fn(async () => { if (fail) throw new Error("weg") })
    renderDialog({ initialSection: "modules", mode: { type: "edit", group: { ...GROUP, data: { modules: ["feed", "map"] } } } })
    await act(async () => { (document.querySelector("[aria-label='Feed nach unten']") as HTMLButtonElement).click(); await new Promise((r) => setTimeout(r, 0)) })
    fail = true
    await act(async () => { (document.querySelector("[aria-label='Feed nach oben']") as HTMLButtonElement).click(); await new Promise((r) => setTimeout(r, 0)) })
    const order = [...document.querySelectorAll("[aria-label$=' nach oben']")].map((b) => b.getAttribute("aria-label")!.replace(" nach oben", ""))
    expect(order, "Regel 3: der Aufrufer liefert neu, bis dahin gilt sein Stand").toEqual(["Feed", "Karte"])
  })

  it("nimmt eine gescheiterte Farbe auf den gelieferten Stand zurueck, nicht auf die zuletzt gespeicherte", async () => {
    let fail = false
    onUpdateGroup = vi.fn(async () => { if (fail) throw new Error("weg") })
    renderDialog({ initialSection: "theme", mode: { type: "edit", group: { ...GROUP, data: { primaryColor: "#2563eb" } } } })
    const swatches = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Primärfarbe #"]')]
    const [a, b] = swatches.filter((el) => el.getAttribute("aria-label") !== "Primärfarbe #2563eb")
    await act(async () => { a.click(); await new Promise((r) => setTimeout(r, 0)) })
    fail = true
    await act(async () => { b.click(); await new Promise((r) => setTimeout(r, 0)) })
    expect((document.querySelector("[role=dialog]") as HTMLElement).style.getPropertyValue("--primary")).toBe("#2563eb")
  })

  it("schreibt keine Bildfarbe mehr, wenn das Bild inzwischen von aussen geaendert wurde", async () => {
    extractions.length = 0
    const withImage = { ...GROUP, data: { image: "data:image/png;base64,ALT", primaryColor: "#111111" } }
    renderDialog({ initialSection: "theme", mode: { type: "edit", group: withImage } })
    const reset = [...document.querySelectorAll("button")].find((el) => el.textContent?.includes("Zurücksetzen")) as HTMLButtonElement
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    const before = extractions.length
    await act(async () => { reset.click(); await new Promise((r) => setTimeout(r, 20)) })
    const pending = extractions.slice(before).filter((e) => e.src.includes("ALT"))
    expect(pending.length, "Zuruecksetzen ermittelt die Farbe aus dem Bild").toBeGreaterThan(0)
    renderDialog({ initialSection: "theme", mode: { type: "edit", group: { ...GROUP, data: { image: "", primaryColor: "#222222" } } } })
    await act(async () => { for (const e of pending) e.resolve("#aaaaaa"); await new Promise((r) => setTimeout(r, 0)) })
    const colorWrites = onUpdateGroup.mock.calls.map((c) => (c[1] as { data?: Record<string, unknown> }).data?.primaryColor).filter((v) => v !== undefined)
    expect(colorWrites).not.toContain("#aaaaaa")
  })

  it("verliert bei einer neuen Objektreferenz desselben Space nichts", () => {
    function Zaehler({ ctx }: { ctx: AppSpaceSectionContext }) {
      const [n, setN] = useState(0)
      return createElement("button", { "data-testid": "z", onClick: () => setN(n + 1) }, `${n}:${String(ctx.group.data?.dream)}`)
    }
    const section = traum({ render: (ctx) => createElement(Zaehler, { ctx }) })
    renderDialog({ appSections: [section], initialSection: "traum" })
    act(() => { (document.querySelector("[data-testid='z']") as HTMLButtonElement).click() })
    renderDialog({ appSections: [section], initialSection: "traum", mode: { type: "edit", group: { ...GROUP, data: { ...GROUP.data } } } })
    expect(document.querySelector("[data-testid='z']")?.textContent).toBe("1:Ein Garten fuer alle")
    expect(region()?.getAttribute("aria-label")).toBe("Traum")
  })

  it("uebernimmt Name und Bild aus einer neuen Group des Aufrufers in den offenen Dialog", () => {
    renderDialog()
    renderDialog({ mode: { type: "edit", group: { ...GROUP, name: "Karabirrdt Nord", data: { ...GROUP.data, image: "data:image/png;base64,AAAA" } } } })
    expect((document.querySelector("[role=dialog] input:not([type=file])") as HTMLInputElement).value).toBe("Karabirrdt Nord")
    expect(document.querySelector("[role=dialog] img")?.getAttribute("src")).toBe("data:image/png;base64,AAAA")
  })

  it("Vertrag Regel 3: ein ungespeicherter Name bleibt nach einem Fehler mit Meldung stehen (kein Rueckfall)", async () => {
    onUpdateGroup = vi.fn(async (_id: string, u: { name?: string }) => { if (u.name !== undefined) throw new Error("Umbenennen ging schief") })
    renderDialog()
    const input = document.querySelector("[role=dialog] input:not([type=file])") as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    act(() => { input.focus(); setter.call(input, "Nicht gespeichert"); input.dispatchEvent(new Event("input", { bubbles: true })) })
    await act(async () => { input.blur(); await new Promise((r) => setTimeout(r, 0)) })
    expect(onUpdateGroup).toHaveBeenCalledWith("g1", { name: "Nicht gespeichert" })
    expect((document.querySelector("[role=dialog] input:not([type=file])") as HTMLInputElement).value).toBe("Nicht gespeichert")
    expect(document.body.textContent).toContain("Umbenennen ging schief")
    // ... und laesst sich erneut speichern: der naechste Blur schreibt wieder,
    // die Meldung geht.
    onUpdateGroup.mockImplementation(async () => {})
    const again = document.querySelector("[role=dialog] input:not([type=file])") as HTMLInputElement
    act(() => { again.focus() })
    await act(async () => { again.blur(); await new Promise((r) => setTimeout(r, 0)) })
    expect(onUpdateGroup).toHaveBeenLastCalledWith("g1", { name: "Nicht gespeichert" })
    expect(document.body.textContent).not.toContain("Umbenennen ging schief")
  })

  it("ueberschreibt einen Namen nicht, den man gerade tippt", () => {
    renderDialog()
    const input = document.querySelector("[role=dialog] input:not([type=file])") as HTMLInputElement
    act(() => { input.focus() })
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    act(() => { setter.call(input, "Mein Entwurf"); input.dispatchEvent(new Event("input", { bubbles: true })) })
    renderDialog({ mode: { type: "edit", group: { ...GROUP, name: "Von aussen" } } })
    expect((document.querySelector("[role=dialog] input:not([type=file])") as HTMLInputElement).value).toBe("Mein Entwurf")
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
