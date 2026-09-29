// @vitest-environment jsdom
/**
 * Der Umschalter für hell und dunkel (rls#568). Bis hierher lieferte das
 * Toolkit nur die Leser; den Knopf baute jede App selbst, und der Rahmen trug
 * eine eigene Fassung, die nur die Klasse setzte und die Systemvorgabe nach
 * dem Start nicht mehr hörte.
 *
 * Theme = zwei Signale: die `dark`-Klasse (Tailwind, Karte) UND `data-theme`
 * (Stylesheets, die sich an das Attribut hängen). Wer nur eines führt, lässt
 * die andere Hälfte der Oberfläche im falschen Schema stehen.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ColorSchemeToggle } from "../src/components/layout/color-scheme-toggle"
import {
  applyColorScheme,
  applyInitialColorScheme,
  followSystemColorScheme,
  initialDarkMode,
  STORAGE_KEY_THEME,
} from "../src/lib/color-scheme"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** Eine steuerbare Systemvorgabe: `system.set(true)` meldet einen Wechsel auf dunkel. */
function stubSystem(initialDark: boolean) {
  let dark = initialDark
  const listeners = new Set<(e: { matches: boolean }) => void>()
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query.includes("dark") ? dark : !dark },
    media: query,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.delete(fn),
  }))
  return {
    set(next: boolean) {
      dark = next
      for (const fn of [...listeners]) fn({ matches: next })
    },
    get listenerCount() { return listeners.size },
  }
}

const wurzel = () => document.documentElement
const istDunkel = () => wurzel().classList.contains("dark")
const knopf = () => document.querySelector("button") as HTMLButtonElement

let host: HTMLDivElement
let root: Root

async function mount(props: Parameters<typeof ColorSchemeToggle>[0] = {}) {
  await act(async () => { root.render(<ColorSchemeToggle {...props} />) })
}

async function klick() {
  await act(async () => { knopf().click() })
}

beforeEach(() => {
  localStorage.clear()
  wurzel().classList.remove("dark")
  wurzel().removeAttribute("data-theme")
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  wurzel().classList.remove("dark")
  wurzel().removeAttribute("data-theme")
})

describe("applyColorScheme — beide Signale", () => {
  it("setzt Klasse und data-theme gemeinsam, in beide Richtungen", () => {
    applyColorScheme("dark")
    expect(istDunkel()).toBe(true)
    expect(wurzel().getAttribute("data-theme")).toBe("dark")
    applyColorScheme("light")
    expect(istDunkel()).toBe(false)
    expect(wurzel().getAttribute("data-theme")).toBe("light")
  })

  it("applyInitialColorScheme führt data-theme mit, nicht nur die Klasse", () => {
    stubSystem(true)
    applyInitialColorScheme()
    expect(wurzel().getAttribute("data-theme")).toBe("dark")
  })
})

describe("initialDarkMode ohne matchMedia", () => {
  it("fällt auf hell zurück statt zu werfen", () => {
    vi.stubGlobal("matchMedia", undefined)
    expect(initialDarkMode()).toBe(false)
  })
})

describe("followSystemColorScheme", () => {
  it("folgt einem Systemwechsel, solange nichts gewählt ist", () => {
    const system = stubSystem(false)
    const stop = followSystemColorScheme()
    system.set(true)
    expect(istDunkel()).toBe(true)
    expect(wurzel().getAttribute("data-theme")).toBe("dark")
    stop()
  })

  it("lässt eine getroffene Wahl stehen, wenn das System wechselt", () => {
    const system = stubSystem(false)
    localStorage.setItem(STORAGE_KEY_THEME, "light")
    applyColorScheme("light")
    const stop = followSystemColorScheme()
    system.set(true)
    expect(istDunkel()).toBe(false)
    stop()
  })

  it("hört nach dem Abmelden nicht mehr zu", () => {
    const system = stubSystem(false)
    const stop = followSystemColorScheme()
    stop()
    expect(system.listenerCount).toBe(0)
  })
})

