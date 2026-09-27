// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import {
  composeTypeManifest,
  createObservable,
  TOOLKIT_TYPE_LAYER,
  type Item,
  type TypeManifestEntry,
  type User,
} from "@real-life-stack/data-interface"

import { ConnectorProvider } from "../src/hooks/connector-context"
import {
  registerTypePresentation,
  renderTypeFooter,
  resetTypePresentationForTests,
  resolveTypePresentation,
  setTypeManifest,
} from "../src/components/preview/type-presentation"
import { contentTypeFromRegister } from "../src/components/composer/content-types"
import { metaRowOrder, type EdgeEntry, type FieldEntry } from "../src/components/preview/field-register"
import { RegisterMeta } from "../src/components/preview/register-meta"
import { renderTypeCardFooter } from "../src/components/preview/type-presentation"
import { getTypeManifest } from "@real-life-stack/data-interface"
import { ContentComposer } from "../src/components/composer/content-composer"

/**
 * Spec 06 → Feld- und Kantenregister (S1): Das Darstellungs-Register kennt je
 * Typ eine Feld- und eine Kantenliste. Meta-Box, Composer-Defaults und die
 * Reihenfolge im Formular leiten sich daraus ab.
 */

const SICHTUNG: TypeManifestEntry = {
  id: "sighting",
  vocabularies: [],
  relations: [
    { predicate: "spottedBy", itemRole: "from", otherKind: "person" },
    { predicate: "confirms", itemRole: "to", otherKind: "person" },
    { predicate: "seenAt", itemRole: "to", otherKind: "sighting" },
  ],
}
const APP_MANIFEST = composeTypeManifest([TOOLKIT_TYPE_LAYER, { name: "app", definitions: [SICHTUNG] }])

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => resetTypePresentationForTests())

const f = (key: string, widget: FieldEntry["widget"], pos: FieldEntry["pos"], extra: Partial<FieldEntry> = {}): FieldEntry => ({
  key,
  widget,
  pos,
  ...extra,
})

function registriere(fields: FieldEntry[] = [], edges: EdgeEntry[] = []) {
  setTypeManifest(APP_MANIFEST)
  registerTypePresentation("app", [{ id: "sighting", label: "Sichtung", fields, edges }])
}

describe("Registrieren: Prüfungen nach Spec 06", () => {
  it("Regel 1: eine Kante ohne Manifest-Kante (predicate + itemRole) wird abgelehnt", () => {
    expect(() =>
      registriere([], [{ predicate: "spottedBy", itemRole: "to", storage: "embedded", widget: "people", pos: "meta", label: "Gesehen von" }]),
    ).toThrow(/spottedBy/)
    expect(() =>
      registriere([], [{ predicate: "spottedBy", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "Gesehen von" }]),
    ).not.toThrow()
  })

  it("Regel 8: eine Record-Kante mit Qualifier braucht count", () => {
    const kante: EdgeEntry = {
      predicate: "confirms",
      itemRole: "to",
      storage: "record",
      widget: "people",
      pos: "meta",
      label: "Bestätigt",
      qualifier: { key: "role", values: [{ id: "sure", label: "sicher" }] },
    }
    expect(() => registriere([], [kante])).toThrow(/count/)
    expect(() => registriere([], [{ ...kante, count: "one-per-subject" }])).not.toThrow()
  })

  it("count gibt es nur an Record-Kanten", () => {
    expect(() =>
      registriere([], [{ predicate: "spottedBy", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "x", count: "one-per-subject" }]),
    ).toThrow(/count/)
  })

  it("Regel 10: eine Rückwärts-Liste (pos list) braucht itemRole to", () => {
    expect(() =>
      registriere([], [{ predicate: "spottedBy", itemRole: "from", storage: "embedded", widget: "item-relation", pos: "list", label: "x" }]),
    ).toThrow(/list/)
  })

  it("Regel 11: item-ref braucht ref, und nur item-ref trägt ref", () => {
    expect(() => registriere([f("variantOf", "item-ref", "meta")])).toThrow(/ref/)
    expect(() => registriere([f("title", "title", "head", { ref: { type: "sighting", missing: "fehlt" } })])).toThrow(/ref/)
    expect(() => registriere([f("variantOf", "item-ref", "meta", { ref: { type: "sighting", missing: "fehlt" } })])).not.toThrow()
  })

  it("Feld-Keys und Kanten-Schlüssel sind je Typ eindeutig", () => {
    expect(() => registriere([f("title", "title", "head"), f("title", "text", "content")])).toThrow(/title/)
    const kante: EdgeEntry = { predicate: "spottedBy", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "x" }
    expect(() => registriere([], [kante, { ...kante, label: "y" }])).toThrow(/spottedBy/)
  })

  it("Regel 2 und 16: composerWidgets und relationWidgets gibt es nur ohne Feld- und Kantenliste", () => {
    setTypeManifest(APP_MANIFEST)
    expect(() =>
      registerTypePresentation("app", [
        { id: "sighting", label: "Sichtung", fields: [f("title", "title", "head")], composerWidgets: ["title"] },
      ]),
    ).toThrow(/composerWidgets/)
    expect(() =>
      registerTypePresentation("app", [
        {
          id: "sighting",
          label: "Sichtung",
          edges: [{ predicate: "spottedBy", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "x" }],
          relationWidgets: { "spottedBy from": "people" },
        },
      ]),
    ).toThrow(/relationWidgets/)
  })

  it("prüft Kanten auch beim Neubinden des Manifests", () => {
    registriere([], [{ predicate: "spottedBy", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "x" }])
    const ohneKante = composeTypeManifest([
      TOOLKIT_TYPE_LAYER,
      { name: "app", definitions: [{ ...SICHTUNG, relations: [] }] },
    ])
    expect(() => setTypeManifest(ohneKante)).toThrow(/spottedBy/)
  })

  it("Erweiterung und Merge: Fragmente vereinigen Felder nach key, ein vorhandener key ist ein Konflikt", () => {
    registriere([f("title", "title", "head")])
    registerTypePresentation("space-x", { extensions: [{ id: "sighting", fields: [f("start", "date", "meta")] }] })
    expect(resolveTypePresentation("sighting").fields?.map((x) => x.key)).toEqual(["title", "start"])
    expect(() =>
      registerTypePresentation("space-y", { extensions: [{ id: "sighting", fields: [f("title", "text", "content")] }] }),
    ).toThrow(/title/)
  })
})

