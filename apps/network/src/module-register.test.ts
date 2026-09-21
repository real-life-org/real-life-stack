import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { filterForHint, type Item } from "@real-life-stack/data-interface"
import { getModule, getModules, hostFiltersFor, moduleIds, modulePresentsItem, resolveSpaceModules } from "@real-life-stack/toolkit"

import "./module-register"
import { DWEB_CAMP_VIEW, DWEB_CAMP_WEEK } from "./module-register"

const item = (id: string, type: string, data: Record<string, unknown>): Item =>
  ({ id, type, createdAt: "2026-07-16T00:00:00.000Z", createdBy: "seed", data })

describe("Netzwerk-App: das Register (Spec 01, Der Modul-Host, Regel 5)", () => {
  it("führt alle Toolkit-Module plus den Marktplatz, jedes mit Fläche", () => {
    expect(moduleIds()).toContain("marketplace")
    expect(getModules().filter((m) => !m.view).map((m) => m.id)).toEqual([])
  })

  it("der Marktplatz zeigt Ressourcen — über seinen eigenen Hinweis, beide Richtungen", () => {
    const resource = item("r1", "resource", { title: "Beamer" })
    const task = item("t1", "task", { title: "Aufbau", status: "open" })
    expect(modulePresentsItem("marketplace", resource)).toBe(true)
    expect(modulePresentsItem("marketplace", task)).toBe(false)
    expect(filterForHint("resource")).toEqual({ type: ["resource"] })
    // Der Host lädt daraus genau eine Abfrage.
    expect(hostFiltersFor(getModule("marketplace")!)).toEqual([{ type: ["resource"] }])
  })

  it("Karte und Kalender bekommen die Daten des Camps als Konfiguration, ausdrücklich ersetzt", () => {
    expect(getModule("map")?.options).toEqual({ suggestType: "place", initialView: DWEB_CAMP_VIEW })
    expect(getModule("calendar")?.options).toEqual({ suggestType: "event", initialVisibleDate: DWEB_CAMP_WEEK })
  })

  it("ein Space führt, was er speichert — in seiner Reihenfolge", () => {
    expect(resolveSpaceModules(["graph", "collection", "marketplace"])).toEqual(["graph", "collection", "marketplace"])
  })
})

describe("keine zweite Modul-Liste in der App (Spec 01, Regel 1)", () => {
  // Bis zum 21.09.2026 kannte `App.tsx` sechs Linsen mit Namen, Icons und
  // Labels, und `notification-navigation.ts` übersetzte sie ein zweites Mal.
  it.each(["App.tsx", "module-register.tsx", "modules/marketplace-module.tsx"])("%s zählt keine Modul-Ids auf", (datei) => {
    const quelle = readFileSync(join(__dirname, datei), "utf8")
    const ids = moduleIds()
    const treffer = quelle
      .split("\n")
      .filter((zeile) => !zeile.trimStart().startsWith("//") && !zeile.trimStart().startsWith("*"))
      .filter((zeile) => ids.filter((id) => zeile.includes(`"${id}"`)).length >= 3)
    expect(treffer).toEqual([])
  })
})
