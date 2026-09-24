import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const src = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8")

// Befund 24.09.2026 (Handbuch-Vorschau, Telefonbreite): Der Drawer wirkte grau
// und nicht durchscheinend, der Kommentar-Fuss hob sich als hellerer Kasten ab,
// und „Gemeinschaftsgarten" war abgeschnitten, obwohl Platz war. Story und App
// verhielten sich gleich — es ist Toolkit-Verhalten.
describe("Telefonbreite: Drawer und Space-Name", () => {
  it("der Drawer ist eine deckende Karte, kein Glas ueber dem abgedunkelten Hintergrund", () => {
    const panel = src("components/layout/adaptive-panel.tsx")
    const drawerLine = panel.split("\n").find((l) => l.includes('mode === "drawer" &&') && l.includes("rounded-t-xl"))
    expect(drawerLine).toBeDefined()
    expect(drawerLine).toContain("bg-card")
    expect(drawerLine).not.toContain("surface-glass")
  })

  it("Sidebar und schwebende Karte behalten das Glas", () => {
    const panel = src("components/layout/adaptive-panel.tsx")
    expect(panel).toMatch(/mode === "sidebar" && cn\(\s*\n\s*"[^"]*surface-glass/)
    expect(panel).toMatch(/mode === "floating" && cn\(\s*\n\s*"[^"]*surface-glass/)
  })

  it("der Space-Name kuerzt sich nur bei echtem Platzmangel, nicht an einem festen vw-Deckel", () => {
    const switcher = src("components/layout/workspace-switcher.tsx")
    expect(switcher).not.toMatch(/max-w-\[\d+vw\]/)
    expect(switcher).toMatch(/className="min-w-0 truncate [^"]*font-semibold/)
    const navbar = src("components/layout/navbar.tsx")
    const start = navbar.slice(navbar.indexOf("export function NavbarStart"), navbar.indexOf("export function NavbarCenter"))
    const startClass = start.match(/cn\("([^"]+)"/)?.[1] ?? ""
    expect(startClass).toContain("min-w-0")
    expect(startClass).not.toContain("shrink-0")
  })
})