describe("Meta-Box-Reihenfolge (shared-components, Detail-Anatomie, Regel 3)", () => {
  it("ordnet Menschen → Zeit → Ort → Item-Kanten → Werte, innerhalb einer Gruppe nach Register", () => {
    const fields: FieldEntry[] = [
      f("status", "status", "meta"),
      f("address", "location", "meta"),
      f("title", "title", "head"),
      f("start", "date", "meta"),
      f("order", "number", "module"),
    ]
    const edges: EdgeEntry[] = [
      { predicate: "seenAt", itemRole: "to", storage: "embedded", widget: "item-relation", pos: "meta", label: "Gesehen bei" },
      { predicate: "spottedBy", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "Gesehen von" },
    ]
    expect(metaRowOrder(fields, edges).map((r) => (r.kind === "field" ? r.entry.key : r.entry.predicate))).toEqual([
      "spottedBy",
      "start",
      "address",
      "seenAt",
      "status",
    ])
  })
})

describe("ContentTypeConfig aus dem Register (Spec 06, Regel 16)", () => {
  setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER]))

  it("event: defaultWidgets in der Reihenfolge Kopf → Meta-Box → Inhalt → Tags → Badge", () => {
    const event = contentTypeFromRegister("event")
    expect(event.defaultWidgets).toEqual(["title", "people", "date", "location", "text", "tags", "group"])
    expect(event.peopleRelations).toEqual([{ predicate: "invited", label: "Eingeladen" }])
  })

  it("task: Status-Optionen und Beschriftungen aus den Feldeinträgen", () => {
    const task = contentTypeFromRegister("task")
    expect(task.defaultWidgets).toEqual(["title", "people", "date", "status", "text", "tags"])
    expect(task.statusOptions?.map((o) => o.id)).toEqual(["open", "in-progress", "done"])
    expect(task.widgetLabels).toMatchObject({ text: "Beschreibung", date: "Fällig" })
    expect(task.peopleRelations).toEqual([{ predicate: "assignedTo", label: "Zugewiesen" }])
    expect(task.defaultStatus).toBe("open")
    expect(task.groupRequired).toBe(true)
  })

  it("Regel 5: das Body-Feld ist ein Feldeintrag — post schreibt content, die anderen description", () => {
    expect(contentTypeFromRegister("post").textField).toBe("content")
    expect(contentTypeFromRegister("post").defaultWidgets).toEqual(["text", "media", "tags"])
    expect(contentTypeFromRegister("task").textField).toBe("description")
  })

  it("Regel 4: module- und system-Felder und edit: false erscheinen nie im Formular", () => {
    setTypeManifest(APP_MANIFEST)
    registerTypePresentation("app", [
      {
        id: "sighting",
        label: "Sichtung",
        fields: [
          f("title", "title", "head"),
          f("order", "number", "module"),
          f("did", "text", "system"),
          f("count", "number", "meta", { edit: false }),
          f("variantOf", "item-ref", "meta", { edit: "fixed", ref: { type: "sighting", missing: "fehlt" } }),
        ],
      },
    ])
    expect(contentTypeFromRegister("sighting").defaultWidgets).toEqual(["title", "item-ref"])
  })

  it("Übergang: ein Typ ohne Feldliste behält composerWidgets und relationWidgets", () => {
    setTypeManifest(APP_MANIFEST)
    registerTypePresentation("app", [
      { id: "sighting", label: "Sichtung", composerWidgets: ["title", "people"], relationWidgets: { "spottedBy from": "people" } },
    ])
    const t = contentTypeFromRegister("sighting")
    expect(t.defaultWidgets).toEqual(["title", "people"])
    expect(t.peopleRelation).toEqual({ predicate: "spottedBy" })
  })
})

