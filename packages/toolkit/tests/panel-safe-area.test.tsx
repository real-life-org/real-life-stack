// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelSafeArea } from "../src/components/layout/panel-safe-area"

/**
 * Der Vertrag: alles, was auf einer stehenbleibenden Modulflaeche schwebt,
 * liegt in dieser Flaeche und rechnet danach mit normalem Layout. Die
 * Panel-Insets werden GENAU HIER abgezogen - nicht an jedem Overlay einzeln,
 * sonst vergisst man eines (die Ladeanzeige zentrierte sich auf eine Mitte,
 * die halb unter dem Panel lag).
 */
describe("PanelSafeArea", () => {
  const markup = () => renderToStaticMarkup(<PanelSafeArea><span>x</span></PanelSafeArea>)

  it("zieht beide Panel-Insets ab", () => {
    const html = markup()
    expect(html).toContain("var(--adaptive-panel-margin-left, 0px)")
    expect(html).toContain("var(--adaptive-panel-margin-right, 0px)")
  })

  it("spannt sich ueber die volle Hoehe der Modulflaeche", () => {
    expect(markup()).toContain("absolute")
    expect(markup()).toContain("inset-y-0")
  })

  it("laesst die Flaeche darunter bedienbar, die Kinder aber anklickbar", () => {
    const html = markup()
    expect(html).toContain("pointer-events-none")
    expect(html).toContain("pointer-events-auto")
  })

  it("bewegt sich mit dem einrueckenden Inhalt, nicht danach", () => {
    // AppShellMain animiert sein Padding ueber 300ms; laufen die beiden
    // auseinander, wandern die Controls sichtbar hinterher.
    expect(markup()).toContain("300ms")
  })

  it("nimmt eigene Klassen an, ohne den Vertrag zu verlieren", () => {
    const html = renderToStaticMarkup(
      <PanelSafeArea className="z-20 flex justify-center"><span>x</span></PanelSafeArea>
    )
    expect(html).toContain("z-20")
    expect(html).toContain("justify-center")
    expect(html).toContain("var(--adaptive-panel-margin-right, 0px)")
  })
})

import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Der Rueckfall, den dieser Test verhindert: jemand ergaenzt ein weiteres
 * Overlay auf der Karte - eine Fehlermeldung, ein Tooltip - positioniert es
 * mit `absolute` und vergisst die Panel-Insets. Es liegt dann unter dem
 * Panel oder zentriert sich auf eine halb verdeckte Mitte.
 *
 * Genau so ist es dreimal passiert: obere Leiste, Hinweis beim Ort-Waehlen,
 * Ladeanzeige. Einzeln gepatcht waere das eine Kaskade ohne Ende.
 */
describe("Overlays der Karte liegen ausnahmslos in der Flaeche", () => {
  const quelle = readFileSync(
    join(__dirname, "../src/components/map/map-view.tsx"),
    "utf8",
  )

  it("positioniert keinen INHALT von Hand ueber die volle Breite", () => {
    // Zwei Dinge, die man leicht verwechselt - ich habe es selbst getan:
    //
    //   Eine deckende FLAECHE (der Lade-Schleier) MUSS voll sein, sonst
    //   endet sie an der Panel-Kante und dahinter schaut die Karte hervor.
    //
    //   Der INHALT darin (Spinner, Leiste, Hinweis) gehoert in die
    //   PanelSafeArea, sonst zentriert er sich auf eine halb verdeckte Mitte.
    //
    // Unterscheidbar am Layout: wer `flex`, `justify-` oder `items-` traegt,
    // ordnet Inhalt an und muss die Flaeche nutzen. Ein reiner Schleier hat
    // nur Hintergrund und z-Ebene.
    const treffer = [...quelle.matchAll(/className="([^"]*\babsolute\b[^"]*)"/g)]
      .map((m) => m[1])
      .filter((c) => /\binset-0\b|\binset-x-0\b/.test(c))
      .filter((c) => /\bflex\b|\bjustify-|\bitems-|\bgrid\b/.test(c))

    expect(treffer, `Diese Overlays ordnen Inhalt an und gehoeren in eine PanelSafeArea:\n${treffer.join("\n")}`)
      .toEqual([])
  })

  it("laesst eine deckende Flaeche ueber die ganze Breite laufen", () => {
    // Der Lade-Schleier: ohne ihn saehe man rechts die Karte durch das halb
    // durchsichtige Panel schimmern, waehrend links alles abgedeckt ist.
    expect(quelle).toContain('className="absolute inset-0 z-10 bg-background/80"')
  })

  it("nutzt die Flaeche fuer jedes schwebende Element", () => {
    // Ladeanzeige, Hinweis, Steuerleiste - drei Stellen, ein Vertrag.
    const anzahl = (quelle.match(/<PanelSafeArea/g) ?? []).length
    expect(anzahl).toBeGreaterThanOrEqual(3)
  })
})
