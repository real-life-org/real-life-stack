import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { moduleIds } from "../src/lib/module-register"
import { canonicalPath, resolveDefaultModule } from "../src/router"

const SRC = join(__dirname, "..", "src", "components", "router")
const DATEIEN = ["workspace-routing.tsx", "notification-route.ts", "url-focus.tsx"]

/**
 * Die Regeln, die bis zum 21.09.2026 an `hooks/use-workspace-routing.ts` der
 * Referenz-App hingen — mitgezogen, weil sie den Zweck des Registers
 * schuetzen (Spec 01, Regel 1: keine zweite Modul-Liste).
 */
describe("Router-Unterpfad: keine zweite Modul-Liste", () => {
  it.each(DATEIEN)("%s enumerates no module ids of its own", (datei) => {
    const quelle = readFileSync(join(SRC, datei), "utf8")
    const ids = moduleIds()
    const treffer = quelle
      .split("\n")
      .filter((zeile) => !zeile.trimStart().startsWith("//") && !zeile.trimStart().startsWith("*"))
      .filter((zeile) => ids.filter((id) => zeile.includes(`"${id}"`)).length >= 3)
    expect(treffer).toEqual([])
  })

  it.each(DATEIEN)("%s holds no module list at import time", (datei) => {
    const quelle = readFileSync(join(SRC, datei), "utf8")
    const snapshots = quelle
      .split("\n")
      .filter((z) => /^(export )?const \w+ = (moduleIds|defaultModuleIds)\(\)/.test(z.trim()))
    expect(snapshots).toEqual([])
  })
})

describe("Rueckfall waehlt die App (Spec 01, Der Modul-Host)", () => {
  const ohneFeld = { hasPosition: false, hasStart: false, hasStatus: false }
  it("nimmt den genannten Rueckfall, wenn der Space ihn fuehrt", () => {
    expect(resolveDefaultModule(ohneFeld, ["graph", "collection", "feed"], "collection")).toBe("collection")
  })
  it("nimmt sonst das erste Modul des Space", () => {
    expect(resolveDefaultModule(ohneFeld, ["graph", "collection"], "feed")).toBe("graph")
    expect(resolveDefaultModule(ohneFeld, ["graph", "collection"])).toBe("graph")
  })
  it("laesst ein Feld vorgehen", () => {
    expect(resolveDefaultModule({ ...ohneFeld, hasPosition: true }, ["graph", "map"], "graph")).toBe("map")
  })
  it("baut den kanonischen Pfad mit Query und Fragment", () => {
    expect(canonicalPath("garten", "map", "item-7", "?dev", "#pin")).toBe("/garten/map/item-7?dev#pin")
  })
})
