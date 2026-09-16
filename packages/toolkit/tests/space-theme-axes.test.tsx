// @vitest-environment jsdom
/**
 * Die Feineinstellung des Aussehens: drei Regler auf der Farbe, einer fuer
 * die Toenung, Kontrastzeilen, ein Reset — im Panel, nicht im Dialog.
 *
 * Die Regler haben keinen eigenen Zustand ueber den Wert hinaus: sie zeigen
 * die geltende Farbe und schreiben sie zurueck. Geprueft wird darum vor
 * allem: bewegt sich `primaryColor`, bewegt sich `tint`, nimmt EIN Knopf
 * beides zurueck, und zieht die lebende Gruppe nach.
 */
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../src/lib/image-utils", () => ({
  resizeImage: async () => "data:image/png;base64,MOCK",
  dominantColor: () => Promise.resolve(null),
}))
vi.mock("../src/hooks/use-groups", () => ({
  useMembers: () => ({ data: [{ id: "did:key:zME", displayName: "Ich", isAdmin: true }], isLoading: false }),
}))

const { SpaceThemePanel } = await import("../src/components/layout/space-theme-panel")
const { GroupDialog } = await import("../src/components/layout/group-dialog")
const { colorAxes, colorFromAxes, readTint } = await import("../src/lib/space-theme")
const { parseColor } = await import("../src/lib/oklch")
const { loadRuntimeConfig, resetRuntimeConfigForTests } = await import("../src/lib/runtime-config")

const COLOR = "#e87520"

describe("readTint", () => {
  it("nimmt Zahlen 0–1, kappt und wirft Unsinn weg", () => {
    expect(readTint(0.5)).toBe(0.5)
    expect(readTint(2)).toBe(1)
    expect(readTint(0)).toBeNull()
    expect(readTint(-1)).toBeNull()
    for (const v of [Number.NaN, "0.5", null, undefined, {}]) expect(readTint(v), String(v)).toBeNull()
  })
})

