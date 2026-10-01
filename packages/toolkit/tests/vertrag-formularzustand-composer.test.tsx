// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

const resize = vi.hoisted(() => {
  const state: { finish: ((v: string) => void) | null } = { finish: null }
  return {
    state,
    fn: vi.fn(() => new Promise<string>((r) => (state.finish = r))),
  }
})
vi.mock("../src/lib/image-utils", async (orig) => ({ ...(await orig<object>()), resizeImage: resize.fn }))

import { ConnectorProvider } from "../src/hooks/connector-context"
import { ContentComposer, type ContentComposerHandle, type ContentComposerSubmitData, type ContentTypeConfig } from "../src/components/composer/content-composer"
import { contentTypeFromRegister } from "../src/components/composer/content-types"
import { itemRelationDataKey } from "../src/components/composer/item-relations"
import { resolveTypePresentation } from "../src/components/preview/type-presentation"
import { locationField, type LocationValue } from "../src/components/composer/form-fields"
import { LocationField } from "../src/components/composer/widgets/location-field"
import type { LocationChecks } from "../src/components/composer/widgets/location-widget"
import { FormHost } from "./support/form-host"

/**
 * Vertragstests „Formularzustand" (shared-components → Formularzustand,
 * Prüfbar): am Composer, wie Nutzer ihn bedienen.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const item = (id: string, type: string, data: Record<string, unknown>, relations: Item["relations"] = []): Item =>
  ({ id, type, createdBy: ME, createdAt: "2026-09-20T10:00:00.000Z", data, relations }) as Item

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  resize.fn.mockClear()
  resize.state.finish = null
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
async function settle(ms = 10) {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((r) => setTimeout(r, ms)))
}

const GROUPS = [
  { id: "g", name: "Garten" },
  { id: "h", name: "Hof" },
]

function connectorWith(items: Item[], groupItems: Record<string, string[]>) {
  return new MockConnector(
    {
      items,
      groups: GROUPS.map((g) => ({ ...g, data: {} })),
      users: [{ id: ME, displayName: "Ich" }],
      groupMembers: { g: [ME], h: [ME] },
      groupItems,
    } as never,
    { allowFixtureAuthors: true },
  )
}

const typeSelect = () => host.querySelector<HTMLButtonElement>('button[aria-label^="Typ wählen"]')!
async function chooseType(label: string) {
  await act(async () => {
    typeSelect().focus()
    typeSelect().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  })
  const entry = [...document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((el) => el.textContent?.includes(label))
  expect(entry, label).toBeDefined()
  await act(async () => entry!.click())
}
async function tippe(input: HTMLInputElement, text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
const titleInput = () => host.querySelector<HTMLInputElement>('input[placeholder], input')!

// Typen mit und ohne Bildfeld (B11).
const AVATAR = { key: "avatarUrl", widget: "avatar" as const, label: "Bild" }
const KARTE: ContentTypeConfig = { id: "karte", label: "Karte", defaultWidgets: ["title", "avatar"], valueFields: [AVATAR] }
const PROFIL: ContentTypeConfig = { id: "profil", label: "Profil", defaultWidgets: ["title", "avatar"], valueFields: [AVATAR] }
const AUFGABE: ContentTypeConfig = { id: "aufgabe", label: "Aufgabe", defaultWidgets: ["title"] }

async function composer(contentTypes: ContentTypeConfig[], extra: Record<string, unknown> = {}) {
  const submits: ContentComposerSubmitData[] = []
  const apiRef: { current: ContentComposerHandle | null } = { current: null }
  const draw = (more: Record<string, unknown> = {}) =>
    act(async () =>
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(ContentComposer, {
            contentTypes,
            showPreview: false,
            apiRef,
            onSubmit: (s: ContentComposerSubmitData) => {
              submits.push(s)
            },
            ...extra,
            ...more,
          } as never),
        ),
      ),
    )
  await draw()
  const speichern = async () => {
    await act(async () => {
      ;[...host.querySelectorAll("button")].find((b) => b.textContent === "Erstellen")!.click()
    })
    await settle()
    return submits.at(-1)!
  }
  return { submits, apiRef, draw, speichern }
}

async function chooseImage() {
  const file = host.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(file, "files", { value: [new File(["x"], "a.png", { type: "image/png" })], configurable: true })
  await act(async () => file.dispatchEvent(new Event("change", { bubbles: true })))
  // Der Standard-Resize lädt image-utils erst beim Gebrauch (dynamischer Import): unter Last dauert das.
  await vi.waitFor(() => expect(resize.fn).toHaveBeenCalled(), { timeout: 5000 })
  await settle()
}

describe("Regel 10: Bild gewählt, dann Typwechsel während des Verkleinerns", () => {
  it("gibt es das Bildfeld im neuen Typ, steht das Bild danach darin", async () => {
    const { speichern } = await composer([KARTE, PROFIL], { initialData: { title: "Lena" } })
    await chooseImage()
    await chooseType("Profil")
    await act(async () => resize.state.finish!("data:image/webp;base64,BILD"))
    await settle()
    expect(host.querySelector("[data-field-notice]")).toBeNull()
    const sub = await speichern()
    expect(sub.contentType).toBe("profil")
    expect(sub.data.avatarUrl).toBe("data:image/webp;base64,BILD")
  })

  it("sonst übernimmt das Formular nichts und sagt sichtbar, was und warum", async () => {
    const { speichern } = await composer([KARTE, AUFGABE], { initialData: { title: "Lena" } })
    await chooseImage()
    await chooseType("Aufgabe")
    await act(async () => resize.state.finish!("data:image/webp;base64,BILD"))
    await settle()
    const notice = host.querySelector("[data-field-notice]")
    expect(notice?.textContent).toContain("Bild nicht übernommen: Der Typ Aufgabe hat kein Feld „Bild“")
    const sub = await speichern()
    expect(sub.data.avatarUrl ?? "").toBe("")
    // Der Hinweis bleibt, bis der Nutzer ihn schließt.
    await act(async () => host.querySelector<HTMLButtonElement>('[data-field-notice] button[aria-label="Hinweis schließen"]')!.click())
    expect(host.querySelector("[data-field-notice]")).toBeNull()
  })
})

describe("Regel 11: getippte Werte gehören dem Formularzustand", () => {
  it("Titel und Text überstehen Space- und Typwechsel; ein Feld in beiden Typen behält seinen Wert", async () => {
    const MIT_TEXT: ContentTypeConfig = { id: "notiz", label: "Notiz", defaultWidgets: ["title", "text"], groupOptions: GROUPS, defaultGroup: "g" }
    const AUCH_TEXT: ContentTypeConfig = { id: "idee", label: "Idee", defaultWidgets: ["title", "text"], groupOptions: GROUPS, defaultGroup: "g" }
    const { apiRef, speichern } = await composer([MIT_TEXT, AUCH_TEXT], { initialData: { text: "Beschreibung" } })
    await tippe(titleInput(), "Getippt")
    await act(async () => apiRef.current!.patchData({ group: "h" }))
    await chooseType("Idee")
    const sub = await speichern()
    expect(sub.contentType).toBe("idee")
    expect(sub.data.title).toBe("Getippt")
    expect(sub.data.text).toBe("Beschreibung")
    expect(sub.data.group).toBe("h")
  })
})

describe("Regel 10: Kartenklick auf einen Ort-Marker, dann Space-Wechsel vor dem Eintreffen", () => {
  type Handlers = { onPick: (p: { lat: number; lng: number }) => void; onPickItem?: (i: Item) => boolean; onCancel?: () => void }
  const PUNKT = { type: "Point", coordinates: [13.4, 52.5] }
  const IM_GARTEN = item("pl-g", "place", { title: "Schuppen", position: PUNKT })
  const IM_HOF = item("pl-h", "place", { title: "Hoftor", position: PUNKT })

  async function eventForm() {
    const connector = connectorWith([IM_GARTEN, IM_HOF], { g: ["pl-g"], h: ["pl-h"] })
    await connector.init()
    connector.setCurrentGroup("g")
    const box: { h: Handlers | null } = { h: null }
    const submits: ContentComposerSubmitData[] = []
    const apiRef: { current: ContentComposerHandle | null } = { current: null }
    await act(async () =>
      root.render(
        createElement(
          ConnectorProvider,
          { connector: connector as never },
          createElement(ContentComposer, {
            contentTypes: [{ ...contentTypeFromRegister("event"), groupOptions: GROUPS, defaultGroup: "g" }],
            initialData: { title: "Treffen", group: "g" },
            showPreview: false,
            apiRef,
            requestMapPick: (h: Handlers) => {
              box.h = h
            },
            onSubmit: (s: ContentComposerSubmitData) => {
              submits.push(s)
            },
          } as never),
        ),
      ),
    )
    await settle()
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label^="Position auf Karte"]')!.click())
    const speichern = async () => {
      await act(async () => {
        ;[...host.querySelectorAll("button")].find((b) => b.textContent === "Erstellen")!.click()
      })
      await settle()
      return submits.at(-1)!
    }
    return { handlers: () => box.h!, apiRef, speichern }
  }

  it("liegt der Ort im neuen Space, ist er gewählt", async () => {
    const { handlers, apiRef, speichern } = await eventForm()
    await act(async () => apiRef.current!.patchData({ group: "h" }))
    await settle()
    let taken = false
    await act(async () => {
      taken = handlers().onPickItem!(IM_HOF)
    })
    expect(taken).toBe(true)
    expect(host.querySelector('[data-place-chip="pl-h"]')).toBeTruthy()
    const sub = await speichern()
    expect(sub.data[itemRelationDataKey("locatedAt")]).toEqual(["item:pl-h"])
  })

  it("sonst erscheint der Hinweis, und nichts wird übernommen", async () => {
    const { handlers, apiRef, speichern } = await eventForm()
    await act(async () => apiRef.current!.patchData({ group: "h" }))
    await settle()
    let taken = false
    await act(async () => {
      taken = handlers().onPickItem!(IM_GARTEN)
    })
    expect(taken).toBe(true)
    expect(host.querySelector("[data-field-notice]")?.textContent).toContain("Ort nicht übernommen: liegt nicht im Space des Formulars")
    const sub = await speichern()
    expect(sub.data[itemRelationDataKey("locatedAt")] ?? []).toEqual([])
    expect(sub.data.position).toBeUndefined()
  })

  it("ein Pick-Rückruf nach dem Abbrechen schreibt nichts", async () => {
    const { handlers, speichern } = await eventForm()
    const h = handlers()
    await act(async () => h.onCancel!())
    let taken = true
    await act(async () => {
      taken = h.onPickItem!(IM_GARTEN)
      h.onPick({ lat: 1, lng: 2 })
    })
    expect(taken).toBe(false)
    const sub = await speichern()
    expect(sub.data.position).toBeUndefined()
    expect(sub.data[itemRelationDataKey("locatedAt")] ?? []).toEqual([])
  })
})

describe("Regel 10: Hintergrundarbeit nach einem Wechsel", () => {
  it("eine Adresssuche, die nach einem Space- oder Typwechsel eintrifft, zeigt keine Vorschläge und keinen Hinweis", async () => {
    let finish!: (hits: { label: string; lat: number; lng: number }[]) => void
    const geocode = vi.fn(() => new Promise<{ label: string; lat: number; lng: number }[]>((r) => (finish = r)))
    const ORT: ContentTypeConfig = { id: "treff", label: "Treff", defaultWidgets: ["title", "location"], groupOptions: GROUPS, defaultGroup: "g" }
    const { apiRef } = await composer([ORT], { geocode, initialData: { title: "T" } })
    const address = host.querySelector<HTMLInputElement>('input[role="combobox"]')!
    await tippe(address, "Markt")
    await settle(150)
    expect(geocode).toHaveBeenCalledTimes(1)
    expect(host.querySelector(".animate-spin")).toBeTruthy()
    await act(async () => apiRef.current!.patchData({ group: "h" }))
    expect(host.querySelector(".animate-spin")).toBeNull()
    await act(async () => finish([{ label: "Alt 1", lat: 1, lng: 1 }]))
    await settle()
    expect(host.querySelector('[role="option"]')).toBeNull()
    expect(host.querySelector("[data-field-notice]")).toBeNull()
  })
})

describe("Regel 4 und 6: Rückrufwechsel während Karten-Pick und Rückwärtssuche", () => {
  it("Pick und Rückwärtssuche schreiben über den Schreibweg des Formulars JETZT, nicht über einen eingefangenen", async () => {
    let resolveAddress!: (v: string) => void
    const reverseGeocode = vi.fn(() => new Promise<string>((r) => (resolveAddress = r)))
    const box: { h: Handlers | null } = { h: null }
    type Handlers = { onPick: (p: { lat: number; lng: number }) => void }
    const alt = vi.fn()
    const neu = vi.fn()
    // Dasselbe Feld, mit einem Schreibweg, der sich zwischen Start und Eintreffen ändert.
    const def = (spy: (v: LocationValue) => void) => {
      const base = locationField("Ort")
      return {
        ...base,
        write: (v: LocationValue, d: Record<string, unknown>) => {
          spy(v)
          return base.write(v, d)
        },
      }
    }
    const draw = (spy: (v: LocationValue) => void) =>
      act(async () =>
        root.render(
          createElement(FormHost<LocationValue, LocationChecks | undefined>, {
            def: def(spy),
            render: (field) =>
              createElement(LocationField, {
                label: "Ort",
                field,
                reverseGeocode,
                requestMapPick: (h: Handlers) => {
                  box.h = h
                },
              }),
          }),
        ),
      )
    await draw(alt)
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label^="Position auf Karte"]')!.click())
    await draw(neu)
    await act(async () => box.h!.onPick({ lat: 52.5, lng: 13.4 }))
    // Noch ein Render vor dem Eintreffen der Rückwärtssuche.
    await draw(neu)
    await act(async () => resolveAddress("Markt 1"))
    await settle()
    expect(alt).not.toHaveBeenCalled()
    expect(neu).toHaveBeenCalledWith(expect.objectContaining({ position: { type: "Point", coordinates: [13.4, 52.5] } }))
    expect(neu).toHaveBeenLastCalledWith(expect.objectContaining({ address: "Markt 1" }))
  })
})

describe("Regel 9: Aktionszustand der Selbstaktion", () => {
  it("ein Space-Wechsel bei hängendem Lesen beendet „beschäftigt“ sofort; danach kein Abonnement mehr, auch nach dem Abbau der Anzeige", async () => {
    const T = item("t1", "task", { title: "Kompost", status: "open" }, [{ predicate: "assignedTo", target: `global:${ME}` }])
    const connector = connectorWith([T], { g: ["t1"] })
    await connector.init()
    connector.setCurrentGroup("g")
    // Abonnements auf den geöffneten Space, die nach dem Aufbau der Anzeige entstehen: die der Aktion.
    let counting = false
    let actionSubs = 0
    const observe = connector.observeCurrentGroup.bind(connector)
    connector.observeCurrentGroup = () => {
      const source = observe()
      return new Proxy(source, {
        get(target, prop, receiver) {
          if (prop !== "subscribe") return Reflect.get(target, prop, receiver)
          return (cb: (g: unknown) => void) => {
            const stop = target.subscribe(cb as never)
            if (!counting) return stop
            actionSubs += 1
            let open = true
            return () => {
              if (open) actionSubs -= 1
              open = false
              stop()
            }
          }
        },
      })
    }
    const Actions = resolveTypePresentation("task").actions!
    await act(async () => root.render(createElement(StrictMode, null, createElement(ConnectorProvider, { connector: connector as never }, createElement(Actions, { item: T })))))
    await settle()
    counting = true
    // Das Frisch-Lesen der Aktion hängt.
    connector.getItem = (() => new Promise(() => undefined)) as never
    const update = vi.spyOn(connector, "updateItem")
    const done = () => [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Erledigt")!
    await act(async () => done().click())
    expect(done().disabled).toBe(true)
    expect(actionSubs).toBe(1)
    await act(async () => connector.setCurrentGroup("h"))
    // Beschäftigt endet sofort, obwohl das Lesen nie zurückkommt; das Abonnement ist weg.
    expect(done().disabled).toBe(false)
    expect(actionSubs).toBe(0)
    // Noch einmal, dann die Anzeige abbauen: das Abonnement überlebt bis zum Ende der Aktion, nicht länger.
    await act(async () => connector.setCurrentGroup("g"))
    await act(async () => done().click())
    expect(actionSubs).toBe(1)
    await act(async () => root.render(createElement("div")))
    expect(actionSubs).toBe(1)
    await act(async () => connector.setCurrentGroup("h"))
    expect(actionSubs).toBe(0)
    expect(update).not.toHaveBeenCalled()
  })
})

describe("Hintergrundarbeit: kein Kreislauf über den Formularzustand", () => {
  it("die Tag-Suche läuft einmal je Eingabe; ihr Warte-Zustand liegt im Formular, nicht im Widget", async () => {
    const suggestions = vi.fn(async (q: string) => [`${q}-1`, `${q}-2`])
    const TAGS: ContentTypeConfig = { id: "notiz", label: "Notiz", defaultWidgets: ["title", "tags"] }
    await composer([TAGS], { tagSuggestions: suggestions, initialData: { title: "T", tags: ["alt"] } })
    const input = [...host.querySelectorAll<HTMLInputElement>("input")].at(-1)!
    await act(async () => input.focus())
    await tippe(input, "gar")
    await settle()
    expect(suggestions).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain("gar-1")
  })
})
