// @vitest-environment jsdom
import { act, createElement, useEffect, useMemo } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { CreateHostProvider, useCreate, useRegisterCreate, type CreateConfig } from "../src/components/host/create-host"
import { MemoryFocusProvider, useItemFocus, type ItemFocus } from "../src/hooks/use-item-focus"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Der Erstellen-Host haengt am Fokus-Vertrag, nicht am Router (Spec 01,
 * „Der Modul-Host"). Hier laeuft er im Speicher — dieselben Zusagen wie mit
 * URL: Was erstellt wird, steht im Fokus; die Konfiguration kommt vom Modul.
 */
let host: HTMLDivElement
let root: Root
let fokus: ItemFocus | null = null
let erstellen: ReturnType<typeof useCreate> | null = null

const config: CreateConfig = {
  contentTypes: [{ id: "post", label: "Beitrag", defaultWidgets: ["text"] }, { id: "event", label: "Termin", defaultWidgets: ["title"] }],
  mapper: (s) => ({ type: s.contentType, data: {} }) as never,
  shell: "sheet",
}

function Modul({ tun }: { tun?: () => void }) {
  fokus = useItemFocus()
  erstellen = useCreate()
  useRegisterCreate("feed", useMemo(() => config, []))
  useEffect(() => { tun?.() }, [tun])
  return null
}

async function laufe(tun?: () => void) {
  await act(async () => {
    root.render(createElement(MemoryFocusProvider, { module: "feed" }, createElement(CreateHostProvider, null, createElement(Modul, { tun }))))
  })
}

beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); fokus = null; erstellen = null })
afterEach(() => { act(() => root.unmount()); host.remove() })

describe("Der Erstellen-Host am Fokus-Vertrag", () => {
  it("meldet nichts, solange niemand erstellt", async () => {
    await laufe()
    expect(erstellen?.isComposing).toBe(false)
    expect(fokus?.composeType).toBeNull()
  })

  it("schreibt den Typ in den Fokus, wenn ein Modul erstellt", async () => {
    await laufe()
    await act(async () => erstellen!.startCreate("event"))
    expect(fokus?.composeType).toBe("event")
    expect(erstellen?.isComposing).toBe(true)
  })

  it("nimmt ohne Angabe den ersten Typ der registrierten Konfiguration", async () => {
    await laufe()
    await act(async () => erstellen!.startCreate())
    expect(fokus?.composeType).toBe("post")
  })

  it("laesst ein offenes Item los, wenn erstellt wird", async () => {
    await laufe()
    await act(async () => fokus!.focusItem("i-1"))
    await act(async () => erstellen!.startCreate("post"))
    expect(fokus?.itemId).toBeUndefined()
    expect(fokus?.composeType).toBe("post")
  })

  it("beendet das Erstellen, wenn der Fokus es beendet", async () => {
    await laufe()
    await act(async () => erstellen!.startCreate("post"))
    await act(async () => fokus!.stopCompose())
    expect(erstellen?.isComposing).toBe(false)
  })
})
