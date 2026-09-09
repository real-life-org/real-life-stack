// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Item, User } from "@real-life-stack/data-interface"

import { ItemPreview } from "../src/components/preview/item-preview"
import { ItemDetailBody } from "../src/components/detail/item-detail-body"

/**
 * Derselbe Fehler stand schon zweimal im Code, in beiden Ansichten: Name,
 * Zeitpunkt und „bearbeitet" zusammen in `shrink-0 whitespace-nowrap`, in
 * einem Container, der abschneidet. Bei einem langen Anzeigenamen — oder der
 * rohen Id, wenn niemand ihn auflöst — verschwinden dann Datum und
 * Bearbeitungshinweis, und in der Vorschau werden die Tags ganz verdrängt.
 *
 * Darum steht die Regel hier für BEIDE Ansichten an einer Stelle: Der Name
 * kürzt, die Zeitangaben halten zusammen, und der Bereich darf schrumpfen.
 */
const LANGER_NAME = "did:key:z6MkiA5JHrmkT9pR7vLcQx2FnB3wYsE4uZqK7dTgWpN1xVbC"

const item = (over: Partial<Item> = {}): Item =>
  ({
    id: "i1",
    type: "post",
    createdAt: "2026-06-05T10:00:00.000Z",
    createdBy: "u1",
    updatedAt: "2026-06-06T10:00:00.000Z",
    updatedBy: "u1",
    tags: ["garten", "werkstatt"],
    data: { title: "Titel", content: "Inhalt" },
    relations: [],
    ...over,
  }) as Item

const langerUrheber: User = { id: "u1", displayName: LANGER_NAME } as User

/**
 * Der Abschnitt ab dem gekürzten Namensfeld. Verankert an `class="truncate"`
 * und nicht am Namen selbst: Der steht auch im `aria-label` des Profil-Links,
 * also weiter vorn, und ein Ausschnitt von dort träfe die Zeitangaben nicht.
 */
function urheberzeile(html: string): string {
  const start = html.indexOf('class="truncate"')
  expect(start, "gekürztes Namensfeld nicht gefunden").toBeGreaterThan(-1)
  return html.slice(Math.max(0, start - 400), start + 800)
}

const ansichten: Array<[string, () => string]> = [
  [
    "ItemPreview",
    () => renderToStaticMarkup(<ItemPreview item={item()} author={langerUrheber} />),
  ],
  [
    "ItemDetailBody",
    () => renderToStaticMarkup(<ItemDetailBody item={item()} author={langerUrheber} />),
  ],
]

describe.each(ansichten)("Urheberzeile in %s", (_name, rendern) => {
  it("kürzt den Namen, statt die Zeile zu sprengen", () => {
    expect(rendern()).toContain('class="truncate"')
  })

  it("hält den vollen Namen im Tooltip vor", () => {
    expect(rendern()).toContain(`title="${LANGER_NAME}"`)
  })

  it("hält die Zeitangaben zusammen, aber getrennt vom Namen", () => {
    const zeile = urheberzeile(rendern())
    // Ein eigener, nicht schrumpfender Block NACH dem Namen: So bleiben Datum
    // und Bearbeitungshinweis lesbar, während der Name weicht.
    const nachDemNamen = zeile.slice(zeile.indexOf('class="truncate"'))
    expect(nachDemNamen).toMatch(/<span class="[^"]*shrink-0[^"]*whitespace-nowrap[^"]*"/)
    expect(nachDemNamen).toContain("bearbeitet")
  })

  it("lässt den Urheberbereich schrumpfen", () => {
    // `shrink-0` auf dem ganzen Bereich wäre der Fehler: Dann weicht alles
    // andere, statt dass der Name kürzt.
    const html = rendern()
    // Der Bereich beginnt beim `ml-auto`, das ihn nach rechts schiebt.
    const bereich = html.slice(html.indexOf("ml-auto"), html.indexOf('class="truncate"'))
    expect(bereich).toContain("min-w-0")
    expect(bereich).not.toContain("shrink-0 items-center gap-1.5 whitespace-nowrap")
  })
})
