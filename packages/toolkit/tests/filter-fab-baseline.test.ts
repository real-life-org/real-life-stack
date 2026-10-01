import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const src = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8")

// Befund 24.09.2026 (Telefonbreite): Auf Modulen ohne Ueberlagerung (Feed,
// Kalender, Kanban) stand der Filter 12px hoeher als der Plusknopf, auf der
// Karte nicht. Beide sitzen 5.25rem plus Schutzzone ueber der Bottom-Nav.
describe("Filter und Plusknopf teilen die Grundlinie ueber der Bottom-Nav", () => {
  const frame = src("components/layout/module-frame.tsx")
  const fab = src("components/create-fab/create-fab.tsx")

  it("der Plusknopf steht 5.25rem plus Schutzzone ueber dem Rand", () => {
    expect(fab).toContain("bottom-[calc(5.25rem+env(safe-area-inset-bottom))]")
  })

  it("ohne Ueberlagerung polstert die Shell 5rem, die Controls nur noch 0.25rem", () => {
    expect(src("components/layout/app-shell.tsx")).toContain("pb-[calc(5rem+env(safe-area-inset-bottom))]")
    // Seit rls#567 als Variable an der Wurzel der Flaeche, die das Polster
    // der Ecke UND die gemeldete Hoehe lesen.
    expect(frame).toContain('"[--module-controls-inset:0.25rem] md:[--module-controls-inset:1rem]"')
    expect(frame).toContain("pb-(--module-controls-inset)")
  })

  it("mit Ueberlagerung (Karte) tragen die Controls den ganzen Abstand selbst", () => {
    expect(frame).toContain("[--module-controls-inset:calc(5.25rem+env(safe-area-inset-bottom))] md:[--module-controls-inset:1rem]")
    expect(frame).toContain("raeumtObenLinks ? ECKE_UEBER_BOTTOM_NAV : ECKE_RAND")
  })
})
