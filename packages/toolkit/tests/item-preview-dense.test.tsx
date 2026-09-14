// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Item, User } from "@real-life-stack/data-interface"

import { ItemPreview } from "../src/components/preview/item-preview"
import { ItemAssignees } from "../src/components/preview/item-assignees"
import { getUserColor } from "../src/lib/utils"

/**
 * Die dritte Dichte ist fuer Matrix-Flaechen gedacht: zwoelf Spalten mal N
 * Zeilen auf einen Schirm. Was dort noch Platz hat, ist der Titel und ein
 * Hinweis darauf, wer dranhaengt — alles andere kostet Hoehe, die es nicht
 * gibt. Masse aus „RLS System Design → Dragon Dreaming.dc.html", Variante 1a.
 */
const aufgabe = (over: Partial<Item> = {}): Item =>
  ({
    id: "t1",
    type: "task",
    createdAt: "2026-06-05T10:00:00.000Z",
    createdBy: "u1",
    tags: ["repair", "community"],
    data: {
      title: "Beete vorbereiten",
      content: "Erde umgraben und Kompost einarbeiten.",
      start: "2026-07-04T16:00:00.000Z",
    },
    relations: [],
    ...over,
  }) as Item

const lena: User = { id: "u1", displayName: "Lena Berg" } as User
const anton: User = { id: "u2", displayName: "Anton T." } as User

function markup(over: Partial<Parameters<typeof ItemPreview>[0]> = {}) {
  return renderToStaticMarkup(
    <ItemPreview
      item={aufgabe()}
      author={lena}
      metaAdornment={<span>4. Juli, 16:00</span>}
      {...over}
    />,
  )
}

describe("ItemPreview: Dichte dense", () => {
  it("zeigt den Titel, auf drei Zeilen begrenzt", () => {
    const html = markup({ density: "dense" })
    expect(html).toContain("Beete vorbereiten")
    expect(html).toContain("line-clamp-3")
  })

  it("laesst lange Woerter brechen statt die Kachel zu sprengen", () => {
    const html = markup({ density: "dense" })
    expect(html).toContain("anywhere")
    expect(html).toContain("hyphens")
    expect(html).toContain('lang="de"')
  })

  it("laesst Text, Meta-Zeile und Tags weg", () => {
    const html = markup({ density: "dense" })
    expect(html).not.toContain("Erde umgraben")
    expect(html).not.toContain("4. Juli, 16:00")
    expect(html).not.toContain("repair")
  })

  it("laesst den Urheber weg — in einer Matrix-Zelle ist dafuer kein Platz", () => {
    const html = markup({ density: "dense" })
    expect(html).not.toContain("Lena Berg")
  })

  it("markiert sich als dense, damit Flaechen darauf zielen koennen", () => {
    expect(markup({ density: "dense" })).toContain('data-preview-density="dense"')
  })

  it("traegt die Fusszeile, die der Caller mitgibt", () => {
    const html = markup({
      density: "dense",
      footerAdornment: <ItemAssignees users={[lena, anton]} size="xs" />,
    })
    expect(html).toContain("LB")
    expect(html).toContain("AT")
  })
})

/**
 * Erledigtes bleibt sichtbar, tritt aber zurueck: ein Haekchen vor dem Titel
 * und die ganze Kachel gedimmt. Wer das Brett ueberfliegt, sieht, was noch
 * offen ist, ohne dass Erledigtes verschwindet.
 */
describe("ItemPreview: erledigt", () => {
  it("setzt ein Haekchen vor den Titel und dimmt die Kachel", () => {
    const html = markup({ density: "dense", completed: true })
    expect(html).toContain("✓")
    expect(html).toContain("0.55")
    expect(html).toContain('data-completed="true"')
  })

  it("laesst offene Karten unangetastet", () => {
    const html = markup({ density: "dense" })
    expect(html).not.toContain("✓")
    expect(html).not.toContain("0.55")
  })
})