describe("colorAxes ↔ colorFromAxes", () => {
  it("bildet eine Farbe auf Reglerstellungen ab und zurueck", () => {
    const axes = colorAxes(COLOR)
    const back = parseColor(colorFromAxes(axes))!
    const orig = parseColor(COLOR)!
    expect(Math.abs(back.l - orig.l)).toBeLessThan(0.01)
    expect(Math.abs(back.h - orig.h)).toBeLessThan(1.5)
  })

  it("haelt sich im Farbraum, auch bei voller Kraeftigkeit", () => {
    expect(colorFromAxes({ hue: 120, chroma: 100, lightness: 50 })).toMatch(/^#[0-9a-f]{6}$/)
  })
})

const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
const slider = (label: string) => document.querySelector<HTMLInputElement>(`input[type="range"][aria-label="${label}"]`)!
/** Einen Regler bewegen, wie der Browser es taete (nativer Setter + `input`). */
const move = async (label: string, value: number) => {
  const input = slider(label)
  await act(async () => {
    setValue.call(input, String(value))
    input.dispatchEvent(new Event("input", { bubbles: true }))
    await Promise.resolve()
  })
}

describe("SpaceThemePanel", () => {
  let root: Root
  const saved: Array<Record<string, unknown>> = []
  const group = (data: Record<string, unknown>) => ({ id: "g1", name: "Garten", data }) as never

  const render = (data: Record<string, unknown>) => {
    act(() => {
      root.render(
        createElement(SpaceThemePanel, {
          group: group(data),
          onUpdateGroup: async (_id: string, u: { data?: Record<string, unknown> }) => {
            if (u.data) saved.push(u.data)
          },
        }),
      )
    })
  }
  const last = (key: string) => {
    for (let i = saved.length - 1; i >= 0; i--) if (key in saved[i]) return saved[i][key]
    return undefined
  }
  const resetButton = () =>
    Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Zurücksetzen"))

  beforeEach(() => {
    document.body.innerHTML = ""
    saved.length = 0
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("zeigt die vier Regler und die Kontraste sofort", () => {
    render({ primaryColor: COLOR })
    for (const l of ["Farbton", "Kräftigkeit", "Helligkeit", "Tönung"]) expect(slider(l), l).not.toBeNull()
    expect(document.body.textContent).toContain("Knopfbeschriftung")
    expect(document.body.textContent).toMatch(/\d\.\d:1/)
  })

  it("stellt die Regler auf die geltende Farbe", () => {
    render({ primaryColor: COLOR })
    const axes = colorAxes(COLOR)
    expect(Number(slider("Farbton").value)).toBe(axes.hue)
    expect(Number(slider("Helligkeit").value)).toBe(axes.lightness)
    expect(Number(slider("Tönung").value)).toBe(0)
  })

  it("schreibt eine Reglerbewegung als neue Primaerfarbe", async () => {
    render({ primaryColor: COLOR })
    await move("Helligkeit", 60)
    const hex = last("primaryColor") as string
    expect(Math.round(parseColor(hex)!.l * 100)).toBe(60)
    expect(Number(slider("Helligkeit").value)).toBe(60)
  })

  it("zeigt nach einem Sprung aus dem Farbraum, was wirklich gilt", async () => {
    render({ primaryColor: COLOR })
    await move("Helligkeit", 30)
    const hex = last("primaryColor") as string
    expect(Number(slider("Helligkeit").value)).toBe(Math.round(parseColor(hex)!.l * 100))
  })

  it("speichert die Toenung als Zahl 0–1 und loescht sie bei 0", async () => {
    render({ primaryColor: COLOR })
    await move("Tönung", 50)
    expect(last("tint")).toBe(0.5)
    await move("Tönung", 0)
    expect(last("tint")).toBeNull()
  })

  it("nimmt mit EINEM Knopf Farbe und Toenung zurueck", async () => {
    render({ primaryColor: COLOR, tint: 0.4 })
    expect(resetButton()).toBeDefined()
    await act(async () => { resetButton()!.click() })
    for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve() })
    const patch = saved.at(-1)!
    expect(patch.primaryColor).toBeNull()
    expect(patch.tint).toBeNull()
    expect(resetButton(), "verschwindet, wenn nichts mehr gesetzt ist").toBeUndefined()
  })

  /**
   * Ohne eigene Toenung erbt der Space die der Instanz. Der Regler zeigt,
   * was gilt; ein Reset fuehrt dorthin zurueck, nicht auf 0.
   */
  it("zeigt die geerbte Toenung der Instanz, solange der Space keine setzt", async () => {
    resetRuntimeConfigForTests()
    await loadRuntimeConfig({
      fetchImpl: (async () => ({ ok: true, status: 200, json: async () => ({ branding: { theme: { tint: 0.5 } } }) })) as unknown as typeof fetch,
    })
    try {
      render({})
      expect(Number(slider("Tönung").value)).toBe(50)
      expect(resetButton(), "geerbt ist nicht gesetzt — kein Reset").toBeUndefined()
      render({ primaryColor: COLOR, tint: 0.2 })
      expect(Number(slider("Tönung").value)).toBe(20)
    } finally {
      resetRuntimeConfigForTests()
    }
  })

  /**
   * Das Panel bekommt die lebende Gruppe. Aendert sie sich von aussen —
   * anderes Geraet, Reset im Dialog — ziehen die Regler nach.
   */
  it("zieht nach, wenn die Gruppe sich von aussen aendert", () => {
    render({ primaryColor: COLOR })
    render({ primaryColor: "#2563eb", tint: 0.3 })
    expect(Number(slider("Farbton").value)).toBe(colorAxes("#2563eb").hue)
    expect(Number(slider("Tönung").value)).toBe(30)
  })
})

describe("GroupDialog → Feineinstellung", () => {
  let root: Root
  beforeEach(() => {
    document.body.innerHTML = ""
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  const renderDialog = (props: Record<string, unknown>) => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: "g1", name: "G", data: { primaryColor: COLOR } } },
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          onUpdateGroup: async () => {},
          ...props,
        } as never),
      )
    })
    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })
  }
  const opener = () =>
    Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Feineinstellung öffnen"))

  it("haelt die Regler aus dem Dialog heraus", () => {
    renderDialog({})
    for (const l of ["Farbton", "Kräftigkeit", "Helligkeit", "Tönung"]) expect(slider(l), l).toBeNull()
  })

  it("zeigt den Knopf nur, wenn jemand das Panel oeffnen kann", () => {
    renderDialog({})
    expect(opener()).toBeUndefined()
    renderDialog({ onOpenThemePanel: () => {} })
    expect(opener()).toBeDefined()
  })

  it("schliesst sich und uebergibt die Gruppe", () => {
    const closed: boolean[] = []
    const opened: Array<{ id: string }> = []
    renderDialog({ onOpenChange: (o: boolean) => closed.push(o), onOpenThemePanel: (g: { id: string }) => opened.push(g) })
    act(() => { opener()!.click() })
    expect(closed).toEqual([false])
    expect(opened.map((g) => g.id)).toEqual(["g1"])
  })
})
