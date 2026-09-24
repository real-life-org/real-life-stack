// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"

import { ContentComposer, type ContentTypeConfig } from "../src/components/composer/content-composer"
import { istKompaktJetzt } from "../src/hooks/use-mobile"

const termin: ContentTypeConfig = {
  id: "event",
  label: "Termin",
  defaultWidgets: ["title", "text", "date"],
}

const urspruenglicheBreite = window.innerWidth
function breite(px: number) {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true })
}
afterEach(() => breite(urspruenglicheBreite))

function markup() {
  return renderToStaticMarkup(
    <ContentComposer contentTypes={[termin]} mode="event" onSubmit={() => {}} />,
  )
}

/**
 * Befund 24.09.2026 (Telefon): Der Erstellen-Drawer sprang in den Titel, die
 * Tastatur kam, und der Kopf des Formulars — Typ und Gruppe — war aus dem
 * Bild geschoben. Auf dem Telefon ist der Typ die erste Entscheidung.
 */
describe("Autofokus des Composers", () => {
  it("springt auf breiten Schirmen in den Titel", () => {
    breite(1280)
    expect(markup()).toContain("autofocus")
  })

  it("laesst den Titel auf schmalen Schirmen in Ruhe", () => {
    breite(390)
    expect(markup()).not.toContain("autofocus")
  })

  /**
   * Synchron, nicht ueber `useIsCompact`: `autoFocus` wirkt beim Einhaengen,
   * ein Hook, der seinen Wert erst im Effekt setzt, meldet beim ersten Render
   * noch „breit" — genau daran ist der erste Versuch gescheitert.
   */
  it("beantwortet die Breite sofort, nicht erst nach dem ersten Render", () => {
    breite(390)
    expect(istKompaktJetzt()).toBe(true)
    breite(1280)
    expect(istKompaktJetzt()).toBe(false)
  })
})