/**
 * In der Matrix-Kachel steht kein Kommentarzaehler: Das Design zeigt dort
 * genau zwei Dinge, Titel und Zugewiesene.
 */
describe("ItemPreview dense: kein Kommentarzaehler", () => {
  it("nennt weder Zahl noch Einladung", () => {
    const html = markup({ density: "dense" })
    expect(html).not.toContain("Kommentieren")
    expect(html).not.toMatch(/lucide-message-square/)
  })
})

/**
 * Die beiden bestehenden Dichten duerfen sich durch die dritte nicht
 * veraendern — sonst wandert ein Board-Layout, das heute stimmt.
 */
describe("ItemPreview: comfortable und compact bleiben", () => {
  it("comfortable zeigt Text, Meta und Tags", () => {
    const html = markup()
    expect(html).toContain("Erde umgraben")
    expect(html).toContain("4. Juli, 16:00")
    expect(html).toContain("repair")
    expect(html).toContain("Lena Berg")
  })

  it("compact laesst nur den Text weg", () => {
    const html = markup({ density: "compact" })
    expect(html).not.toContain("Erde umgraben")
    expect(html).toContain("4. Juli, 16:00")
    expect(html).toContain("repair")
  })

  it("begrenzt den Titel nur in der dichtesten Ansicht", () => {
    expect(markup()).not.toContain("line-clamp-3")
    expect(markup({ density: "compact" })).not.toContain("line-clamp-3")
  })
})

/**
 * `ItemAssignees` bekommt fuer die dichte Karte eine kleine Groesse und zwei
 * Stile — keine zweite Komponente, sonst laufen zwei Avatar-Stapel
 * auseinander.
 */
describe("ItemAssignees: Groesse xs", () => {
  it("zeigt nur die Bilder, keinen Namen", () => {
    const html = renderToStaticMarkup(<ItemAssignees users={[lena, anton]} size="xs" />)
    expect(html).not.toContain("Lena Berg,")
    expect(html).not.toContain("+ 1 weitere")
    expect(html).toContain("h-3.5 w-3.5")
  })

  it("bleibt in der Standardgroesse beim Namens-Resuemee", () => {
    const html = renderToStaticMarkup(<ItemAssignees users={[lena, anton]} />)
    expect(html).toContain("Lena Berg, Anton T.")
    expect(html).toContain("h-5 w-5")
  })

  it("zeigt hoechstens fuenf Avatare", () => {
    const viele = Array.from({ length: 8 }, (_, i) => ({
      id: `u${i}`,
      displayName: `Person ${i}`,
    })) as User[]
    const html = renderToStaticMarkup(<ItemAssignees users={viele} size="xs" />)
    expect(html.match(/data-slot="avatar"/g)?.length).toBe(5)
  })
})

/**
 * Zwei Stile, keine Bedeutung: Das Toolkit faerbt gefuellt oder umrandet, was
 * das heisst (kann ich / will lernen, Zusage / vielleicht), entscheidet die
 * App.
 */
describe("ItemAssignees: gefuellt und umrandet", () => {
  it("fuellt per Default mit der Personenfarbe", () => {
    const html = renderToStaticMarkup(<ItemAssignees users={[lena]} size="xs" />)
    expect(html).toContain(getUserColor(lena.id))
  })

  it("zeichnet den umrandeten Stil mit Ring und Schrift in der Personenfarbe", () => {
    const html = renderToStaticMarkup(
      <ItemAssignees users={[{ ...lena, variant: "outline" }]} size="xs" />,
    )
    expect(html).toContain("inset")
    expect(html).toContain(getUserColor(lena.id))
  })

  it("gibt jeder Person dieselbe Farbe, egal wo sie auftaucht", () => {
    expect(getUserColor(lena.id)).toBe(getUserColor(lena.id))
    expect(getUserColor(lena.id)).not.toBe(getUserColor(anton.id))
  })
})
