// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  composeTypeManifest,
  TOOLKIT_TYPE_LAYER,
  type Item,
  type TypeManifestEntry,
} from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { MemoryFocusProvider, useItemFocus } from "../src/hooks/use-item-focus"
import { FieldNavigationProvider } from "../src/components/navigation/field-navigation"
import {
  registerTypePresentation,
  resetTypePresentationForTests,
  resolveTypePresentation,
  setTypeManifest,
} from "../src/components/preview/type-presentation"
import { contentTypeFromRegister, itemToComposerData, mapComposerSubmission } from "../src/components/composer/content-types"
import { ContentComposer, type ContentComposerSubmitData } from "../src/components/composer/content-composer"
import { itemRelationDataKey } from "../src/components/composer/item-relations"
import { valueFieldToData, valueFieldsFromRegister } from "../src/components/composer/value-fields"
import { LocationWidget } from "../src/components/composer/widgets/location-widget"
import { AvatarField } from "../src/components/composer/widgets/avatar-widget"
import { LocationPickProvider, useLocationPick, type LocationPickValue } from "../src/components/map/location-pick"
import { applyMapViewItemPick } from "../src/components/map/map-view"
import { safeImageSrc } from "../src/lib/field-values"

/**
 * S4b — Ort, Medien, Avatar (shared-components → Widget-Paare B4, B5, B11).
 *
 * B4: EIN Ort-Feld. Die Autovervollständigung mischt Ort-Items (oben) und
 * Geocoder-Adressen; der Karten-Pick nimmt einen Marker als Ort-Item und
 * einen freien Punkt als Koordinaten. Lesend: Ort-Item als Chip in Typfarbe,
 * Adresse als Text mit Sprung „Karte". Das Event schreibt das Ort-Item als
 * eingebettete Kante `locatedAt` (Event → Ort); der Ort liest sie eingehend
 * („Findet hier statt", kommende Events).
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const HEUTE = Date.now()
const tage = (n: number) => new Date(HEUTE + n * 86_400_000).toISOString()

const item = (id: string, type: string, data: Record<string, unknown>, relations: Item["relations"] = []): Item => ({
  id,
  type,
  createdBy: ME,
  createdAt: "2026-09-20T10:00:00.000Z",
  data,
  relations,
})

const PUNKT = { type: "Point", coordinates: [13.4, 52.5] }
const MARKTHALLE = item("pl-markt", "place", { title: "Markthalle", address: "Markt 7, 10115 Berlin", position: PUNKT })
const GARTEN = item("pl-garten", "place", { title: "Gemeinschaftsgarten", position: PUNKT })
const WORKSHOP = item("ev-work", "event", { title: "Workshop", start: tage(3) }, [{ predicate: "locatedAt", target: "item:pl-markt" }])
const FEST = item("ev-fest", "event", { title: "Hoffest", start: tage(1) }, [{ predicate: "locatedAt", target: "item:pl-markt" }])
const VORBEI = item("ev-vorbei", "event", { title: "Vergangen", start: tage(-2) }, [{ predicate: "locatedAt", target: "item:pl-markt" }])
const ANDERSWO = item("ev-anders", "event", { title: "Anderswo", start: tage(2) }, [{ predicate: "locatedAt", target: "item:pl-garten" }])
const ADRESSE = item("ev-adr", "event", { title: "Treffen", start: tage(4), address: "Gartenstraße 3", position: PUNKT })
const NUR_TEXT = item("ev-text", "event", { title: "Treffen", address: "Irgendwo" })
const VERLOREN = item("ev-lost", "event", { title: "Treffen", address: "Ersatzadresse" }, [{ predicate: "locatedAt", target: "item:weg" }])

const ALLE = [MARKTHALLE, GARTEN, WORKSHOP, FEST, VORBEI, ANDERSWO, ADRESSE, NUR_TEXT, VERLOREN]

let host: HTMLDivElement
let root: Root
let focused: string | null = null

function FocusSpy(): ReactNode {
  focused = useItemFocus().itemId ?? null
  return null
}

async function settle() {
  for (let round = 0; round < 5; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

async function render(node: ReactNode, items: Item[] = ALLE, openField?: (field: string) => (() => void) | null) {
  const connector = new MockConnector(
    {
      items,
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [{ id: ME, displayName: "Ich" }],
      groupMembers: { g: [ME] },
      groupItems: { g: items.map((i) => i.id) },
    } as never,
    { allowFixtureAuthors: true },
  )
  await connector.init()
  connector.setCurrentGroup("g")
  const inner = createElement(MemoryFocusProvider, { module: "calendar", scope: "g" } as never, node, createElement(FocusSpy))
  await act(async () => {
    root.render(
      createElement(
        ConnectorProvider,
        { connector: connector as never },
        openField ? createElement(FieldNavigationProvider, { value: { openField } }, inner) : inner,
      ),
    )
  })
  await settle()
}

const row = (id: string) => host.querySelector(`[data-meta-row="${id}"]`)

beforeEach(() => {
  focused = null
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  resetTypePresentationForTests()
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// B4: Register

describe("B4 Register: Event am Ort", () => {
  it("das Event führt locatedAt als Item-Kante der Meta-Box; der Ort liest sie eingehend", () => {
    const event = resolveTypePresentation("event").edges ?? []
    expect(event.find((e) => e.predicate === "locatedAt")).toMatchObject({ itemRole: "from", storage: "embedded", widget: "item-relation", pos: "meta" })
    const place = resolveTypePresentation("place").edges ?? []
    expect(place.find((e) => e.predicate === "locatedAt")).toMatchObject({
      itemRole: "to",
      storage: "embedded",
      widget: "item-relation",
      pos: "list",
      label: "Findet hier statt",
      list: { filter: "upcoming", sort: "start" },
    })
  })

  it("im Formular EIN Ort-Feld: die Kante gehört dem Ort-Widget, kein eigenes Verknüpfungsfeld", () => {
    const event = contentTypeFromRegister("event")
    expect(event.defaultWidgets).toContain("location")
    expect(event.defaultWidgets).not.toContain("item-relation")
    expect(event.itemRelations).toEqual([expect.objectContaining({ predicate: "locatedAt", targetType: "place", location: true })])
  })

  it("der Ort hat kein Ort-Item-Feld (keine Kante zu einem Ort)", () => {
    const place = contentTypeFromRegister("place")
    expect(place.itemRelations ?? []).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// B4: Lesen

describe("B4 lesen", () => {
  it("Ort-Item als Chip in der Typfarbe, in der Ort-Zeile; keine zweite Zeile für die Kante", async () => {
    const Meta = resolveTypePresentation("event").detail
    await render(createElement(Meta, { item: WORKSHOP }))
    const ort = row("address")
    expect(ort?.querySelector('[data-item-ref="pl-markt"]')?.textContent).toContain("Markthalle")
    const placeBadge = resolveTypePresentation("place").badge!.className.split(" ")[0]!
    expect(ort?.querySelector('[data-item-ref="pl-markt"] button')?.className).toContain(placeBadge)
    expect(row("locatedAt:from")).toBeNull()
  })

  it("ein Klick auf den Chip öffnet den Ort in derselben Panel-Instanz", async () => {
    const Meta = resolveTypePresentation("event").detail
    await render(createElement(Meta, { item: WORKSHOP }))
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-item-ref="pl-markt"] button')!.click()
    })
    await settle()
    expect(focused).toBe("pl-markt")
  })

  it("Adresse als Text mit Sprung „Karte“, wenn es Koordinaten gibt", async () => {
    const openField = vi.fn((field: string) => (field === "position" ? () => undefined : null))
    const Meta = resolveTypePresentation("event").detail
    await render(createElement(Meta, { item: ADRESSE }), ALLE, openField)
    const ort = row("address")
    expect(ort?.textContent).toContain("Gartenstraße 3")
    const karte = [...(ort?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Karte")
    expect(karte).toBeTruthy()
  })

  it("ohne Koordinaten kein Sprung", async () => {
    const openField = vi.fn(() => () => undefined)
    const Meta = resolveTypePresentation("event").detail
    await render(createElement(Meta, { item: NUR_TEXT }), ALLE, openField)
    expect(row("address")?.textContent).toContain("Irgendwo")
    expect([...(row("address")?.querySelectorAll("button") ?? [])].some((b) => b.textContent === "Karte")).toBe(false)
  })

  it("ein nicht auflösbares Ort-Item: die Adresse, falls da, sonst keine Zeile", async () => {
    const Meta = resolveTypePresentation("event").detail
    await render(createElement(Meta, { item: VERLOREN }))
    expect(row("address")?.textContent).toContain("Ersatzadresse")
    expect(host.querySelector('[data-item-ref="weg"]')).toBeNull()
  })

  it("die Karte des Events nennt den Ort-Item-Namen; ein Klick öffnet den Ort", async () => {
    const Preview = resolveTypePresentation("event").preview!
    await render(createElement(Preview, { item: WORKSHOP }))
    const ort = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Markthalle"))
    expect(ort).toBeTruthy()
    await act(async () => ort!.click())
    await settle()
    expect(focused).toBe("pl-markt")
    await render(createElement(Preview, { item: NUR_TEXT }))
    expect(host.textContent).toContain("Irgendwo")
  })

  it("„Findet hier statt“: die kommenden Events am Ort, nach Beginn sortiert", async () => {
    const Reverse = resolveTypePresentation("place").reverse!
    await render(createElement(Reverse, { item: MARKTHALLE }))
    const list = host.querySelector('[data-reverse-list="locatedAt:to"]')
    expect(list?.getAttribute("aria-label")).toBe("Findet hier statt")
    const ids = [...(list?.querySelectorAll("[data-list-row]") ?? [])].map((r) => r.getAttribute("data-list-row"))
    expect(ids).toEqual(["ev-fest", "ev-work"])
  })
})

// ---------------------------------------------------------------------------
// B4: Abbildung Formular ↔ Item

describe("B4 Abbildung", () => {
  it("Ort-Item gewählt: die Kante locatedAt, keine Adresse und keine Position mehr", () => {
    const mapped = mapComposerSubmission(
      {
        contentType: "event",
        isPublic: false,
        data: { ...itemToComposerData(ADRESSE), address: undefined, position: undefined, [itemRelationDataKey("locatedAt")]: ["item:pl-markt"] },
      } as never,
      { mode: "edit", existingItem: ADRESSE },
    )!
    expect(mapped.relations).toEqual([{ predicate: "locatedAt", target: "item:pl-markt" }])
    expect(mapped.data).not.toHaveProperty("address")
    expect(mapped.data).not.toHaveProperty("position")
  })

  it("Adresse gewählt: die Kante entfällt", () => {
    const initial = itemToComposerData(WORKSHOP)
    expect(initial[itemRelationDataKey("locatedAt") as never]).toEqual(["item:pl-markt"])
    const mapped = mapComposerSubmission(
      {
        contentType: "event",
        isPublic: false,
        data: { ...initial, address: "Neue Straße 1", position: PUNKT, [itemRelationDataKey("locatedAt")]: [] },
      } as never,
      { mode: "edit", existingItem: WORKSHOP },
    )!
    expect(mapped.relations ?? []).toEqual([])
    expect(mapped.data).toMatchObject({ address: "Neue Straße 1", position: PUNKT })
  })
})

// ---------------------------------------------------------------------------
// B4: Schreiben (Widget)

function LocationHarness(props: Partial<Parameters<typeof LocationWidget>[0]> & { onChange?: ReturnType<typeof vi.fn> }) {
  return createElement(LocationWidget, {
    label: "Ort",
    value: {},
    onChange: props.onChange ?? vi.fn(),
    ...props,
  } as never)
}

const input = () => host.querySelector<HTMLInputElement>('input[role="combobox"]')!

async function tippe(text: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    setter.call(input(), text)
    input().dispatchEvent(new Event("input", { bubbles: true }))
  })
}

describe("B4 schreiben: gemischte Autovervollständigung", () => {
  it("Ort-Items stehen oben, darunter die Adressen des Geocoders", async () => {
    const geocode = vi.fn(async () => [{ label: "Marktstraße 1, Berlin", lat: 52.5, lng: 13.4 }])
    await render(
      createElement(LocationHarness, {
        geocode,
        places: { selected: null, candidates: [MARKTHALLE, GARTEN], onSelect: vi.fn() },
      }),
    )
    await tippe("Markt")
    // Ort-Items sofort, ohne auf den Geocoder zu warten.
    expect([...host.querySelectorAll("[data-place-option]")].map((o) => o.textContent)).toEqual([expect.stringContaining("Markthalle")])
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
    })
    await settle()
    const options = [...host.querySelectorAll('[role="option"]')]
    expect(options.map((o) => (o.hasAttribute("data-place-option") ? "place" : "address"))).toEqual(["place", "address"])
  })

  it("ein Ort-Item wählen: per Klick und per Tastatur", async () => {
    const onSelect = vi.fn()
    await render(createElement(LocationHarness, { places: { selected: null, candidates: [MARKTHALLE, GARTEN], onSelect } }))
    await tippe("garten")
    await act(async () => {
      input().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
    })
    await act(async () => {
      input().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    expect(onSelect).toHaveBeenLastCalledWith(GARTEN)
    await tippe("markt")
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-place-option="pl-markt"] button')!.click()
    })
    expect(onSelect).toHaveBeenLastCalledWith(MARKTHALLE)
  })

  it("gewählt: Chip statt Eingabe, ✕ nimmt ihn zurück", async () => {
    const onSelect = vi.fn()
    await render(createElement(LocationHarness, { places: { selected: { target: "item:pl-markt", item: MARKTHALLE }, candidates: [MARKTHALLE], onSelect } }))
    expect(host.querySelector('input[role="combobox"]')).toBeNull()
    expect(host.querySelector('[data-place-chip="pl-markt"]')?.textContent).toContain("Markthalle")
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="Markthalle entfernen"]')!.click()
    })
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it("ohne Ort-Kante des Typs bleibt es das Adressfeld", async () => {
    await render(createElement(LocationHarness, {}))
    await tippe("Markt")
    expect(host.querySelector("[data-place-option]")).toBeNull()
  })
})

describe("B4 im Formular des Events", () => {
  it("Ort-Item gewählt und gespeichert: die Kante, keine Adresse; ein Marker auf der Karte wird Ort-Item", async () => {
    const submits: ContentComposerSubmitData[] = []
    let handlers: { onPick: (p: { lat: number; lng: number }) => void; onPickItem?: (i: Item) => boolean; onCancel?: () => void } | null = null
    await render(
      createElement(ContentComposer, {
        contentTypes: [{ ...contentTypeFromRegister("event"), groupOptions: [{ id: "g", name: "Garten" }], defaultGroup: "g" }],
        initialData: { title: "Neues Treffen", group: "g" },
        showPreview: false,
        requestMapPick: (h: never) => {
          handlers = h
        },
        onSubmit: (sub: ContentComposerSubmitData) => {
          submits.push(sub)
        },
      } as never),
    )
    await tippe("markt")
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-place-option="pl-markt"] button')!.click()
    })
    expect(host.querySelector('[data-place-chip="pl-markt"]')).toBeTruthy()

    // Karten-Pick: ein Event-Marker ist kein Ort → seine Position zählt.
    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[aria-label="Position auf Karte ändern"]')!.click()
    })
    expect(handlers).toBeTruthy()
    let taken = true
    await act(async () => {
      taken = handlers!.onPickItem!(WORKSHOP)
    })
    expect(taken).toBe(false)
    // Ein Ort-Marker wird Ort-Item.
    await act(async () => {
      taken = handlers!.onPickItem!(GARTEN)
    })
    expect(taken).toBe(true)
    expect(host.querySelector('[data-place-chip="pl-garten"]')).toBeTruthy()

    await act(async () => {
      ;[...host.querySelectorAll("button")].find((b) => b.textContent === "Erstellen")!.click()
    })
    await settle()
    const last = submits.at(-1)!
    expect(last.data[itemRelationDataKey("locatedAt")]).toEqual(["item:pl-garten"])
    expect(last.data.address).toBeUndefined()

    // Ein freier Punkt ersetzt das Ort-Item.
    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[aria-label="Position auf Karte ändern"]')!.click()
    })
    await act(async () => {
      handlers!.onPick({ lat: 52.5, lng: 13.4 })
    })
    expect(host.querySelector("[data-place-chip]")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// B4: Karten-Pick

describe("B4 Karten-Pick: Marker = Ort-Item, frei = Koordinaten", () => {
  it("ein Marker, den das Feld nimmt, wird Ort-Item; sonst zählt seine Position", () => {
    const updatePick = vi.fn()
    const setPickPosition = vi.fn()
    const confirmPick = vi.fn()
    const pickItem = vi.fn((it: Item) => it.type === "place")
    applyMapViewItemPick(MARKTHALLE, false, pickItem, updatePick, setPickPosition, confirmPick)
    expect(pickItem).toHaveBeenCalledWith(MARKTHALLE)
    expect(updatePick).not.toHaveBeenCalled()
    expect(confirmPick).toHaveBeenCalledTimes(1)

    applyMapViewItemPick(ADRESSE, false, pickItem, updatePick, setPickPosition, confirmPick)
    expect(updatePick).toHaveBeenCalledWith({ lat: 52.5, lng: 13.4 })
  })

  it("der Pick-Kontext reicht einen Marker an das Feld weiter", async () => {
    let pick!: LocationPickValue
    function Spy(): ReactNode {
      pick = useLocationPick()
      return null
    }
    await act(async () => {
      root.render(createElement(LocationPickProvider, { navigateToModule: () => undefined, currentModule: "map" }, createElement(Spy)))
    })
    const onPickItem = vi.fn(() => true)
    await act(async () => {
      pick.startPick({ onPick: vi.fn(), onPickItem })
    })
    expect(pick.pickItem(MARKTHALLE)).toBe(true)
    expect(onPickItem).toHaveBeenCalledWith(MARKTHALLE)
    // Ohne Rückruf für Items nimmt niemand den Marker.
    await act(async () => {
      pick.startPick({ onPick: vi.fn() })
    })
    expect(pick.pickItem(MARKTHALLE)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// B5: Medien lesen

const BILD = (id: string, url: string, type = "image/jpeg") => ({ id, name: `${id}.jpg`, url, type })
const POST = item("post-1", "post", {
  content: "Fotos vom Fest",
  media: [
    BILD("a", "https://example.org/a.jpg"),
    BILD("b", "https://example.org/b.jpg"),
    BILD("boese", "javascript:alert(1)"),
    { id: "doc", name: "Plan.pdf", url: "https://example.org/plan.pdf", type: "application/pdf" },
  ],
})

describe("B5 media lesen", () => {
  it("Bildreihe im Inhalt; unsichere Adressen erscheinen nicht; Dateien als Link", async () => {
    const Content = resolveTypePresentation("post").content!
    await render(createElement(Content, { item: POST }), [POST])
    const bilder = [...host.querySelectorAll("[data-media-row] img")].map((img) => img.getAttribute("src"))
    expect(bilder).toEqual(["https://example.org/a.jpg", "https://example.org/b.jpg"])
    const datei = host.querySelector<HTMLAnchorElement>("[data-media-file] a")
    expect(datei?.getAttribute("href")).toBe("https://example.org/plan.pdf")
    expect(datei?.getAttribute("rel")).toBe("noopener noreferrer")
    expect(host.innerHTML).not.toContain("javascript:")
  })

  it("ohne Medien nichts", async () => {
    const Content = resolveTypePresentation("post").content!
    const leer = item("post-2", "post", { content: "Nur Text" })
    await render(createElement(Content, { item: leer }), [leer])
    expect(host.innerHTML).toBe("")
  })

  it("Lightbox: Klick öffnet, Pfeiltasten blättern, Escape schließt", async () => {
    const Content = resolveTypePresentation("post").content!
    await render(createElement(Content, { item: POST }), [POST])
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-media-row] button[aria-label^="Bild 1"]')!.click()
    })
    const box = () => document.querySelector("[data-lightbox]")
    expect(box()?.querySelector("img")?.getAttribute("src")).toBe("https://example.org/a.jpg")
    expect(box()?.textContent).toContain("1 / 2")
    await act(async () => {
      box()!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    })
    expect(box()?.querySelector("img")?.getAttribute("src")).toBe("https://example.org/b.jpg")
    await act(async () => {
      box()!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    })
    // Am Ende bleibt es beim letzten Bild.
    expect(box()?.textContent).toContain("2 / 2")
    await act(async () => {
      box()!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))
    })
    expect(box()?.textContent).toContain("1 / 2")
    await act(async () => {
      box()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    await settle()
    expect(box()).toBeNull()
  })

  it("Medien lesen auch Typen, die das Feld nicht deklarieren (zuschaltbar im Formular)", async () => {
    const Content = resolveTypePresentation("event").content!
    const mitBild = item("ev-bild", "event", { title: "Mit Bild", media: [BILD("x", "https://example.org/x.jpg")] })
    await render(createElement(Content, { item: mitBild }), [mitBild])
    expect(host.querySelectorAll("[data-media-row] img")).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// B11: Avatar

const KARTE: TypeManifestEntry = { id: "card", vocabularies: [], relations: [] }
const APP_MANIFEST = composeTypeManifest([TOOLKIT_TYPE_LAYER, { name: "app", definitions: [KARTE] }])
function registriereAvatar() {
  setTypeManifest(APP_MANIFEST)
  registerTypePresentation("app", [
    {
      id: "card",
      label: "Karte",
      fields: [
        { key: "title", widget: "title", pos: "head" },
        { key: "avatarUrl", widget: "avatar", pos: "head", label: "Bild" },
        { key: "description", widget: "text", pos: "content" },
      ],
    },
  ])
}
const DATA_URL = "data:image/webp;base64,AAAA"

describe("B11 avatar", () => {
  it("lesend: Kopf-Avatar aus dem Feld; ohne oder mit unsicherem Wert nichts", async () => {
    registriereAvatar()
    const Head = resolveTypePresentation("card").head!
    const mit = item("c1", "card", { title: "Lena", avatarUrl: DATA_URL })
    await render(createElement(Head, { item: mit }), [mit])
    expect(host.querySelector("[data-head-avatar] img, [data-head-avatar]")).toBeTruthy()
    expect(host.querySelector("[data-head-avatar]")?.getAttribute("data-src")).toBe(DATA_URL)
    await act(async () => root.render(createElement(Head, { item: item("c2", "card", { title: "Ohne" }) })))
    expect(host.querySelector("[data-head-avatar]")).toBeNull()
    await act(async () => root.render(createElement(Head, { item: item("c3", "card", { title: "Böse", avatarUrl: "javascript:alert(1)" }) })))
    expect(host.querySelector("[data-head-avatar]")).toBeNull()
  })

  it("im Formular im Kopf neben dem Titel; Datenvertrag: sichere Bildadresse oder nichts", () => {
    registriereAvatar()
    const card = contentTypeFromRegister("card")
    expect(card.defaultWidgets.slice(0, 2)).toEqual(["title", "avatar"])
    const [avatar] = valueFieldsFromRegister(resolveTypePresentation("card").fields!).filter((f) => f.widget === "avatar")
    expect(avatar).toMatchObject({ key: "avatarUrl", widget: "avatar", label: "Bild" })
    expect(valueFieldToData(avatar!, DATA_URL)).toBe(DATA_URL)
    expect(valueFieldToData(avatar!, "https://example.org/a.png")).toBe("https://example.org/a.png")
    expect(valueFieldToData(avatar!, "javascript:alert(1)")).toBeNull()
    expect(valueFieldToData(avatar!, "")).toBeUndefined()
  })

  it("Upload: Resize auf 512 px, der Wert ist die verkleinerte Fassung; Entfernen leert", async () => {
    const resize = vi.fn(async () => DATA_URL)
    const onChange = vi.fn()
    await render(createElement(AvatarField, { label: "Bild", value: "", onChange, resize }), [])
    const file = new File(["x"], "foto.png", { type: "image/png" })
    const fileInput = host.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(fileInput, "files", { value: [file] })
    await act(async () => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await settle()
    expect(resize).toHaveBeenCalledWith(file, 512)
    expect(onChange).toHaveBeenCalledWith(DATA_URL)

    await act(async () => root.render(createElement(AvatarField, { label: "Bild", value: DATA_URL, onChange, resize })))
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="Bild entfernen"]')!.click()
    })
    expect(onChange).toHaveBeenLastCalledWith("")
  })

  it("kein Bild: Datei wird abgewiesen, ohne Resize", async () => {
    const resize = vi.fn(async () => DATA_URL)
    const onChange = vi.fn()
    await render(createElement(AvatarField, { label: "Bild", value: "", onChange, resize }), [])
    const fileInput = host.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(fileInput, "files", { value: [new File(["x"], "a.pdf", { type: "application/pdf" })] })
    await act(async () => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }))
    })
    expect(resize).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe("sichere Bildadressen", () => {
  it("http(s), blob: und data:image; nichts anderes", () => {
    expect(safeImageSrc("https://example.org/a.jpg")).toBe("https://example.org/a.jpg")
    expect(safeImageSrc("http://example.org/a.jpg")).toBe("http://example.org/a.jpg")
    expect(safeImageSrc("blob:https://app/123")).toBe("blob:https://app/123")
    expect(safeImageSrc(DATA_URL)).toBe(DATA_URL)
    expect(safeImageSrc("javascript:alert(1)")).toBeNull()
    expect(safeImageSrc("data:text/html,<script>")).toBeNull()
    expect(safeImageSrc(" ")).toBeNull()
    expect(safeImageSrc("/personas/anna.png")).toBe("/personas/anna.png")
    expect(safeImageSrc("//fremd.example/a.png")).toBeNull()
    expect(safeImageSrc(42)).toBeNull()
  })
})