describe("ColorSchemeToggle", () => {
  it("folgt beim ersten Besuch dem System und schreibt dabei nichts fest", async () => {
    stubSystem(true)
    await mount()
    expect(istDunkel()).toBe(true)
    expect(wurzel().getAttribute("data-theme")).toBe("dark")
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBeNull()
  })

  it("nimmt eine gemerkte Wahl vor der Systemvorgabe", async () => {
    stubSystem(true)
    localStorage.setItem(STORAGE_KEY_THEME, "light")
    await mount()
    expect(istDunkel()).toBe(false)
    expect(wurzel().getAttribute("data-theme")).toBe("light")
  })

  it("schaltet beide Signale um und merkt die Wahl", async () => {
    stubSystem(false)
    await mount()
    await klick()
    expect(istDunkel()).toBe(true)
    expect(wurzel().getAttribute("data-theme")).toBe("dark")
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBe("dark")
    await klick()
    expect(istDunkel()).toBe(false)
    expect(wurzel().getAttribute("data-theme")).toBe("light")
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBe("light")
  })

  it("benennt, wohin der Knopf schaltet — und zieht nach, wenn das System wechselt", async () => {
    const system = stubSystem(false)
    await mount()
    expect(knopf().getAttribute("aria-label")).toBe("Dunkles Design")
    await act(async () => { system.set(true) })
    expect(istDunkel()).toBe(true)
    expect(knopf().getAttribute("aria-label")).toBe("Helles Design")
  })

  it("überhört das System, sobald gewählt wurde", async () => {
    const system = stubSystem(false)
    await mount()
    await klick() // dunkel gewählt
    await act(async () => { system.set(false) })
    await act(async () => { system.set(true) })
    await act(async () => { system.set(false) })
    expect(istDunkel()).toBe(true)
  })

  it("nimmt einen eigenen Speicherschlüssel", async () => {
    stubSystem(false)
    await mount({ storageKey: "karabirrdt-theme" })
    await klick()
    expect(localStorage.getItem("karabirrdt-theme")).toBe("dark")
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBeNull()
  })

  it("schaltet auch, wenn der Speicher wirft", async () => {
    stubSystem(false)
    vi.stubGlobal("localStorage", {
      getItem() { throw new Error("gesperrt") },
      setItem() { throw new Error("gesperrt") },
    })
    await mount()
    await klick()
    expect(istDunkel()).toBe(true)
  })

  // Codex R1: Die Wahl hing nur am Speicher. Bei gesperrtem Speicher holte
  // der nächste Systemwechsel das Schema zurück, obwohl gewählt worden war.
  it("hält die Wahl auch bei gesperrtem Speicher gegen einen Systemwechsel", async () => {
    const system = stubSystem(false)
    vi.stubGlobal("localStorage", {
      getItem() { throw new Error("gesperrt") },
      setItem() { throw new Error("gesperrt") },
    })
    await mount({ storageKey: "gesperrt-1" })
    await klick() // dunkel gewählt, nicht speicherbar
    await act(async () => { system.set(true) })
    await act(async () => { system.set(false) })
    expect(istDunkel()).toBe(true)
  })

  it("hält die Wahl, wenn Schreiben scheitert, Lesen aber geht", async () => {
    const system = stubSystem(false)
    vi.stubGlobal("localStorage", {
      getItem() { return null },
      setItem() { throw new Error("voll") },
    })
    await mount({ storageKey: "gesperrt-2" })
    await klick()
    await act(async () => { system.set(true) })
    await act(async () => { system.set(false) })
    expect(istDunkel()).toBe(true)
  })

  // Codex R1: Ohne `type="button"` sendet der Knopf ein umgebendes Formular ab.
  it("sendet kein umgebendes Formular ab", async () => {
    stubSystem(false)
    const abgesendet = vi.fn((e: Event) => e.preventDefault())
    await act(async () => {
      root.render(<form onSubmit={(e) => abgesendet(e.nativeEvent)}><ColorSchemeToggle /></form>)
    })
    await klick()
    expect(abgesendet).not.toHaveBeenCalled()
    expect(knopf().getAttribute("type")).toBe("button")
  })

  it("meldet sich beim Abbau vom System ab", async () => {
    const system = stubSystem(false)
    await mount()
    expect(system.listenerCount).toBe(1)
    act(() => root.unmount())
    expect(system.listenerCount).toBe(0)
    root = createRoot(host) // für afterEach
  })
})
