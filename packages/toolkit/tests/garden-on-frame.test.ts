import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { hostWorldGroups, hostWorldModuleFor, hostWorldModules } from "../src/story-support/host-world"
import { seed } from "../src/handbook/garden-data"

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

// Codex-Befunde zu rls#477, beide reproduziert.
describe("Story-Welt: Space-Wechsel", () => {
  it("ein Modul bleibt nur aktiv, wenn der neue Space es fuehrt", () => {
    expect(hostWorldModules(seed.groups, "garden")).toEqual(["feed", "calendar", "map"])
    expect(hostWorldModules(seed.groups, "workshop")).toEqual(["collection"])
    // Auf der Karte im Garten, dann in die Werkstatt: die Karte gibt es dort nicht, es geht in die Liste.
    expect(hostWorldModuleFor(seed.groups, "workshop", "map")).toBe("collection")
    // Zurueck in den Garten: die Liste gibt es dort nicht, es geht in den Feed.
    expect(hostWorldModuleFor(seed.groups, "garden", "collection")).toBe("feed")
    expect(hostWorldModuleFor(seed.groups, "garden", "calendar")).toBe("calendar")
  })

  it("ohne Gruppen-Faehigkeit (Nur-Lese-Sicht) bietet der Wechsler nur den aktiven Space an", () => {
    expect(hostWorldGroups(true, seed.groups, "garden").map((g) => g.id)).toEqual(["garden", "workshop"])
    expect(hostWorldGroups(false, seed.groups, "garden").map((g) => g.id)).toEqual(["garden"])
  })
})
