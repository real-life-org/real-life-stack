// @vitest-environment jsdom
import { act, createElement, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MemoryRouter, useLocation } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { MemoryFocusProvider, useItemFocus, type ItemFocus } from "../src/hooks/use-item-focus"
import { UrlFocusProvider } from "../src/router"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Ein Vertrag, zwei Ablagen (Spec 01, „Der Modul-Host"): In der App liegt der
 * Fokus in der URL, ohne Router im Speicher. Beide muessen dasselbe tun —
 * sonst verhaelt sich ein Modul in der Story anders als in der App.
 */
let host: HTMLDivElement
let root: Root
let pfad = ""
let zuletzt: ItemFocus | null = null

function Sonde({ tun }: { tun?: (focus: ItemFocus) => void }) {
  const focus = useItemFocus()
  zuletzt = focus
  useEffect(() => {
    tun?.(focus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

function UrlSonde(props: { tun?: (focus: ItemFocus) => void }) {
  const location = useLocation()
  pfad = `${location.pathname}${location.search}`
  return createElement(Sonde, props)
}

async function url(start: string, tun?: (focus: ItemFocus) => void) {
  await act(async () => {
    root.render(
      createElement(MemoryRouter, { initialEntries: [start] },
        createElement(UrlFocusProvider, null, createElement(UrlSonde, { tun }))),
    )
  })
}

async function speicher(tun?: (focus: ItemFocus) => void, props: { module?: string; onModuleChange?: (m: string) => void } = { module: "feed" }) {
  await act(async () => {
    root.render(createElement(MemoryFocusProvider, props, createElement(Sonde, { tun })))
  })
}

beforeEach(() => {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); pfad = ""; zuletzt = null
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe("Fokus in der URL", () => {
  it("wechselt Modul und Item in einem Schritt", async () => {
    await url("/network/feed", (f) => f.focusItem("event-1", "calendar"))
    expect(pfad).toBe("/network/calendar/event-1")
    expect(zuletzt?.module).toBe("calendar")
    expect(zuletzt?.itemId).toBe("event-1")
  })

  it("erstellt in der URL und laesst dabei ein offenes Item los", async () => {
    await url("/network/feed/event-9?connector=mock", (f) => f.startCompose("event"))
    expect(pfad).toBe("/network/feed?connector=mock&compose=event")
    expect(zuletzt?.composeType).toBe("event")
    expect(zuletzt?.itemId).toBeUndefined()
  })

  it("nimmt das erstellte Item in den Blick und beendet damit das Erstellen", async () => {
    await url("/network/feed?compose=event", (f) => f.focusCreated("neu-1"))
    expect(pfad).toBe("/network/feed/neu-1")
    expect(zuletzt?.composeType).toBeNull()
    expect(zuletzt?.itemId).toBe("neu-1")
  })

  it("wirft beim Fokussieren `edit` und `compose` weg, laesst anderes stehen", async () => {
    await url("/network/feed/event-9?edit=1&compose=post&connector=mock", (f) => f.focusItem("event-1"))
    expect(pfad).toBe("/network/feed/event-1?connector=mock")
    expect(zuletzt?.isEditing).toBe(false)
  })

  it("kennt kein Erstellen ohne Modul im Pfad", async () => {
    await url("/network?compose=event")
    expect(zuletzt?.composeType).toBeNull()
  })
})

describe("Fokus im Speicher — derselbe Vertrag", () => {
  it("nimmt ein Item in den Blick und meldet ein genanntes Modul nach oben", async () => {
    const gewechselt: string[] = []
    await speicher((f) => f.focusItem("event-1", "calendar"), { module: "feed", onModuleChange: (m) => gewechselt.push(m) })
    expect(zuletzt?.itemId).toBe("event-1")
    expect(gewechselt).toEqual(["calendar"])
  })

  it("erstellt und laesst dabei das offene Item los", async () => {
    await speicher((f) => { f.focusItem("event-9"); f.startCompose("event") })
    expect(zuletzt?.composeType).toBe("event")
    expect(zuletzt?.itemId).toBeUndefined()
  })

  it("nimmt das erstellte Item in den Blick", async () => {
    await speicher((f) => { f.startCompose("event"); f.focusCreated("neu-1") })
    expect(zuletzt?.composeType).toBeNull()
    expect(zuletzt?.itemId).toBe("neu-1")
  })

  it("schreibt statt zu bearbeiten — nie beides", async () => {
    await speicher((f) => { f.focusItem("e1"); f.editItem(); f.commentOnItem("e1") })
    expect(zuletzt?.isCommenting).toBe(true)
    expect(zuletzt?.isEditing).toBe(false)
  })

  it("wirft ohne Provider, statt still einen eigenen Zustand zu halten", async () => {
    const fehler = await new Promise<string>((resolve) => {
      const stumm = console.error; console.error = () => {}
      try { act(() => root.render(createElement(Sonde))) } catch (e) { resolve(String(e)) } finally { console.error = stumm }
      resolve("kein Fehler")
    })
    expect(fehler).toMatch(/Fokus-Provider/)
  })
})