describe("Composer: Reihenfolge folgt defaultWidgets statt einer festen Liste", () => {
  it("rendert die Widgets in der Reihenfolge des Registers", () => {
    const html = renderToStaticMarkup(
      <ContentComposer
        contentTypes={[
          {
            id: "t",
            label: "T",
            defaultWidgets: ["title", "tags", "people", "status"],
            statusOptions: [{ id: "open", label: "OFFEN-STATUS" }],
            widgetLabels: { people: "WER-FELD", tags: "TAG-FELD" },
          },
        ]}
        mode="t"
        onSubmit={() => {}}
      />,
    )
    const pos = (s: string) => html.indexOf(s)
    for (const s of ["TAG-FELD", "WER-FELD", "OFFEN-STATUS"]) expect(pos(s), s).toBeGreaterThan(-1)
    // Früher fest: status vor title vor people vor tags.
    expect(pos("TAG-FELD")).toBeLessThan(pos("WER-FELD"))
    expect(pos("WER-FELD")).toBeLessThan(pos("OFFEN-STATUS"))
  })
})

// ---------------------------------------------------------------------------
// Meta-Box aus dem Register

const users: User[] = [
  { id: "u1", displayName: "Ich" },
  { id: "u2", displayName: "Kollegin" },
]
const connector = {
  observeMembers: () => createObservable(users),
  observeCurrentUser: () => createObservable<User | null>(users[0]!),
  getAuthState: () => createObservable({ status: "authenticated", user: users[0] }),
  authenticate: async () => {},
  getCurrentUser: async () => users[0],
  getGroups: async () => [],
  observeGroups: () => createObservable([]),
  getMembers: async () => users,
  getCurrentGroup: () => null,
  observeCurrentGroup: () => createObservable(null),
  setCurrentGroup: () => {},
  createGroup: async () => {
    throw new Error("unused")
  },
  updateGroup: async () => {
    throw new Error("unused")
  },
  deleteGroup: async () => {},
  inviteMember: async () => {},
  removeMember: async () => {},
}

const item = (type: string, data: Record<string, unknown> = {}, relations: Item["relations"] = []): Item =>
  ({ id: `i-${type}`, type, createdAt: "2026-08-04T10:00:00.000Z", createdBy: "u1", data, relations }) as Item

async function rendere(node: ReturnType<typeof createElement>) {
  const container = document.createElement("div")
  const root = createRoot(container)
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never, children: node }))
  })
  return { container, unmount: () => act(async () => root.unmount()) }
}

