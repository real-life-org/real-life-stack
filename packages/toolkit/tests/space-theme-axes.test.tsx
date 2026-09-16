// @vitest-environment jsdom
/**
 * Die Achsen im Bereich "Aussehen": drei Regler auf der Farbe, einer fuer
 * die Toenung, Kontrastzeilen, ein Reset.
 *
 * Die Regler haben keinen eigenen Zustand — sie zeigen die geltende Farbe
 * und schreiben sie zurueck. Was hier geprueft wird, ist darum vor allem:
 * bewegt sich `primaryColor`, bewegt sich `tint`, und nimmt EIN Knopf beides
 * zurueck.
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

const { GroupDialog, colorAxes, colorFromAxes, readTint } = await import("../src/components/layout/group-dialog")
const { parseColor } = await import("../src/lib/oklch")

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
    expect(axes.hue).toBeGreaterThan(0)
    expect(axes.chroma).toBeGreaterThan(0)
    expect(axes.lightness).toBeGreaterThan(0)
    const back = parseColor(colorFromAxes(axes))!
    const orig = parseColor(COLOR)!
    // Rundung auf ganze Reglerschritte, mehr Abweichung darf es nicht sein.
    expect(Math.abs(back.l - orig.l)).toBeLessThan(0.01)
    expect(Math.abs(back.h - orig.h)).toBeLessThan(1.5)
  })

  it("haelt sich im Farbraum, auch bei voller Kraeftigkeit", () => {
    expect(colorFromAxes({ hue: 120, chroma: 100, lightness: 50 })).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe("Achsen im Bereich Aussehen", () => {
  let root: Root
  const saved: Array<Record<string, unknown>> = []

  const render = (data: Record<string, unknown>) => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: "g1", name: "G", data } } as never,
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          onUpdateGroup: async (_id: string, u: { data?: Record<string, unknown> }) => {
            if (u.data) saved.push(u.data)
          },
        } as never),
      )
    })
    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })
  }

  const slider = (label: string) => document.querySelector<HTMLInputElement>(`input[type="range"][aria-label="${label}"]`)!

  /** Die drei Achsen und die Kontrastzahlen liegen hinter "Erweitert". */
  const openAdvanced = () => {
    const toggle = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Erweitert") as HTMLButtonElement
    act(() => { toggle.click() })
  }

  /** Einen Regler bewegen, wie der Browser es taete (nativer Setter + `input`). */
  const move = async (label: string, value: number) => {
    const input = slider(label)
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    await act(async () => {
      setValue.call(input, String(value))
      input.dispatchEvent(new Event("input", { bubbles: true }))
      await Promise.resolve()
    })
  }

  const last = (key: string) => {
    for (let i = saved.length - 1; i >= 0; i--) if (key in saved[i]) return saved[i][key]
    return undefined
  }
  const resetButton = () =>
    Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Zurücksetzen")) as
      | HTMLButtonElement
      | undefined

  beforeEach(() => {
    document.body.innerHTML = ""
    saved.length = 0
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("zeigt die Regler erst hinter Erweitert", () => {
    render({ primaryColor: COLOR })
    for (const l of ["Farbton", "Kräftigkeit", "Helligkeit", "Tönung"]) expect(slider(l), `${l} zu`).toBeNull()
    expect(document.body.textContent).not.toContain("Knopfbeschriftung")
    openAdvanced()
    for (const l of ["Farbton", "Kräftigkeit", "Helligkeit", "Tönung"]) expect(slider(l), `${l} offen`).not.toBeNull()
  })

  it("stellt die Regler auf die geltende Farbe", () => {
    render({ primaryColor: COLOR })
    openAdvanced()
    const axes = colorAxes(COLOR)
    expect(Number(slider("Farbton").value)).toBe(axes.hue)
    expect(Number(slider("Helligkeit").value)).toBe(axes.lightness)
    expect(Number(slider("Tönung").value)).toBe(0)
  })

  it("schreibt eine Reglerbewegung als neue Primaerfarbe", async () => {
    render({ primaryColor: COLOR })
    openAdvanced()
    // 60 liegt fuer Orange im Farbraum; weiter unten schnappt die Abbildung
    // auf den naechsten darstellbaren Wert, und das zeigt der Regler dann auch.
    await move("Helligkeit", 60)
    const hex = last("primaryColor") as string
    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(Math.round(parseColor(hex)!.l * 100)).toBe(60)
    // Und der Regler steht danach dort — kein eigener Zustand, der abdriftet.
    expect(Number(slider("Helligkeit").value)).toBe(60)
  })

  it("zeigt nach einem Sprung aus dem Farbraum, was wirklich gilt", async () => {
    render({ primaryColor: COLOR })
    openAdvanced()
    await move("Helligkeit", 30)
    const hex = last("primaryColor") as string
    // Regler und gespeicherte Farbe sagen dasselbe — auch wenn es nicht 30 ist.
    expect(Number(slider("Helligkeit").value)).toBe(Math.round(parseColor(hex)!.l * 100))
  })

  it("speichert die Toenung als Zahl 0–1", async () => {
    render({ primaryColor: COLOR })
    openAdvanced()
    await move("Tönung", 50)
    expect(last("tint")).toBe(0.5)
    expect(Number(slider("Tönung").value)).toBe(50)
  })

  it("loescht die Toenung bei 0 statt eine 0 zu speichern", async () => {
    render({ primaryColor: COLOR, tint: 0.5 })
    openAdvanced()
    await move("Tönung", 0)
    expect(last("tint")).toBeNull()
  })

  it("uebernimmt eine gespeicherte Toenung", () => {
    render({ primaryColor: COLOR, tint: 0.4 })
    openAdvanced()
    expect(Number(slider("Tönung").value)).toBe(40)
  })

  it("nimmt mit EINEM Knopf Farbe und Toenung zurueck", async () => {
    render({ primaryColor: COLOR, tint: 0.4 })
    const reset = resetButton()
    expect(reset, "der Weg zurueck steht da").toBeDefined()
    await act(async () => { reset!.click() })
    for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve() })
    expect(last("primaryColor")).toBeNull()
    expect(last("tint")).toBeNull()
    expect(resetButton(), "und verschwindet, wenn nichts mehr gesetzt ist").toBeUndefined()
  })

  it("zeigt den Weg zurueck auch, wenn nur die Toenung gesetzt ist", () => {
    render({ tint: 0.3 })
    expect(resetButton()).toBeDefined()
  })

  it("zeigt die Kontraste der akzentabhaengigen Paare", () => {
    render({ primaryColor: COLOR })
    openAdvanced()
    const text = document.body.textContent ?? ""
    expect(text).toContain("Knopfbeschriftung")
    expect(text).toContain("Fokusring")
    expect(text).toMatch(/\d\.\d:1/)
  })

  /**
   * Der Dialog verdeckt genau das, was ein Regler veraendert. Solange man
   * zieht, gibt er den Blick frei; beim Loslassen ist er wieder da.
   */
  it("gibt beim Ziehen den Blick auf die App frei", async () => {
    render({ primaryColor: COLOR })
    openAdvanced()
    const content = () => document.querySelector('[data-slot="dialog-content"]')!
    const overlay = () => document.querySelector('[data-slot="dialog-overlay"]')!
    expect(content().getAttribute("data-peek")).toBeNull()

    await act(async () => {
      slider("Tönung").dispatchEvent(new Event("pointerdown", { bubbles: true }))
    })
    expect(content().getAttribute("data-peek"), "Dialog tritt zurueck").toBe("true")
    expect(overlay().className, "Backdrop weg").toContain("opacity-0")

    await act(async () => { window.dispatchEvent(new Event("pointerup")) })
    expect(content().getAttribute("data-peek"), "und ist wieder da").toBeNull()
    expect(overlay().className).not.toContain("opacity-0")
  })
})
