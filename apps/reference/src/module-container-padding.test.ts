import { describe, expect, it } from "vitest"
import { moduleContainerClass } from "./views/module-outlet"

/**
 * Der Container gibt oben 16px, damit die Steuerleiste nicht an der Navbar
 * klebt. Unten braucht er dasselbe: Sonst endet die Seite exakt mit der
 * letzten Karte, am Desktop ohne untere Navigation sichtbar.
 */
describe("moduleContainerClass", () => {
  it("polstert oben und unten gleich", () => {
    const klasse = moduleContainerClass("feed") ?? ""
    expect(klasse).toContain("pt-4")
    expect(klasse).toContain("pb-4")
  })
})
