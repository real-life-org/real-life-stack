import assert from "node:assert/strict"
import { test } from "node:test"
import { moduleHints, reference, registerEntries, storyFor } from "./lib.mjs"

test("registerEntries liest die Eintraege aus dem Syntaxbaum, mit Standardwerten", () => {
  const entries = registerEntries(`import { X } from "x"
export const TOOLKIT_MODULES: readonly ModuleEntry[] = Object.freeze([
  { id: "a", label: "A", icon: IconA, presents: ["start"], options: { suggestType: "event" }, view: ViewA },
  { id: "b", label: "B", icon: IconB, fill: "bleed", loads: "module", keepMounted: true, view: ViewB },
])
`)
  assert.equal(entries.length, 2)
  assert.deepEqual(entries[0], { id: "a", label: "A", icon: "IconA", view: "ViewA", enabledByDefault: false, fill: "container", panelFit: "inset", maxWidth: null, keepMounted: false, presents: ["start"], loads: "host", options: { suggestType: "event" } })
  assert.equal(entries[1].loads, "module")
  assert.equal(entries[1].fill, "bleed")
})

test("moduleHints liest Name, key und den Filter als Quelltext", () => {
  const hints = moduleHints(`registerModuleHint("start", { key: "hasStart", test: (i) => true, filter: () => ({ hasField: ["start"] }) })\n`)
  assert.deepEqual(hints, { start: { key: "hasStart", filter: '{ hasField: ["start"] }' } })
  const real = moduleHints()
  for (const h of ["position", "start", "status", "statement"]) assert.ok(real[h], h)
})

test("die echte Referenz: sieben Module, jede Story und jeder Hinweis vorhanden, jede mit Einleitung", () => {
  const { modules, errors } = reference()
  assert.deepEqual(errors, [])
  assert.deepEqual(modules.map((m) => m.id), ["feed", "kanban", "calendar", "map", "resonance", "collection", "graph"])
  assert.equal(storyFor("collection"), "rls-modules-list--docs")
  for (const m of modules) assert.ok(m.intro.length > 40, `${m.id}: intro`)
  assert.equal(modules.find((m) => m.id === "map").loads, "module")
})
