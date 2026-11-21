// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import {
  composeTypeManifest,
  createObservable,
  TOOLKIT_TYPE_LAYER,
  type Item,
  type TypeManifestEntry,
  type User,
} from "@real-life/data-interface"

import { ConnectorProvider } from "../src/hooks/connector-context"
import {
  registerTypePresentation,
  resetTypePresentationForTests,
  resolveTypePresentation,
  setTypeManifest,
} from "../src/components/preview/type-presentation"
import { contentTypeFromRegister } from "../src/components/composer/content-types"
import { createComposerMapping } from "../src/components/composer/composer-mapping"
import { ContentComposer, type ContentComposerSubmitData, type ContentTypeConfig } from "../src/components/composer/content-composer"
import type { FieldEntry } from "../src/components/preview/field-register"
import { RegisterMeta } from "../src/components/preview/register-meta"

/**
 * S4a — einfache Wert-Widgets (shared-components → Widget-Paare B6–B10, B12):
 * je Widget eine Lese- und eine Schreibform auf EINEM Datenvertrag, im
 * Register deklarierbar, Leerzustand = keine Zeile.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const KARTE: TypeManifestEntry = { id: "card", vocabularies: [], relations: [] }
const APP_MANIFEST = composeTypeManifest([TOOLKIT_TYPE_LAYER, { name: "app", definitions: [KARTE] }])

afterEach(() => resetTypePresentationForTests())

const f = (key: string, widget: FieldEntry["widget"], extra: Partial<FieldEntry> = {}): FieldEntry => ({ key, widget, pos: "meta", ...extra })

function registriere(fields: FieldEntry[]) {
  setTypeManifest(APP_MANIFEST)
  registerTypePresentation("app", [{ id: "card", label: "Karte", fields: [{ key: "title", widget: "title", pos: "head" }, ...fields] }])
}

const STATUS = f("status", "status", {
  label: "Stand",
  options: [
    { id: "open", label: "Offen", role: "open" },
    { id: "doing", label: "In Arbeit", role: "active" },
    { id: "done", label: "Erledigt", role: "done" },
    { id: "blocked", label: "Blockiert", tone: "danger" },
  ],
})
const KIND = f("kind", "select", {
  label: "Art",
  options: [
    { id: "tool", label: "Werkzeug" },
    { id: "room", label: "Raum" },
    { id: "know", label: "Wissen", tone: "info" },
  ],
})
const HOURS = f("hours", "number", { label: "Aufwand", unit: "h", min: 0 })
const EUROS = f("euros", "number", { label: "Aufwand", unit: "€", min: 0 })
const WEBSITE = f("website", "url", { label: "Website" })
const SKILLS = f("skills", "chips", { label: "Kann" })
const PHONE = f("phone", "contact", { label: "Kontakt" })

// ---------------------------------------------------------------------------
// Registrieren

describe("Registrieren: Wert-Felder", () => {
  it("select braucht Optionen", () => {
    expect(() => registriere([f("kind", "select")])).toThrow(/Optionen/)
    expect(() => registriere([KIND])).not.toThrow()
  })

  it("Optionen gibt es nur an status und select", () => {
    expect(() => registriere([f("website", "url", { options: [{ id: "a", label: "A" }] })])).toThrow(/Optionen/)
  })

  it("Einheit und Grenzen gibt es nur an number, min nie über max", () => {
    expect(() => registriere([f("website", "url", { unit: "h" })])).toThrow(/number/)
    expect(() => registriere([f("website", "url", { min: 0 })])).toThrow(/number/)
    expect(() => registriere([f("hours", "number", { min: 5, max: 1 })])).toThrow(/min/)
    expect(() => registriere([HOURS, EUROS])).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Lesen

const users: User[] = [{ id: "u1", displayName: "Ich" }]
const connector = {
  observe: () => createObservable<Item[]>([]),
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

const item = (data: Record<string, unknown>): Item =>
  ({ id: "c1", type: "card", createdAt: "2026-08-04T10:00:00.000Z", createdBy: "u1", data: { title: "Karte", ...data }, relations: [] }) as Item

async function rendere(node: ReactNode) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never, children: node }))
  })
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

async function meta(fields: FieldEntry[], data: Record<string, unknown>) {
  return rendere(createElement(RegisterMeta, { item: item(data), fields }))
}

const rows = (c: HTMLElement) => [...c.querySelectorAll("[data-meta-row]")].map((el) => el.getAttribute("data-meta-row"))
const row = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-meta-row="${id}"]`)

describe("Lesen: Leerzustand = keine Zeile", () => {
  it("ohne Werte rendert die Meta-Box nichts", async () => {
    const { container, unmount } = await meta([STATUS, KIND, HOURS, EUROS, WEBSITE, SKILLS, PHONE], {
      status: "",
      kind: null,
      hours: "",
      website: "  ",
      skills: [],
      phone: "",
    })
    expect(container.innerHTML).toBe("")
    await unmount()
  })
})

describe("B6 status und B8 select lesen: Chip mit Punkt im Ton (Design 27.09.)", () => {
  const chipOf = async (fields: FieldEntry[], data: Record<string, unknown>, typeTone?: string) => {
    const { container, unmount } = await rendere(createElement(RegisterMeta, { item: item(data), fields, typeTone }))
    const chip = container.querySelector<HTMLElement>("[data-value-chip]")!
    const out = { tone: chip.getAttribute("data-tone"), cls: chip.className, text: chip.textContent, dot: !!chip.querySelector("[data-tone-dot]") }
    await unmount()
    return out
  }

  it("Ton aus der Rolle: open neutral, active warning, done success", async () => {
    expect((await chipOf([STATUS], { status: "open" })).tone).toBe("neutral")
    expect((await chipOf([STATUS], { status: "doing" })).tone).toBe("warning")
    expect((await chipOf([STATUS], { status: "done" })).tone).toBe("success")
  })

  it("ein tone an der Option gewinnt; der Chip trägt Punkt und Beschriftung", async () => {
    const c = await chipOf([STATUS], { status: "blocked" })
    expect(c.tone).toBe("danger")
    expect(c.dot).toBe(true)
    expect(c.text).toBe("Blockiert")
  })

  it("ohne Rolle und ohne tone: die Typfarbe", async () => {
    const c = await chipOf([KIND], { kind: "tool" }, "TYPTON")
    expect(c.tone).toBe("type")
    expect(c.cls).toContain("TYPTON")
    expect((await chipOf([KIND], { kind: "know" })).tone).toBe("info")
  })

  it("Farbe nur über Tokens: keine Tailwind-Farbskala an Chips mit semantischem Ton", async () => {
    for (const status of ["open", "doing", "done", "blocked"]) {
      expect((await chipOf([STATUS], { status })).cls, status).not.toMatch(/-(red|rose|green|amber|blue|purple|teal|violet|emerald|sky)-\d/)
    }
  })

  it("ein unbekannter Wert erscheint als er selbst, neutral, nie verworfen", async () => {
    const c = await chipOf([STATUS], { status: "archived" })
    expect(c.text).toBe("archived")
    expect(c.tone).toBe("neutral")
  })
})

describe("Register: tone ist semantisch", () => {
  it("nimmt nur neutral, warning, success, danger, info", () => {
    expect(() => registriere([f("kind", "select", { options: [{ id: "a", label: "A", tone: "rose" }] })])).toThrow(/tone/)
    expect(() => registriere([f("kind", "select", { options: [{ id: "a", label: "A", tone: "danger" }] })])).not.toThrow()
  })
})

describe("B7 number: „12 h · 300 €“ in einer Zeile", () => {
  it("fasst Zahlenfelder mit gleicher Beschriftung zu einer Zeile zusammen", async () => {
    const { container, unmount } = await meta([HOURS, EUROS], { hours: 12, euros: 300 })
    expect(rows(container)).toEqual(["hours"])
    expect(row(container, "hours")!.textContent).toContain("Aufwand")
    expect(row(container, "hours")!.textContent).toContain("12 h · 300 €")
    await unmount()
  })

  it("zeigt nur, was einen Wert hat; 0 ist ein Wert, Unlesbares keiner", async () => {
    const a = await meta([HOURS, EUROS], { euros: 1500 })
    expect(row(a.container, "hours")!.textContent).toContain("1.500 €")
    expect(row(a.container, "hours")!.textContent).not.toContain(" h")
    await a.unmount()
    const b = await meta([HOURS], { hours: 0 })
    expect(row(b.container, "hours")!.textContent).toContain("0 h")
    await b.unmount()
    const c = await meta([HOURS], { hours: "viel" })
    expect(c.container.innerHTML).toBe("")
    await c.unmount()
  })
})

describe("B9 url: sicherer Link mit Globus", () => {
  it("verlinkt http/https mit rel noopener noreferrer, zeigt die Adresse ohne Schema", async () => {
    const { container, unmount } = await meta([WEBSITE], { website: "https://gartenprojekt.org/" })
    const a = row(container, "website")!.querySelector("a")!
    expect(a.getAttribute("href")).toBe("https://gartenprojekt.org/")
    expect(a.getAttribute("rel")).toBe("noopener noreferrer")
    expect(a.getAttribute("target")).toBe("_blank")
    expect(a.textContent).toBe("gartenprojekt.org")
    await unmount()
  })

  it("javascript: wird nie ein Link, der Wert bleibt als Text sichtbar", async () => {
    const { container, unmount } = await meta([WEBSITE], { website: "javascript:alert(1)" })
    expect(container.querySelector("a")).toBeNull()
    expect(row(container, "website")!.textContent).toContain("javascript:alert(1)")
    await unmount()
  })
})

describe("B10 chips: Chip-Reihe mit Label, gekappt", () => {
  it("zeigt die Werte als Chips hinter dem Label", async () => {
    const { container, unmount } = await meta([SKILLS], { skills: ["Gärtnern", "Kochen"] })
    const r = row(container, "skills")!
    expect(r.textContent).toContain("Kann")
    expect([...r.querySelectorAll("[data-value-chip]")].map((c) => c.textContent)).toEqual(["Gärtnern", "Kochen"])
    await unmount()
  })

  it("kappt mit „+N“, ein Klick zeigt alle", async () => {
    const { container, unmount } = await meta([SKILLS], { skills: ["a", "b", "c", "d", "e"] })
    const more = container.querySelector<HTMLButtonElement>("[data-more]")!
    expect(more.textContent).toBe("+2")
    await act(async () => more.click())
    expect(container.querySelectorAll("[data-meta-row] [data-value-chip]")).toHaveLength(5)
    await unmount()
  })
})

describe("B12 contact: Sprung tel: oder mailto:", () => {
  it("Telefon: „Anrufen“ mit tel:", async () => {
    const { container, unmount } = await meta([PHONE], { phone: "+49 170 1234567" })
    const a = row(container, "phone")!.querySelector("a")!
    expect(a.getAttribute("href")).toBe("tel:+491701234567")
    expect(a.textContent).toBe("Anrufen")
    expect(row(container, "phone")!.textContent).toContain("+49 170 1234567")
    await unmount()
  })

  it("E-Mail: „E-Mail schreiben“ mit mailto:; Unerkanntes bleibt Text ohne Sprung", async () => {
    const a = await meta([PHONE], { phone: "lena@example.org" })
    expect(a.container.querySelector("a")!.getAttribute("href")).toBe("mailto:lena@example.org")
    await a.unmount()
    const b = await meta([PHONE], { phone: "abends im Garten" })
    expect(b.container.querySelector("a")).toBeNull()
    expect(b.container.textContent).toContain("abends im Garten")
    await b.unmount()
  })
})

describe("Reihenfolge: Werte in Register-Reihenfolge, nach Zeit und Ort", () => {
  it("date → location → Werte", async () => {
    const { container, unmount } = await meta([WEBSITE, STATUS, f("start", "date"), f("address", "location")], {
      website: "gartenprojekt.org",
      status: "open",
      start: "2026-07-19T16:00:00+02:00",
      address: "Markthalle 7",
    })
    expect(rows(container)).toEqual(["start", "address", "website", "status"])
    await unmount()
  })
})

// ---------------------------------------------------------------------------
// Aus dem Register in den Composer

describe("Composer aus dem Register", () => {
  it("leitet Wert-Felder mit Beschriftung, Einheit, Grenzen und Optionen ab", () => {
    registriere([KIND, HOURS, EUROS, WEBSITE, SKILLS, PHONE])
    const config = contentTypeFromRegister("card")
    expect(config.defaultWidgets).toEqual(["title", "select", "number", "url", "chips", "contact"])
    expect(config.valueFields?.map((v) => v.key)).toEqual(["kind", "hours", "euros", "website", "skills", "phone"])
    expect(config.valueFields?.find((v) => v.key === "hours")).toMatchObject({ widget: "number", label: "Aufwand", unit: "h", min: 0 })
    expect(config.valueFields?.find((v) => v.key === "kind")?.options?.map((o) => o.id)).toEqual(["tool", "room", "know"])
  })

  it("event: meetingLink ist ein url-Feld der Meta-Box (Spec 06, Register je Typ)", () => {
    const event = resolveTypePresentation("event")
    expect(event.fields?.find((x) => x.key === "meetingLink")).toMatchObject({ widget: "url", pos: "meta" })
    const config = contentTypeFromRegister("event")
    expect(config.defaultWidgets).toEqual(["title", "text", "people", "date", "location", "url", "tags", "group"])
    expect(config.valueFields?.map((v) => v.key)).toEqual(["meetingLink"])
  })
})

// ---------------------------------------------------------------------------
// Schreiben

const karte = (valueFields: ContentTypeConfig["valueFields"], extra: Partial<ContentTypeConfig> = {}): ContentTypeConfig => ({
  id: "card",
  label: "Karte",
  defaultWidgets: ["title", ...new Set((valueFields ?? []).map((v) => v.widget))],
  valueFields,
  ...extra,
})

function setze(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value)
  input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }))
}

async function formular(config: ContentTypeConfig, initialData: Record<string, unknown> = {}) {
  const submits: ContentComposerSubmitData[] = []
  const r = await rendere(
    createElement(ContentComposer, {
      contentTypes: [config],
      mode: config.id,
      initialData: { title: "Karte", ...initialData },
      showPreview: false,
      onSubmit: (s: ContentComposerSubmitData) => {
        submits.push(s)
      },
    }),
  )
  const speichern = () => [...r.container.querySelectorAll("button")].find((b) => b.textContent === "Erstellen")!
  return { ...r, submits, speichern }
}

const OPTS3 = [
  { id: "tool", label: "Werkzeug" },
  { id: "room", label: "Raum" },
  { id: "know", label: "Wissen", tone: "info" },
]

describe("B8 select schreiben: Segment bis 4 Optionen, sonst Dropdown", () => {
  it("bis 4: Radiogruppe, ein Klick wählt, ein zweiter nimmt zurück", async () => {
    const { container, unmount, submits, speichern } = await formular(karte([{ key: "kind", widget: "select", label: "Art", options: OPTS3 }]))
    const group = container.querySelector('[role="radiogroup"]')!
    expect(group.getAttribute("aria-label")).toBe("Art")
    const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    expect(radios.map((r) => r.textContent)).toEqual(["Werkzeug", "Raum", "Wissen"])
    await act(async () => radios[1]!.click())
    expect(radios[1]!.getAttribute("aria-checked")).toBe("true")
    await act(async () => speichern().click())
    expect(submits.at(-1)!.data.kind).toBe("room")
    await act(async () => radios[1]!.click())
    expect(radios[1]!.getAttribute("aria-checked")).toBe("false")
    await unmount()
  })

  it("mehr als 4: Dropdown mit leerer Wahl", async () => {
    const opts = ["a", "b", "c", "d", "e"].map((id) => ({ id, label: id.toUpperCase() }))
    const { container, unmount, submits, speichern } = await formular(karte([{ key: "kind", widget: "select", label: "Art", options: opts }]))
    expect(container.querySelector('[role="radiogroup"]')).toBeNull()
    const select = container.querySelector<HTMLSelectElement>("select")!
    expect(select.getAttribute("aria-label")).toBe("Art")
    expect([...select.options].map((o) => o.value)).toEqual(["", "a", "b", "c", "d", "e"])
    await act(async () => setze(select, "d"))
    await act(async () => speichern().click())
    expect(submits.at(-1)!.data.kind).toBe("d")
    await unmount()
  })
})

describe("B6 status schreiben: Segment", () => {
  it("die Aufgabe zeigt ihre drei Status als Radiogruppe mit dem aktuellen gewählt", async () => {
    const task = contentTypeFromRegister("task")
    const { container, unmount } = await formular(task, { status: "in-progress" })
    const group = container.querySelector('[role="radiogroup"][aria-label="Status"]')!
    const radios = [...group.querySelectorAll('[role="radio"]')]
    expect(radios.map((r) => r.textContent)).toEqual(["To Do", "In Arbeit", "Erledigt"])
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"])
    await unmount()
  })
})

describe("B7 number schreiben: ein Zahlenfeld je Wert, nebeneinander", () => {
  const fields: ContentTypeConfig["valueFields"] = [
    { key: "hours", widget: "number", label: "Aufwand", unit: "h", min: 0 },
    { key: "euros", widget: "number", label: "Aufwand", unit: "€", min: 0 },
  ]

  it("eine Gruppe mit Beschriftung, je Wert ein Feld mit Einheit", async () => {
    const { container, unmount } = await formular(karte(fields), { hours: "12" })
    const group = container.querySelector('[data-value-field="number"]')!
    expect(group.textContent).toContain("Aufwand")
    const inputs = [...group.querySelectorAll("input")]
    expect(inputs.map((i) => i.getAttribute("aria-label"))).toEqual(["Aufwand (h)", "Aufwand (€)"])
    expect(inputs[0]!.value).toBe("12")
    expect(container.querySelectorAll('[data-value-field="number"]')).toHaveLength(1)
    await unmount()
  })

  it("unter min: Fehler am Feld, Speichern gesperrt", async () => {
    const { container, unmount, speichern } = await formular(karte(fields))
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Aufwand (h)"]')!
    await act(async () => setze(input, "-3"))
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(container.textContent).toContain("Mindestens 0")
    expect(speichern().disabled).toBe(true)
    await act(async () => setze(input, "3"))
    expect(speichern().disabled).toBe(false)
    await unmount()
  })
})

describe("B9 url schreiben: Textfeld mit Prüfung", () => {
  it("lehnt javascript: ab und sperrt Speichern; eine bloße Domain ist gültig", async () => {
    const { container, unmount, speichern } = await formular(karte([{ key: "website", widget: "url", label: "Website" }]))
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Website"]')!
    await act(async () => setze(input, "javascript:alert(1)"))
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(speichern().disabled).toBe(true)
    await act(async () => setze(input, "gartenprojekt.org"))
    expect(input.getAttribute("aria-invalid")).toBe("false")
    expect(speichern().disabled).toBe(false)
    await unmount()
  })
})

describe("B12 contact schreiben: Textfeld mit Sichtbarkeits-Hinweis", () => {
  it("nennt, wer den Kontakt sieht: die Mitglieder des Formular-Space", async () => {
    const { container, unmount } = await formular(
      karte([{ key: "phone", widget: "contact", label: "Kontakt" }], {
        groupOptions: [{ id: "g1", name: "Gartenprojekt" }],
        defaultGroup: "g1",
      }),
    )
    expect(container.querySelector('[data-value-field="contact"]')!.textContent).toContain("Sichtbar für alle in Gartenprojekt")
    await unmount()
  })

  it("prüft Telefon oder E-Mail", async () => {
    const { container, unmount, speichern } = await formular(karte([{ key: "phone", widget: "contact", label: "Kontakt" }]))
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Kontakt"]')!
    await act(async () => setze(input, "bald"))
    expect(speichern().disabled).toBe(true)
    await act(async () => setze(input, "+49 170 1234567"))
    expect(speichern().disabled).toBe(false)
    await unmount()
  })
})

describe("B10 chips schreiben: Chips, Vorschläge und „+ eigenes“", () => {
  it("fügt einen Vorschlag und ein eigenes hinzu, entfernt per ×", async () => {
    const { container, unmount, submits, speichern } = await formular(
      karte([{ key: "skills", widget: "chips", label: "Kann", suggestions: ["Gärtnern", "Kochen"] }]),
    )
    const feld = container.querySelector('[data-value-field="chips"]')!
    const vorschlag = [...feld.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "+ Kochen")!
    await act(async () => vorschlag.click())
    const eigenes = [...feld.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "+ eigenes")!
    await act(async () => eigenes.click())
    const input = feld.querySelector<HTMLInputElement>("input")!
    await act(async () => setze(input, "Anhänger fahren"))
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    await act(async () => speichern().click())
    expect(submits.at(-1)!.data.skills).toEqual(["Kochen", "Anhänger fahren"])
    const entfernen = feld.querySelector<HTMLButtonElement>('button[aria-label="Kochen entfernen"]')!
    await act(async () => entfernen.click())
    await act(async () => speichern().click())
    expect(submits.at(-1)!.data.skills).toEqual(["Anhänger fahren"])
    await unmount()
  })
})

// ---------------------------------------------------------------------------
// Abbildung Composer ↔ Item

describe("Abbildung: ein Datenvertrag für Lesen und Schreiben", () => {
  const typ = karte([
    { key: "hours", widget: "number", label: "Aufwand", unit: "h" },
    { key: "website", widget: "url", label: "Website" },
    { key: "skills", widget: "chips", label: "Kann" },
    { key: "phone", widget: "contact", label: "Kontakt" },
    { key: "kind", widget: "select", label: "Art", options: OPTS3 },
  ])
  const { mapSubmission, editInitialData } = createComposerMapping([typ])
  const alt: Item = {
    id: "c1",
    type: "card",
    createdAt: "2026-09-27T10:00:00.000Z",
    createdBy: "u1",
    data: { title: "Karte", hours: 12, website: "https://gartenprojekt.org/", skills: ["Kochen"], phone: "+49 170 1", kind: "tool", other: 1 },
  }

  it("Anlegen: Zahlen als Zahl, Adressen mit Schema, Chips bereinigt, Leeres weg", () => {
    const payload = mapSubmission(
      {
        contentType: "card",
        isPublic: true,
        data: { title: "Neu", hours: "1,5", website: "gartenprojekt.org", skills: [" Kochen ", "Kochen", ""], phone: " ", kind: "" },
      },
      { mode: "create", existingItem: null },
    )
    expect(payload?.data).toEqual({ title: "Neu", hours: 1.5, website: "https://gartenprojekt.org/", skills: ["Kochen"] })
  })

  it("Bearbeiten: füllt das Formular vor und entfernt, was geleert wurde", () => {
    const initial = editInitialData(alt)
    expect(initial).toMatchObject({ hours: "12", website: "https://gartenprojekt.org/", skills: ["Kochen"], phone: "+49 170 1", kind: "tool" })
    const payload = mapSubmission(
      { contentType: "card", isPublic: true, data: { ...initial, hours: "", website: "", skills: [], phone: "", kind: "" } },
      { mode: "edit", existingItem: alt },
    )
    expect(payload?.data).toEqual({ title: "Karte", other: 1 })
  })
})

// ---------------------------------------------------------------------------
// Codex Runde 1

describe("Codex R1", () => {
  it("1: ein fest vorgegebener Wert wird beim Anlegen gespeichert, beim Bearbeiten nie geändert", () => {
    const typ = karte([{ key: "hours", widget: "number", label: "Aufwand", unit: "h", fixed: true }])
    const { mapSubmission } = createComposerMapping([typ])
    const neu = mapSubmission({ contentType: "card", isPublic: true, data: { title: "N", hours: "12" } }, { mode: "create", existingItem: null })
    expect(neu?.data).toEqual({ title: "N", hours: 12 })
    const alt = { id: "c", type: "card", createdAt: "x", createdBy: "u", data: { title: "N", hours: 3 } } as Item
    const edit = mapSubmission({ contentType: "card", isPublic: true, data: { title: "N", hours: "99" } }, { mode: "edit", existingItem: alt })
    expect(edit?.data).toEqual({ title: "N", hours: 3 })
  })

  it("2: nach einem Typwechsel speichert das Formular keine Wert-Felder des anderen Typs", async () => {
    const mitLink = karte([{ key: "website", widget: "url", label: "Website" }])
    const ohne: ContentTypeConfig = { id: "note", label: "Notiz", defaultWidgets: ["title"] }
    const submits: ContentComposerSubmitData[] = []
    const r = await rendere(
      createElement(ContentComposer, {
        contentTypes: [mitLink, ohne],
        initialContentType: "card",
        initialData: { title: "T", website: "javascript:alert(1)" },
        showPreview: false,
        onSubmit: (s: ContentComposerSubmitData) => {
          submits.push(s)
        },
      }),
    )
    // Typ wechseln über den Kopf (wie erstellen-typwechsel-und-erneut.test.tsx).
    const trigger = r.container.querySelector<HTMLElement>('button[aria-label^="Typ wählen"]')!
    await act(async () => {
      trigger.focus()
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    const notiz = [...document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((el) => el.textContent?.includes("Notiz"))!
    await act(async () => notiz.click())
    const speichern = [...r.container.querySelectorAll("button")].find((b) => b.textContent === "Erstellen")!
    await act(async () => speichern.click())
    expect(submits.at(-1)?.contentType).toBe("note")
    expect(submits.at(-1)?.data).not.toHaveProperty("website")
    await r.unmount()
  })

  it("3: mailto nur für eine schlichte Adresse, ohne Prozent-Escapes und Steuerzeichen", async () => {
    const { contactHref } = await import("../src/lib/field-values")
    expect(contactHref("a%0d%0aBcc%3aevil@example.org")).toBeNull()
    expect(contactHref("a\u0000b@example.org")).toBeNull()
    expect(contactHref("lena.k+garten@example.org")).toBe("mailto:lena.k+garten@example.org")
  })

  it("4: in einer gemischten Zahlengruppe ist nur das feste Feld gesperrt", async () => {
    const { container, unmount } = await formular(
      karte([
        { key: "hours", widget: "number", label: "Aufwand", unit: "h", fixed: true },
        { key: "euros", widget: "number", label: "Aufwand", unit: "€" },
      ]),
      { hours: "3" },
    )
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Aufwand (h)"]')!.disabled).toBe(true)
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Aufwand (€)"]')!.disabled).toBe(false)
    await unmount()
  })

  it("5: Wert-Felder stehen im Formular in Register-Reihenfolge, nur benachbarte Zahlen bilden eine Gruppe", async () => {
    const { container, unmount } = await formular(
      karte([
        { key: "hours", widget: "number", label: "Aufwand", unit: "h" },
        { key: "website", widget: "url", label: "Website" },
        { key: "euros", widget: "number", label: "Aufwand", unit: "€" },
      ]),
    )
    const order = [...container.querySelectorAll("[data-value-field]")].map((e) => e.getAttribute("data-value-field"))
    expect(order).toEqual(["number", "url", "number"])
    await unmount()
  })

  it("6: ein Pflichtwert (Status) bietet auch als Liste keine leere Wahl an", async () => {
    const { StatusWidget } = await import("../src/components/composer/widgets/status-widget")
    const opts = ["a", "b", "c", "d", "e"].map((id) => ({ id, label: id }))
    const r = await rendere(createElement(StatusWidget, { value: "a", onChange: () => {}, label: "Status", options: opts }))
    expect([...r.container.querySelector("select")!.options].map((o) => o.value)).toEqual(["a", "b", "c", "d", "e"])
    await r.unmount()
  })

  it("7: nach „+ eigenes“ kehrt der Fokus zum Knopf zurück (Enter und Escape)", async () => {
    const { container, unmount } = await formular(karte([{ key: "skills", widget: "chips", label: "Kann" }]))
    const feld = container.querySelector('[data-value-field="chips"]')!
    const knopf = () => [...feld.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "+ eigenes")!
    await act(async () => knopf().click())
    const input = feld.querySelector<HTMLInputElement>("input")!
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
    expect(document.activeElement).toBe(knopf())
    await unmount()
  })
})

describe("Codex R2", () => {
  it("1: der Status steht im Formular an seiner Register-Stelle zwischen Zahlen", async () => {
    registriere([HOURS, STATUS, EUROS])
    const config = contentTypeFromRegister("card")
    const { container, unmount } = await formular(config, { status: "open" })
    const order = [...container.querySelectorAll("[data-value-field]")].map((e) => e.getAttribute("data-value-field"))
    expect(order).toEqual(["number", "pills", "number"])
    await unmount()
  })

  it("2: wer die Chips-Eingabe per Klick verlässt, behält seinen Fokus", async () => {
    const { container, unmount } = await formular(
      karte([
        { key: "skills", widget: "chips", label: "Kann" },
        { key: "website", widget: "url", label: "Website" },
      ]),
    )
    const feld = container.querySelector('[data-value-field="chips"]')!
    await act(async () => [...feld.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "+ eigenes")!.click())
    const website = container.querySelector<HTMLInputElement>('input[aria-label="Website"]')!
    await act(async () => website.focus())
    expect(document.activeElement).toBe(website)
    await unmount()
  })

  it("3: ein fester, ungültiger Bestandswert sperrt das Bearbeiten nicht", async () => {
    const config = karte([{ key: "hours", widget: "number", label: "Aufwand", unit: "h", min: 0, fixed: true }])
    const submits: ContentComposerSubmitData[] = []
    const r = await rendere(
      createElement(ContentComposer, {
        contentTypes: [config],
        mode: "card",
        editMode: true,
        initialData: { title: "Karte", hours: "-1" },
        showPreview: false,
        onSubmit: (s: ContentComposerSubmitData) => {
          submits.push(s)
        },
      }),
    )
    const speichern = [...r.container.querySelectorAll("button")].find((b) => b.textContent === "Speichern")!
    expect(speichern.disabled).toBe(false)
    await r.unmount()
  })
})

describe("Codex R3", () => {
  it("1: ein unberührtes Aufgabenformular ist nicht ungespeichert (der Standard-Status zählt nicht)", async () => {
    const task = contentTypeFromRegister("task")
    const dirty: boolean[] = []
    const r = await rendere(
      createElement(ContentComposer, { contentTypes: [task], mode: "task", showPreview: false, onSubmit: () => {}, onDirtyChange: (d: boolean) => dirty.push(d) }),
    )
    expect(dirty.at(-1)).toBe(false)
    await r.unmount()
  })

  it("2: ein Typ mit statusOptions behält seinen Status, auch wenn ein Register-Typ daneben angeboten wird", async () => {
    const task = contentTypeFromRegister("task")
    const alt: ContentTypeConfig = { id: "todo", label: "Todo", defaultWidgets: ["title", "status"], statusOptions: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }
    const submits: ContentComposerSubmitData[] = []
    const r = await rendere(
      createElement(ContentComposer, {
        contentTypes: [alt, task],
        initialContentType: "todo",
        initialData: { title: "T", status: "b" },
        showPreview: false,
        onSubmit: (s: ContentComposerSubmitData) => {
          submits.push(s)
        },
      }),
    )
    await act(async () => [...r.container.querySelectorAll("button")].find((b) => b.textContent === "Erstellen")!.click())
    expect(submits.at(-1)?.data.status).toBe("b")
    await r.unmount()
  })
})

describe("#544: Zahlen werden nie still gerundet", () => {
  it("Lesen: 0,001 kg erscheint als 0,001 kg", async () => {
    const { container, unmount } = await meta([f("weight", "number", { label: "Gewicht", unit: "kg" })], { weight: 0.001 })
    expect(row(container, "weight")!.textContent).toContain("0,001 kg")
    await unmount()
  })

  it("Schreiben: das Feld zeigt den gespeicherten Wert unverändert", () => {
    const typ = karte([{ key: "weight", widget: "number", label: "Gewicht", unit: "kg" }])
    const { editInitialData } = createComposerMapping([typ])
    const alt = { id: "c", type: "card", createdAt: "x", createdBy: "u", data: { title: "N", weight: 0.001 } } as Item
    expect(editInitialData(alt).weight).toBe("0.001")
  })

  it("Schreiben: das gerenderte Feld zeigt auch einen Exponentialwert unverändert", async () => {
    const typ = karte([{ key: "weight", widget: "number", label: "Gewicht", unit: "kg" }])
    const { editInitialData } = createComposerMapping([typ])
    const alt = { id: "c", type: "card", createdAt: "x", createdBy: "u", data: { title: "N", weight: 1e-21 } } as Item
    const { container, unmount } = await formular(typ, editInitialData(alt))
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Gewicht (kg)"]')!.value).toBe("1e-21")
    await unmount()
  })
})

describe("Pillen mit Punkt (Design 27.09.)", () => {
  it("jede Pille trägt einen Punkt in ihrem Ton; die gewählte ist pastell im Ton und halbfett, die anderen hell mit Rand", async () => {
    const opts = [
      { id: "high", label: "Hoch", tone: "danger" },
      { id: "mid", label: "Mittel", tone: "warning" },
      { id: "low", label: "Niedrig", tone: "info" },
    ]
    const { container, unmount } = await formular(karte([{ key: "prio", widget: "select", label: "Priorität", options: opts }]), { prio: "high" })
    expect(container.querySelector('[data-value-field="pills"]')).not.toBeNull()
    const radios = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    expect(radios.map((r) => r.querySelector("[data-tone-dot]")?.getAttribute("data-tone"))).toEqual(["danger", "warning", "info"])
    expect(radios[0]!.getAttribute("data-tone")).toBe("danger")
    expect(radios[0]!.className).toContain("font-semibold")
    expect(radios[1]!.className).toContain("border-border")
    expect(radios[1]!.className).toContain("text-muted-foreground")
    await unmount()
  })

  it("der Status der Aufgabe: Töne aus den Rollen", async () => {
    const task = contentTypeFromRegister("task")
    const { container, unmount } = await formular(task, { status: "in-progress" })
    const dots = [...container.querySelectorAll('[role="radio"] [data-tone-dot]')].map((d) => d.getAttribute("data-tone"))
    expect(dots).toEqual(["neutral", "warning", "success"])
    expect(container.querySelector('[role="radio"][aria-checked="true"]')!.getAttribute("data-tone")).toBe("warning")
    await unmount()
  })
})
