import assert from "node:assert/strict"
import { test } from "node:test"
import { hash, pages, read, route, validatePage } from "./lib.mjs"

// Was das Skript prueft, muss es auch sehen: verschachtelte Handbuchseiten
// und ihre Adressen (rls#434, Codex).
test("pages() findet verschachtelte Seiten, mit Sprache und Id", () => {
  const ids = pages().map((p) => `${p.lang}:${p.id}`)
  assert.ok(ids.includes("de:handbuch/index"), ids.join(", "))
  assert.ok(ids.includes("en:handbuch/index"))
  assert.ok(ids.includes("de:datenschutz"))
})

test("route(): index faellt weg, Deutsch ohne Praefix", () => {
  assert.equal(route({ lang: "de", id: "handbuch/index" }), "/handbuch/")
  assert.equal(route({ lang: "en", id: "handbuch/index" }), "/en/handbuch/")
  assert.equal(route({ lang: "de", id: "datenschutz" }), "/datenschutz/")
  assert.equal(route({ lang: "de", id: "index" }), "/")
})

test("validatePage: Quelle fehlt, Story fehlt, Seite fehlt, Uebersetzung veraltet", () => {
  const ctx = { files: (f) => f === "da.md", stories: new Set(["s-1"]), routes: new Set(["/handbuch/"]), sources: () => "quelle" }
  const page = (meta, body = "") => ({ lang: "de", id: "x", meta, body })
  assert.deepEqual(validatePage(page({ sources: ["da.md"] }), ctx), [])
  assert.match(validatePage(page({ sources: ["fehlt.md"] }), ctx)[0], /Quelle fehlt/)
  assert.match(validatePage(page({ sources: [], stories: ["s-9"] }), ctx)[0], /Story fehlt/)
  assert.match(validatePage(page({ sources: [] }, '<Story id="s-1" title="t" />'), ctx)[0], /nicht deklariert/)
  assert.match(validatePage(page({ sources: [] }, "[x](/handbuch/nix/)"), ctx)[0], /Seite fehlt/)
  const en = { lang: "en", id: "x", meta: { sources: [], translationOf: "q", sourceHash: "alt" }, body: "" }
  assert.match(validatePage(en, ctx)[0], /Uebersetzung|Übersetzung/)
  en.meta.sourceHash = hash("quelle")
  assert.deepEqual(validatePage(en, ctx), [])
})

test("jede englische Seite mit translationOf traegt den aktuellen sourceHash", () => {
  for (const p of pages().filter((p) => p.lang === "en" && p.meta.translationOf)) {
    assert.equal(p.meta.sourceHash, hash(read(p.meta.translationOf)), `${p.path}: sourceHash veraltet`)
  }
})