describe("Meta-Box aus dem Register", () => {
  it("event: Menschen, dann Datum, dann Ort — je eine Zeile", async () => {
    const event = item("event", { title: "E", start: "2026-07-19T16:00:00+02:00", address: "Markthalle 7" }, [
      { predicate: "invited", target: "global:u2" },
    ])
    const Detail = resolveTypePresentation("event").detail
    const { container, unmount } = await rendere(createElement(Detail, { item: event }))
    const rows = [...container.querySelectorAll("[data-meta-row]")].map((el) => el.getAttribute("data-meta-row"))
    expect(rows).toEqual(["invited", "start", "address"])
    expect(container.textContent).toContain("Kollegin")
    expect(container.textContent).toContain("Markthalle 7")
    await unmount()
  })

  it("Regel 2: leere Felder erzeugen keine Zeile; ohne Inhalt rendert die Box nichts", async () => {
    const leer = item("event", { title: "E" })
    const Detail = resolveTypePresentation("event").detail
    const { container, unmount } = await rendere(createElement(Detail, { item: leer }))
    expect(container.innerHTML).toBe("")
    await unmount()
  })

  it("task: die Zugewiesenen stehen in der Meta-Box, eine Typ-Fußzeile gibt es nicht mehr", async () => {
    const task = item("task", { title: "T", status: "open" }, [{ predicate: "assignedTo", target: "global:u2" }])
    expect(renderTypeFooter(task)).toBeNull()
    const Detail = resolveTypePresentation("task").detail
    const { container, unmount } = await rendere(createElement(Detail, { item: task }))
    expect(container.querySelector('[data-meta-row="assignedTo"]')?.textContent).toContain("Kollegin")
    await unmount()
  })

  it("RegisterMeta rendert ohne Typ-Verzweigung aus beliebigen Einträgen", async () => {
    const sichtung = item("sighting", { start: "2026-07-19", locationName: "Am Teich" }, [
      { predicate: "spottedBy", target: "global:u1" },
    ])
    const { container, unmount } = await rendere(
      createElement(RegisterMeta, {
        item: sichtung,
        fields: [f("locationName", "location", "meta"), f("start", "date", "meta")],
        edges: [{ predicate: "spottedBy", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "Gesehen von" }],
      }),
    )
    const rows = [...container.querySelectorAll("[data-meta-row]")].map((el) => el.getAttribute("data-meta-row"))
    expect(rows).toEqual(["spottedBy", "start", "locationName"])
    expect(container.textContent).toContain("Am Teich")
    await unmount()
  })

  it("Übergang (Regel 17): ein Typ mit eigenem detail/footer behält beide (Resonanz)", () => {
    const statement = resolveTypePresentation("statement")
    expect(statement.footer).toBeDefined()
    expect(statement.detail.name).toBe("StatementDetail")
  })
})

describe("Codex Runde 1: keine Verluste gegenüber vorher", () => {
  it("Widget-Paare: ein zugeschaltetes Datum oder ein Ort erscheint im Detail, auch wenn der Typ es nicht deklariert", async () => {
    const post = item("post", { content: "x", start: "2026-07-19T16:00:00+02:00", address: "Markthalle 7" })
    const Detail = resolveTypePresentation("post").detail
    const { container, unmount } = await rendere(createElement(Detail, { item: post }))
    const rows = [...container.querySelectorAll("[data-meta-row]")].map((el) => el.getAttribute("data-meta-row"))
    expect(rows).toEqual(["start", "address"])
    await unmount()
    // Die Composer-Defaults bleiben, wie der Typ sie deklariert.
    expect(contentTypeFromRegister("post").defaultWidgets).toEqual(["text", "media", "tags"])
  })

  it("task mit Ort: die Adresse bleibt sichtbar", async () => {
    const task = item("task", { title: "T", address: "Gartenstraße 3" })
    const Detail = resolveTypePresentation("task").detail
    const { container, unmount } = await rendere(createElement(Detail, { item: task }))
    expect(container.querySelector('[data-meta-row="address"]')?.textContent).toContain("Gartenstraße 3")
    await unmount()
  })

  it("Karte: die Personen-Kanten erscheinen als Avatar-Stapel (Regel 9), eine explizite Fußzeile gewinnt", async () => {
    const task = item("task", { title: "T" }, [{ predicate: "assignedTo", target: "global:u2" }])
    const { container, unmount } = await rendere(createElement("div", null, renderTypeCardFooter(task)))
    expect(container.textContent).toContain("Kollegin")
    await unmount()
    expect(renderTypeCardFooter(item("post"))).toBeNull()
  })

  it("ein abgelehntes Neubinden lässt beide Manifest-Bindungen unverändert", () => {
    registriere([], [{ predicate: "spottedBy", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "x" }])
    const vorher = getTypeManifest()
    const ohneKante = composeTypeManifest([TOOLKIT_TYPE_LAYER, { name: "app", definitions: [{ ...SICHTUNG, relations: [] }] }])
    expect(() => setTypeManifest(ohneKante)).toThrow()
    expect(getTypeManifest()).toBe(vorher)
  })
})
