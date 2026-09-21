// @vitest-environment jsdom
import { act, createElement, useEffect, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { List } from "lucide-react"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { FilterProvider, useSharedFilter } from "../src/components/filter/filter-store"
import { MemoryFocusProvider, useItemFocus, type ItemFocus } from "../src/hooks/use-item-focus"
import { CreateHostProvider, useCreate, type CreateHostValue } from "../src/components/host/create-host"
import { DetailHostProvider } from "../src/components/host/detail-host"
import { ModuleHost, hostFiltersFor, useModuleHost, type ModuleHostValue } from "../src/components/host/module-host"
import type { ModuleEntry, ModuleViewProps } from "../src/lib/module-register"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

/**
 * Der Modul-Host (Spec 01, „Der Modul-Host") macht aus dem Registereintrag
 * die laufende Flaeche: Items nach dem Ladevertrag, Erstellen mit allen
 * Typen und dem Vorschlag des Moduls, Space-Kontext per Hook. Bis zum
 * 21.09.2026 tat jede Ansicht das selbst — siebenmal.
 */
const item = (id: string, data: Record<string, unknown>, type = "event"): Item =>
  ({ id, type, createdAt: "2026-09-21T10:00:00.000Z", createdBy: "u1", data })

const ITEMS: Item[] = [
  item("mit-start", { title: "Termin", start: "2026-10-01T10:00" }),
  item("mit-ort", { title: "Ort", position: { type: "Point", coordinates: [13.4, 52.5] } }, "place"),
  item("nur-text", { title: "Notiz" }, "post"),
]

let host: HTMLDivElement
let root: Root
let empfangen: ModuleViewProps | null = null
let kontext: ModuleHostValue | null = null
let fokus: ItemFocus | null = null
let erstellen: CreateHostValue | null = null
let abfragen: unknown[] = []

function Probe(props: ModuleViewProps) {
  empfangen = props
  kontext = useModuleHost()
  fokus = useItemFocus()
  erstellen = useCreate()
  return null
}

const eintrag = (teil: Partial<ModuleEntry>): ModuleEntry => ({ id: "probe", label: "Probe", icon: List, view: Probe, ...teil })

function Suche({ text }: { text: string }) {
  const { setSearchText } = useSharedFilter()
  useEffect(() => { setSearchText(text) }, [setSearchText, text])
  return null
}

function baum(entry: ModuleEntry, groupId = "__overview__", suche = ""): ReactNode {
  const connector = new MockConnector(
    { items: ITEMS, groups: [{ id: "g1", name: "Garten" }], users: [{ id: "u1", displayName: "Uli" }], groupMembers: { g1: ["u1"] } },
    { allowFixtureAuthors: true },
  )
  const observe = connector.observe.bind(connector)
  connector.observe = (filter) => { abfragen.push(filter); return observe(filter) }
  return createElement(ConnectorProvider, { connector },
    createElement(FilterProvider, null,
      createElement(Suche, { text: suche }),
      createElement(MemoryFocusProvider, { module: entry.id },
        createElement(DetailHostProvider, null,
          createElement(CreateHostProvider, null,
            createElement(ModuleHost, { entry, groupId, active: true }))))))
}

async function rendere(entry: ModuleEntry, groupId?: string, suche?: string) {
  await act(async () => { root.render(baum(entry, groupId, suche)) })
}

beforeEach(() => {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host)
  empfangen = null; kontext = null; fokus = null; erstellen = null; abfragen = []
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe("hostFiltersFor — der Ladevertrag als Filter", () => {
  it("leitet den Filter aus dem einen Hinweis ab, mit den Optionen des Eintrags", () => {
    expect(hostFiltersFor({ presents: ["status"], options: { statusField: "kind" } })).toEqual([{ hasField: ["kind"] }])
  })
  it("stellt je Hinweis eine Abfrage — nie eine ungefilterte fuer alle", () => {
    expect(hostFiltersFor({ presents: ["start", "position"] })).toEqual([{ hasField: ["start"] }, { hasField: ["position"] }])
  })
  it("stellt bei loads: module keine Abfrage", () => {
    expect(hostFiltersFor({ presents: ["position"], loads: "module" })).toBeNull()
  })
  it("laedt ohne Hinweis alles — das Modul aggregiert", () => {
    expect(hostFiltersFor({})).toEqual([{}])
  })
  it("wirft bei einem Hinweis ohne Zeile in der Tabelle, statt still nichts zu laden", () => {
    expect(() => hostFiltersFor({ presents: ["gibtsnicht"] })).toThrow(/gibtsnicht/)
  })
})

describe("Der Modul-Host", () => {
  it("laedt die Items nach `presents` und reicht sie der Flaeche", async () => {
    await rendere(eintrag({ presents: ["start"] }))
    expect(empfangen?.items?.map((i) => i.id)).toEqual(["mit-start"])
    expect(empfangen?.itemsLoading).toBe(false)
  })

  it("vereinigt mehrere Hinweise aus je einer gefilterten Abfrage — keine ungefilterte", async () => {
    await rendere(eintrag({ presents: ["start", "position"] }))
    expect(empfangen?.items?.map((i) => i.id).sort()).toEqual(["mit-ort", "mit-start"])
    const modulAbfragen = abfragen.filter((f) => JSON.stringify(f) !== "{}")
    expect(modulAbfragen).toEqual(expect.arrayContaining([{ hasField: ["start"] }, { hasField: ["position"] }]))
    // Das Vokabular der Flaeche fragt `{}` — die Modul-Items nie.
    expect(abfragen.filter((f) => JSON.stringify(f) === "{}").length).toBeLessThanOrEqual(1)
  })

  it("reicht die Items GEFILTERT weiter — ein Modul kann den geteilten Filter nicht vergessen", async () => {
    await rendere(eintrag({}), "__overview__", "Notiz")
    expect(empfangen?.items?.map((i) => i.id)).toEqual(["nur-text"])
    expect(kontext?.items?.map((i) => i.id)).toEqual(["nur-text"])
  })

  it("laedt alles fuer ein Modul ohne Hinweis", async () => {
    await rendere(eintrag({}))
    expect(empfangen?.items).toHaveLength(3)
  })

  it("stellt keine Abfrage, wenn das Modul selbst laedt", async () => {
    await rendere(eintrag({ presents: ["position"], loads: "module" }))
    expect(empfangen?.items).toBeUndefined()
    expect(kontext?.items).toBeUndefined()
  })

  it("registriert das Erstellen mit ALLEN Typen unter der Modul-Id", async () => {
    await rendere(eintrag({ presents: ["start"] }))
    // Ohne Angabe nimmt der Erstellen-Host den ersten Typ der Konfiguration —
    // und das ist der erste des Manifests, nicht der des Moduls.
    await act(async () => erstellen!.startCreate())
    expect(fokus?.composeType).toBe("post")
  })

  it("stellt den Plusknopf mit dem Vorschlag des Moduls — ein Vorschlag, kein Zaun", async () => {
    await rendere(eintrag({ presents: ["start"], options: { suggestType: "event" } }))
    const knopf = host.querySelector<HTMLButtonElement>('button[aria-label="Erstellen"]')
    expect(knopf).not.toBeNull()
    await act(async () => knopf!.click())
    expect(fokus?.composeType).toBe("event")
  })

  it("gibt den Space-Kontext per Hook: Aggregat ohne Space, sonst der Space samt Mitgliedern", async () => {
    await rendere(eintrag({}))
    expect(kontext?.isOverview).toBe(true)
    expect(kontext?.currentSpace).toBeUndefined()
    await rendere(eintrag({}), "g1")
    expect(kontext?.isOverview).toBe(false)
    expect(kontext?.currentSpace).toBe("g1")
    expect(kontext?.members.map((m) => m.id)).toEqual(["u1"])
  })
})
