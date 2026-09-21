// @vitest-environment jsdom
import { act, createElement, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { RouterProvider, createMemoryRouter, useLocation, useNavigate } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { UnsavedChangesProvider, useUnsavedChanges } from "../src/hooks/use-unsaved-changes"
import { UnsavedChangesGuard } from "../src/router"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

/**
 * Der Guard vor Entwurfsverlust (Spec 01, Der Modul-Host: eine App mit Router
 * mountet ihn). Bis rls#429 lag er in der Referenz-App, und die Netzwerk-App
 * hatte den Provider, aber keinen Verbraucher — Eingaben gingen ohne
 * Rueckfrage verloren (Codex-Befund).
 */
let host: HTMLDivElement
let root: Root
let pfad = ""
let steuerung: { dirty: (d: boolean) => void; gehe: (to: string) => void } | null = null

function Sonde() {
  const unsaved = useUnsavedChanges()
  const navigate = useNavigate()
  const location = useLocation()
  pfad = `${location.pathname}${location.search}`
  useEffect(() => {
    steuerung = { dirty: (d) => unsaved?.setDirty(d), gehe: (to) => navigate(to) }
  }, [navigate, unsaved])
  return null
}

async function starte(start: string) {
  const router = createMemoryRouter(
    [{ path: "*", element: createElement(UnsavedChangesProvider, null, createElement(Sonde), createElement(UnsavedChangesGuard)) }],
    { initialEntries: [start] },
  )
  await act(async () => { root.render(createElement(RouterProvider, { router })) })
}
const dialog = () => document.body.textContent?.includes("Änderungen verwerfen?") ?? false
const knopf = (text: string) => [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)

beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); steuerung = null })
afterEach(() => { act(() => root.unmount()); host.remove() })

describe("UnsavedChangesGuard (toolkit/router)", () => {
  it("haelt eine Navigation an, die den schmutzigen Composer verlaesst, und laesst sie auf Wunsch durch", async () => {
    await starte("/g/collection?compose=task")
    await act(async () => { steuerung!.dirty(true) })
    await act(async () => { steuerung!.gehe("/g/collection") })
    expect(dialog()).toBe(true)
    expect(pfad).toBe("/g/collection?compose=task")
    await act(async () => { knopf("Weiter bearbeiten")!.click() })
    expect(dialog()).toBe(false)
    expect(pfad).toBe("/g/collection?compose=task")
    await act(async () => { steuerung!.gehe("/g/collection") })
    await act(async () => { knopf("Verwerfen")!.click() })
    expect(pfad).toBe("/g/collection")
  })

  it("laesst eine Navigation durch, die im Composer bleibt (Modulwechsel mit compose)", async () => {
    await starte("/g/collection?compose=task")
    await act(async () => { steuerung!.dirty(true) })
    await act(async () => { steuerung!.gehe("/g/map?compose=task") })
    expect(dialog()).toBe(false)
    expect(pfad).toBe("/g/map?compose=task")
  })

  it("blockiert nichts, solange nichts ungespeichert ist — auch nicht nach dem Speichern", async () => {
    await starte("/g/collection?compose=task")
    await act(async () => { steuerung!.gehe("/g/collection") })
    expect(dialog()).toBe(false)
    expect(pfad).toBe("/g/collection")
    await act(async () => { steuerung!.gehe("/g/collection/neu?edit=1") })
    await act(async () => { steuerung!.dirty(true); steuerung!.dirty(false) })
    await act(async () => { steuerung!.gehe("/g/collection/neu") })
    expect(dialog()).toBe(false)
    expect(pfad).toBe("/g/collection/neu")
  })

  it("warnt vor Reload und Schliessen nur mit ungespeicherten Eingaben", async () => {
    await starte("/g/collection?compose=task")
    const feuer = () => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented }
    expect(feuer()).toBe(false)
    await act(async () => { steuerung!.dirty(true) })
    expect(feuer()).toBe(true)
    await act(async () => { steuerung!.dirty(false) })
    expect(feuer()).toBe(false)
  })
})
