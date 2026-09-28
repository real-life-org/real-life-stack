// @vitest-environment jsdom
import { act, createElement, StrictMode, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { FormEpochProvider, useEpochBusy, useFieldEpoch, type FieldEpoch } from "../src/lib/form-epoch"

/**
 * Vertrag „Formular-Epoche" (shared-components → Formular-Epoche): Ein
 * asynchrones Ergebnis gilt nur, wenn die Epoche beim Eintreffen dieselbe ist
 * wie beim Start. Space- und Typwechsel, Abbau des Felds und eine neue Arbeit
 * derselben Art machen die vorige ungültig.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

let epoch!: FieldEpoch<{ value: string }>
function Field({ value, options }: { value: string; options?: Parameters<typeof useFieldEpoch>[1] }): ReactNode {
  epoch = useFieldEpoch({ value }, options)
  return null
}

async function draw(node: ReactNode) {
  await act(async () => root.render(createElement(StrictMode, null, node)))
}

describe("Formular-Epoche", () => {
  it("ohne Wechsel gilt der Wächter; now() liefert den Stand beim Eintreffen", async () => {
    await draw(createElement(Field, { value: "a" }))
    const guard = epoch.begin()
    await draw(createElement(Field, { value: "b" }))
    expect(guard.valid()).toBe(true)
    expect(guard.now()).toEqual({ value: "b" })
    let seen = ""
    expect(guard.apply((s) => (seen = s.value))).toBe(true)
    expect(seen).toBe("b")
  })

  it("Space- oder Typwechsel des Formulars macht laufende Arbeit ungültig und bricht sie ab", async () => {
    const form = (space: string, type: string) => createElement(FormEpochProvider, { scope: [space, type] }, createElement(Field, { value: "a" }))
    await draw(form("g", "event"))
    const guard = epoch.begin()
    await draw(form("g", "event"))
    expect(guard.valid()).toBe(true)
    await draw(form("anders", "event"))
    expect(guard.valid()).toBe(false)
    expect(guard.signal.aborted).toBe(true)
    const next = epoch.begin()
    await draw(form("anders", "task"))
    expect(next.valid()).toBe(false)
    expect(next.apply(() => undefined)).toBe(false)
  })

  it("der Abbau des Felds macht laufende Arbeit ungültig", async () => {
    await draw(createElement(Field, { value: "a" }))
    const guard = epoch.begin()
    await draw(createElement("div"))
    expect(guard.valid()).toBe(false)
    expect(guard.signal.aborted).toBe(true)
  })

  it("lifetime: false — der Abbau beendet die Arbeit nicht, ein Scope-Wechsel schon", async () => {
    await draw(createElement(Field, { value: "a", options: { lifetime: false, scope: ["item-1", "g"] } }))
    const guard = epoch.begin()
    await draw(createElement("div"))
    expect(guard.valid()).toBe(true)
    await draw(createElement(Field, { value: "a", options: { lifetime: false, scope: ["item-1", "g"] } }))
    const other = epoch.begin()
    await draw(createElement(Field, { value: "a", options: { lifetime: false, scope: ["item-1", "anders"] } }))
    expect(other.valid()).toBe(false)
  })

  it("eine neue Arbeit derselben Art und invalidate() machen die vorige ungültig; andere Arten bleiben", async () => {
    await draw(createElement(Field, { value: "a" }))
    const first = epoch.begin("suche")
    const pick = epoch.begin("pick")
    const second = epoch.begin("suche")
    expect(first.valid()).toBe(false)
    expect(first.signal.aborted).toBe(true)
    expect(second.valid()).toBe(true)
    expect(pick.valid()).toBe(true)
    epoch.invalidate("suche")
    expect(second.valid()).toBe(false)
    expect(pick.valid()).toBe(true)
  })

  it("mit Zustand im Baum: ein Space-Wechsel per setState gilt sofort", async () => {
    let setSpace!: (s: string) => void
    function Form(): ReactNode {
      const [space, set] = useState("g")
      setSpace = set
      return createElement(FormEpochProvider, { scope: [space] }, createElement(Field, { value: "a" }))
    }
    await draw(createElement(Form))
    const guard = epoch.begin()
    await act(async () => setSpace("anders"))
    expect(guard.valid()).toBe(false)
  })

  it("Zähler statt Vergleich: Space G → H → G lässt alte Arbeit ungültig", async () => {
    const form = (space: string) => createElement(FormEpochProvider, { scope: [space] }, createElement(Field, { value: "a" }))
    await draw(form("g"))
    const guard = epoch.begin()
    await draw(form("h"))
    await draw(form("g"))
    expect(guard.valid()).toBe(false)
    const scoped = (space: string) => createElement(Field, { value: "a", options: { scope: [space] } })
    await draw(scoped("g"))
    const field = epoch.begin()
    await draw(scoped("h"))
    await draw(scoped("g"))
    expect(field.valid()).toBe(false)
  })

  it("externe Meldungen (watch) zählen, auch nach dem Abbau: G → H → G bleibt ungültig", async () => {
    const listeners = new Set<() => void>()
    const watch = (cb: () => void) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    }
    await draw(createElement(Field, { value: "a", options: { lifetime: false, watch } }))
    const guard = epoch.begin()
    await draw(createElement("div"))
    for (const cb of [...listeners]) cb()
    for (const cb of [...listeners]) cb()
    expect(guard.valid()).toBe(false)
  })

  it("Warte-Zustand: läuft, fertig, verworfen — ein verworfenes Ergebnis beendet ihn", async () => {
    let busy = false
    function Busy({ space }: { space: string }): ReactNode {
      return createElement(FormEpochProvider, { scope: [space] }, createElement(Inner))
    }
    function Inner(): ReactNode {
      epoch = useFieldEpoch({ value: "a" })
      busy = useEpochBusy(epoch, "suche")
      return null
    }
    await draw(createElement(Busy, { space: "g" }))
    let guard!: ReturnType<typeof epoch.begin>
    await act(async () => {
      guard = epoch.begin("suche")
    })
    expect(busy).toBe(true)
    await act(async () => guard.finish())
    expect(busy).toBe(false)
    await act(async () => {
      guard = epoch.begin("suche")
    })
    expect(busy).toBe(true)
    // Verworfen durch einen Space-Wechsel: der Spinner endet, auch ohne finish.
    await draw(createElement(Busy, { space: "h" }))
    expect(busy).toBe(false)
    await act(async () => {
      guard = epoch.begin("suche")
    })
    await act(async () => epoch.invalidate("suche"))
    expect(busy).toBe(false)
  })

  it("ein inzwischen gesperrtes Feld nimmt kein Ergebnis mehr an", async () => {
    await draw(createElement(Field, { value: "a", options: { locked: false } }))
    const guard = epoch.begin()
    await draw(createElement(Field, { value: "a", options: { locked: true } }))
    let wrote = false
    expect(guard.apply(() => (wrote = true))).toBe(false)
    expect(wrote).toBe(false)
    // Auch nach dem Entsperren nicht: die Sperre war ein Zählerschritt.
    await draw(createElement(Field, { value: "a", options: { locked: false } }))
    expect(guard.apply(() => (wrote = true))).toBe(false)
  })
})
