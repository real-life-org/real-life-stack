// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Item, User } from "@real-life-stack/data-interface"

import { ItemPreview } from "../src/components/preview/item-preview"

const beitrag = (over: Partial<Item> = {}): Item =>
  ({
    id: "p1",
    type: "event",
    createdAt: "2026-06-05T10:00:00.000Z",
    createdBy: "u1",
    tags: ["repair", "community"],
    data: { title: "Repair-Café", content: "Bringt eure kaputten Geräte mit." },
    relations: [],
    ...over,
  }) as Item

const autor: User = { id: "u1", displayName: "Sebastian" } as User

function markup(over: Partial<Parameters<typeof ItemPreview>[0]> = {}) {
  return renderToStaticMarkup(
    <ItemPreview
      item={beitrag()}
      author={autor}
      headerAdornment={<span>TYP-BADGE</span>}
      metaAdornment={<span>4. Juli, 16:00</span>}
      {...over}
    />,
  )
}

function vorher(html: string, a: string, b: string): boolean {
  const i = html.indexOf(a)
  const j = html.indexOf(b)
  expect(i, `nicht gefunden: ${a}`).toBeGreaterThan(-1)
  expect(j, `nicht gefunden: ${b}`).toBeGreaterThan(-1)
  return i < j
}

/**
 * Die Karte führt mit dem, WAS sie zeigt — nicht mit dem, WER es geschrieben
 * hat. Beim Überfliegen einer Liste sucht man den Gegenstand; der Urheber ist
 * die Auskunft danach. (Die Detailansicht ordnet seit #307 genauso.)
 */
describe("ItemPreview: die Ordnung der Karte", () => {
  it("beginnt mit dem Titel, nicht mit dem Autor", () => {
    const html = markup()
    expect(vorher(html, "Repair-Café", "Sebastian")).toBe(true)
  })

  it("stellt den Typ neben den Titel", () => {
    expect(vorher(markup(), "Repair-Café", "TYP-BADGE")).toBe(true)
  })

  it("ordnet Meta, Inhalt, Tags und Urheber in dieser Folge", () => {
    const html = markup()
    expect(vorher(html, "Repair-Café", "4. Juli, 16:00")).toBe(true)
    expect(vorher(html, "4. Juli, 16:00", "Bringt eure kaputten")).toBe(true)
    expect(vorher(html, "Bringt eure kaputten", "repair")).toBe(true)
    expect(vorher(html, "repair", "Sebastian")).toBe(true)
  })

  it("hält Tags und Urheber in einer Zeile, Urheber rechts", () => {
    const html = markup()
    expect(html).toContain("ml-auto")
  })
})

/**
 * Viele Tags dürfen die Karte nicht auseinanderziehen: Sie kappen mit einem
 * „+N", statt in eine zweite Zeile zu rutschen — der Urheber gewinnt, weil er
 * die verlässlichere Auskunft ist als der fünfte Tag.
 */
describe("ItemPreview: viele Tags", () => {
  const viele = beitrag({ tags: ["repair", "community", "nachbarschaft", "werkstatt", "offen"] })

  it("zeigt die ersten und fasst den Rest zusammen", () => {
    const html = markup({ item: viele })
    expect(html).toContain("repair")
    expect(html).toContain("+2")
    // Der vierte Tag steht nicht als eigener Chip in der Zeile — im Titel des
    // „+2" darf er stehen, sonst müsste man das Item öffnen, um ihn zu sehen.
    expect(html).not.toContain(">werkstatt<")
  })

  it("bricht die Tag-Zeile nicht um", () => {
    const html = markup({ item: viele })
    // Nur der Container der Tags — der Titel darf sehr wohl umbrechen. Über
    // das öffnende Tag VOR dem ersten Tag gesucht, nicht über eine
    // Zeichenzahl: Die verschiebt sich mit jeder Änderung am Markup.
    const bisTag = html.slice(0, html.indexOf(">repair<"))
    const container = bisTag.slice(bisTag.lastIndexOf("<div"))
    expect(container).not.toContain("flex-wrap")
    expect(container).toContain("overflow-hidden")
  })

  it("zeigt in der dichten Ansicht nur einen Tag", () => {
    const html = markup({ item: viele, density: "compact" })
    expect(html).toContain("repair")
    expect(html).toContain("+4")
  })

  it("kappt nicht, wenn alle Tags passen", () => {
    const html = markup()
    expect(html).toContain("community")
    expect(html).not.toMatch(/\+\d/)
  })
})

/**
 * Eine Null ist keine Auskunft. „0 Kommentare" sagt dasselbe wie nichts, kostet
 * aber eine Zeile und lenkt ab.
 */
describe("ItemPreview: keine Null-Zähler", () => {
  it("nennt keine Zahl, wo es nichts zu zählen gibt", () => {
    const html = markup()
    expect(html).not.toMatch(/\b0\s*(Kommentar|Reaktion)/)
  })
})

describe("ItemPreview: die dichte Ansicht", () => {
  it("lässt die Beschreibung weg", () => {
    expect(markup({ density: "compact" })).not.toContain("Bringt eure kaputten")
  })

  it("zeigt den Urheber nur als Bild, mit Namen im Tooltip", () => {
    const html = markup({ density: "compact" })
    expect(html).toContain('title="Sebastian"')
    // Kein sichtbarer Name in der Zeile — dafür ist in einer Kanban-Spalte
    // kein Platz. (Vorlesbar bleibt er über das aria-label des Profil-Links.)
    expect(html).not.toContain("<span>Sebastian</span>")
    expect(html).not.toContain("bearbeitet")
  })
})

/**
 * Ein Beitrag ohne Titel — eine kurze Notiz — beginnt mit dem, was er zu sagen
 * hat. Eine Kopfzeile, die dann nur den Typ trägt, wäre eine leere Behauptung.
 */
describe("ItemPreview: Beitrag ohne Titel", () => {
  it("beginnt mit dem Inhalt", () => {
    const html = markup({
      item: beitrag({ data: { content: "Der Schlüssel liegt wieder im Café." }, tags: undefined }),
    })
    expect(vorher(html, "Der Schlüssel", "Sebastian")).toBe(true)
  })
})

/**
 * „+2" allein sagt nicht, wovon — weder vorgelesen noch beim Überfahren.
 */
describe("ItemPreview: der Rest der Tags", () => {
  it("sagt, wie viele weitere es sind", () => {
    const html = markup({
      item: beitrag({ tags: ["repair", "community", "nachbarschaft", "werkstatt", "offen"] }),
    })
    expect(html).toContain('aria-label="2 weitere Tags"')
    // Und welche: sonst müsste man das Item öffnen, um es zu erfahren.
    expect(html).toContain('title="werkstatt, offen"')
  })

  it("bleibt im Singular bei genau einem weiteren", () => {
    const html = markup({
      item: beitrag({ tags: ["repair", "community", "nachbarschaft", "werkstatt"] }),
    })
    expect(html).toContain('aria-label="1 weiterer Tag"')
  })
})
