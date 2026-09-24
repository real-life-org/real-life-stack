import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const src = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8")

// Der Gemeinschaftsgarten ist die Beispiel-App des Handbuchs. Bis zum
// 24.09.2026 war er ein Nachbau aus Bausteinen und wich von der App ab (keine
// Abdunkelung ueber der Karte in der App, Marker ueber dem Drawer zentriert —
// im Garten beides anders). Ein Nachbau beweist nichts; der Garten laeuft auf
// derselben Story-Welt wie alle App-Stories.
describe("Gemeinschaftsgarten (Handbuch)", () => {
  it("laeuft auf der Story-Welt mit dem echten Rahmen, nicht auf einem Nachbau", () => {
    const garden = src("handbook/garden.tsx")
    expect(garden).toContain("HostWorld")
    for (const baustein of ["AppShell", "AdaptivePanel", "ModuleTabs", "BottomNav", "MapView", "CalendarView"]) {
      expect(garden, `${baustein} gehoert dem Rahmen, nicht dem Garten`).not.toContain(baustein)
    }
  })

  it("seine Spaces fuehren ihre Module selbst, wie in der App (Spec 01)", () => {
    const seed = src("handbook/garden-data.ts")
    expect(seed).toMatch(/id: 'garden'[^\n]*modules: \['feed', 'calendar', 'map'\]/)
    expect(seed).toMatch(/id: 'workshop'[^\n]*modules: \['collection'\]/)
  })

  it("die Story-Welt kennt den Nur-Lese-Modus und die Module des Space", () => {
    expect(src("story-support/story-world.tsx")).toContain("readOnly?: boolean")
    expect(src("story-support/host-world.tsx")).toContain("resolveSpaceModules(stored)")
  })
})
