// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Item, User } from "@real-life-stack/data-interface"

import { ItemDetailBody } from "../src/components/detail/item-detail-body"

const item = (over: Partial<Item> = {}): Item =>
  ({
    id: "i1",
    type: "event",
    createdAt: "2026-08-04T10:00:00.000Z",
    createdBy: "u1",
    data: { title: "Repair-Café", content: "Bringt eure kaputten Geräte mit." },
    tags: ["repair", "community"],
    relations: [],
    ...over,
  }) as Item

const autor: User = { id: "u1", displayName: "Sebastian" } as User

function markup(over: Partial<Parameters<typeof ItemDetailBody>[0]> = {}) {
  return renderToStaticMarkup(
    <ItemDetailBody
      item={item()}
      author={autor}
      headerAdornment={<span>EVENT-BADGE</span>}
      actions={<button>MENUE</button>}
      meta={<span>4. Juli, 16:00</span>}
      footer={<span>REAKTIONEN</span>}
      {...over}
    />,
  )
}

/** Reihenfolge im gerenderten HTML — die Anatomie ist eine Aussage über sie. */
function vorher(html: string, a: string, b: string): boolean {
  const i = html.indexOf(a)
  const j = html.indexOf(b)
  expect(i, `nicht gefunden: ${a}`).toBeGreaterThan(-1)
  expect(j, `nicht gefunden: ${b}`).toBeGreaterThan(-1)
  return i < j
}

describe("ItemDetailBody: die Ordnung der Detailansicht", () => {
  it("führt mit Typ und Aktionen, dann dem Titel", () => {
    const html = markup()
    expect(vorher(html, "EVENT-BADGE", "Repair-Café")).toBe(true)
    expect(vorher(html, "MENUE", "Repair-Café")).toBe(true)
  })

  it("stellt die harten Fakten zwischen Titel und Text", () => {
    const html = markup()
    expect(vorher(html, "Repair-Café", "4. Juli, 16:00")).toBe(true)
    expect(vorher(html, "4. Juli, 16:00", "Bringt eure kaputten Geräte")).toBe(true)
  })

  /**
   * Der Unterschied zur Vorschau: Dort steht der Autor oben, weil man in einer
   * Liste zuerst wissen will, von wem etwas kommt. Wer ein Item geöffnet hat,
   * will zuerst wissen, WAS es ist.
   */
  it("nennt den Urheber erst unten, nach Titel und Text", () => {
    const html = markup()
    expect(vorher(html, "Repair-Café", "Erstellt von")).toBe(true)
    expect(vorher(html, "Bringt eure kaputten Geräte", "Erstellt von")).toBe(true)
    expect(html).toContain("Sebastian")
  })

  it("stellt Tags und Urheber in dieselbe Zeile, Urheber rechts", () => {
    const html = markup()
    expect(vorher(html, "repair", "Erstellt von")).toBe(true)
    expect(html).toContain("ml-auto")
  })

  /**
   * Ein langer Anzeigename — oder die rohe Id, wenn niemand ihn auflöst —
   * schob die Zeile aus der Karte: Umbruch und Kürzung waren beide gesperrt.
   * Der Name kürzt jetzt, das Datum bleibt vollständig.
   */
  it("kürzt den Namen, hält aber das Datum zusammen", () => {
    const html = markup({
      author: { id: "u1", displayName: "did:key:z6MkiA5JHrmkT9pR7vLcQx2FnB3wYsE4uZ" } as User,
    })
    // Der Name kuerzt …
    expect(html).toContain("truncate")
    // … der Zeitteil steht in einem eigenen Block, der weder schrumpft noch
    // umbricht.
    const zeitBlock = html.slice(html.indexOf("truncate"))
    expect(zeitBlock).toMatch(/<span class="[^"]*shrink-0[^"]*whitespace-nowrap[^"]*"/)
  })

  /**
   * Ohne Panel darüber bleiben die Aktionen in dieser Ansicht — dann gehören
   * sie in DIE Kopfzeile, nicht in eine eigene Zeile davor.
   */
  it("teilt die Kopfzeile mit den Aktionen, wenn kein Panel sie aufnimmt", () => {
    const html = markup()
    // Eine Zeile, die beides verteilt — statt zweier Bloecke untereinander.
    expect(html).toContain("justify-between")
    expect(vorher(html, "justify-between", "EVENT-BADGE")).toBe(true)
    expect(vorher(html, "EVENT-BADGE", "MENUE")).toBe(true)
  })

  it("setzt den einzigen Trenner vor die Aktionszeile", () => {
    const html = markup()
    expect(vorher(html, "Erstellt von", "REAKTIONEN")).toBe(true)
    expect(html.match(/border-t/g) ?? []).toHaveLength(1)
  })

  /**
   * Der Grund für diese Komponente: Im schwebenden Panel ergab die
   * wiederverwendete Vorschau-Card eine Card in der Card — zwei Rahmen, zwei
   * Radien, zwei Schatten um denselben Inhalt.
   */
  it("bringt keinen eigenen Rahmen mit — das Panel ist die Karte", () => {
    const wurzel = markup().slice(0, markup().indexOf(">") + 1)
    expect(wurzel).not.toMatch(/\brounded-/)
    expect(wurzel).not.toMatch(/\bshadow-/)
    expect(wurzel).not.toMatch(/\bborder\b/)
    expect(wurzel).not.toMatch(/\bbg-card\b/)
  })

  it("lässt die Meta-Box weg, wenn der Typ nichts beizutragen hat", () => {
    const html = markup({ meta: undefined })
    expect(html).not.toContain("bg-muted")
  })

  /**
   * Der Fall aus der laufenden App: Ein Task ohne Datum, Ort und Beziehungen
   * bekam einen leeren grauen Kasten. Ein Element ist immer „vorhanden", auch
   * wenn es `null` rendert — ein `if` sieht das nicht.
   */
  it("blendet die Meta-Box aus, wenn der Slot nichts rendert", () => {
    const Leer = () => null
    const html = markup({ meta: <Leer /> })
    expect(html).toContain("empty:hidden")
    // Der Kasten steht im Markup, ist aber leer — und damit unsichtbar.
    expect(html).toMatch(/<div class="[^"]*empty:hidden[^"]*"><\/div>/)
  })

  it("kommt ohne Titel, Text und Tags aus", () => {
    const html = markup({
      item: item({ data: {}, tags: undefined }),
      meta: undefined,
      footer: undefined,
    })
    expect(html).toContain("Erstellt von")
  })

  it("weist eine Bearbeitung aus, aber nur wenn es eine gab", () => {
    expect(markup()).not.toContain("bearbeitet")
    const html = markup({ item: item({ updatedAt: "2026-08-05T10:00:00.000Z", updatedBy: "u2" }) })
    expect(html).toContain("bearbeitet")
  })

  it("zeigt den Urheber auch ohne aufgelösten Nutzer", () => {
    expect(markup({ author: undefined })).toContain("u1")
  })
})
