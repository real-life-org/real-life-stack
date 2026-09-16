// @vitest-environment jsdom
/**
 * Einzelne Stufen der Akzentskala von Hand setzen.
 *
 * Die Ableitung trifft das meiste, aber nicht jeden Geschmack. Wer eine
 * Stufe anfasst, soll nur diese eine festlegen — alles Uebrige bleibt
 * abgeleitet und zieht mit, wenn die Ableitung besser wird.
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

const { GroupDialog } = await import("../src/components/layout/group-dialog")
const { scalesForColor } = await import("../src/lib/color-scales")

const COLOR = "#e87520"

describe("Stufen von Hand setzen", () => {
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

  const stepField = (step: number) =>
    document.querySelector<HTMLInputElement>(`input[aria-label="Stufe ${step}"]`)!

  /**
   * Eine Farbe im Waehler setzen, so wie der Browser es taete.
   *
   * React merkt sich den zuletzt gerenderten Wert am Knoten; eine direkte
   * Zuweisung an `value` sieht fuer den Abgleich aus wie "nichts Neues" und
   * loest `onChange` nicht aus. Darum ueber den nativen Setter, und mit dem
   * `input`-Ereignis, auf das React tatsaechlich hoert.
   */
  const setStep = async (step: number, hex: string) => {
    const input = stepField(step)
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    await act(async () => {
      setValue.call(input, hex)
      input.dispatchEvent(new Event("input", { bubbles: true }))
      await Promise.resolve()
    })
  }

  /** Was zuletzt fuer `accentSteps` geschrieben wurde. */
  const lastSteps = () => {
    for (let i = saved.length - 1; i >= 0; i--) {
      if ("accentSteps" in saved[i]) return saved[i].accentSteps
    }
    return undefined
  }

  beforeEach(() => {
    document.body.innerHTML = ""
    saved.length = 0
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("zeigt zwoelf Stufen", () => {
    render({ primaryColor: COLOR })
    expect(document.querySelectorAll('input[aria-label^="Stufe "]')).toHaveLength(12)
  })

  it("zeigt die abgeleiteten Werte", () => {
    render({ primaryColor: COLOR })
    const expected = scalesForColor(COLOR, "light").accent
    for (let step = 1; step <= 12; step++) {
      expect(stepField(step).value, `Stufe ${step}`).toBe(expected[step - 1])
    }
  })

  it("speichert genau die angefasste Stufe", async () => {
    render({ primaryColor: COLOR })
    await setStep(9, "#123456")
    expect(lastSteps()).toEqual({ 9: "#123456" })
  })

  it("sammelt mehrere Stufen, statt die vorige zu vergessen", async () => {
    render({ primaryColor: COLOR })
    await setStep(9, "#123456")
    await setStep(3, "#fedcba")
    expect(lastSteps()).toEqual({ 9: "#123456", 3: "#fedcba" })
  })

  it("uebernimmt, was gespeichert war", () => {
    render({ primaryColor: COLOR, accentSteps: { 9: "#123456" } })
    expect(stepField(9).value).toBe("#123456")
    // Der Rest bleibt abgeleitet.
    expect(stepField(1).value).toBe(scalesForColor(COLOR, "light").accent[0])
  })

  /**
   * Wer eine Stufe auf genau den abgeleiteten Wert stellt, will sie nicht
   * festnageln. Wuerde sie trotzdem gespeichert, verlore sie stillschweigend
   * jede spaetere Verbesserung der Ableitung.
   */
  it("speichert nichts, wenn der Wert der abgeleitete ist", async () => {
    render({ primaryColor: COLOR, accentSteps: { 9: "#123456" } })
    const derived = scalesForColor(COLOR, "light").accent[8]
    await setStep(9, derived)
    expect(lastSteps()).toBeNull()
  })

  it("nimmt alle Stufen auf einmal zurueck", async () => {
    render({ primaryColor: COLOR, accentSteps: { 9: "#123456", 3: "#fedcba" } })
    const reset = Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("zurücksetzen")) as HTMLButtonElement
    expect(reset, "der Weg zurueck steht da").toBeDefined()
    await act(async () => { reset.click() })
    // `null` loescht den Schluessel — Spec 04: Merge-Patch der Tiefe 1.
    expect(lastSteps()).toBeNull()
  })

  it("zeigt keinen Rueckweg, solange nichts gesetzt ist", () => {
    render({ primaryColor: COLOR })
    const reset = Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("zurücksetzen"))
    expect(reset).toBeUndefined()
  })

  /**
   * Die Kontrastanzeige ist der Grund, warum man hier ueberhaupt gefahrlos
   * drehen kann: sie sagt sofort, wenn eine Beschriftung in ihrem Knopf
   * verschwindet.
   */
  it("meldet, wenn eine gesetzte Stufe den Text verschluckt", async () => {
    render({ primaryColor: COLOR })
    const before = document.querySelectorAll(".text-destructive").length
    expect(before, "die Ableitung selbst reisst keine Latte").toBe(0)

    // Stufe 3 ist die getoente Flaeche, auf der Menuetext steht — und dessen
    // Farbe kommt aus derselben Skala (Stufe 12), laesst sich also nicht
    // einfach auf schwarz oder weiss ausweichen. Wird die Flaeche selbst
    // dunkel, reisst das Paar.
    await setStep(3, "#111111")
    expect(document.querySelectorAll(".text-destructive").length)
      .toBeGreaterThan(0)
  })
})
