import { describe, expect, it } from "vitest"
import { workspaceOf } from "../src/components/layout/workspace-switcher"

// Die eine Ableitung Gruppe → Workspace (Spec 04): Rahmen, Stories und Handbuch nutzen sie gemeinsam.
describe("workspaceOf", () => {
  it("liest Bild, Farbe und Theme-Achsen aus data", () => {
    const w = workspaceOf({
      id: "garden",
      name: "Gemeinschaftsgarten",
      data: { image: "data:image/svg+xml,x", primaryColor: "#2f855a", tint: 0.4, gray: "auto", scope: "garten" },
    })
    expect(w).toMatchObject({ id: "garden", name: "Gemeinschaftsgarten", avatar: "data:image/svg+xml,x", primaryColor: "#2f855a", tint: 0.4, gray: "auto", scope: "garten" })
  })

  it("laesst Felder weg, die fehlen oder die falsche Form haben", () => {
    const w = workspaceOf({ id: "w", name: "Werkstatt", data: { image: 7, gray: "neon", tint: "viel" } })
    expect(w.avatar).toBeUndefined()
    expect(w.gray).toBeUndefined()
    expect(w.tint).toBeUndefined()
    expect(workspaceOf({ id: "p", name: "Persoenlich" })).toEqual({ id: "p", name: "Persoenlich", avatar: undefined, scope: undefined, primaryColor: undefined, tint: undefined, gray: undefined, radius: undefined, surfaces: undefined })
  })
})
