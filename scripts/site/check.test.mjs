import assert from "node:assert/strict"
import { test } from "node:test"
import { glossaryMarkdown, hash, loadRegister, pages, read, route, toMarkdown, validatePage } from "./lib.mjs"

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

// Der Markdown-Export fuer Agenten (prepare.mjs) kennt kein MDX: markierte
// Begriffe werden Klartext, das Glossar wird aus dem Register geschrieben.
test("toMarkdown: Begriffslink wird Text, <Glossary /> wird das Register, Import faellt weg", async () => {
  const register = await loadRegister()
  const page = (lang, body) => ({ lang, id: "x", meta: {}, body })
  assert.equal(toMarkdown(page("de", "Bin ich [Mitglied](term:member) des [Space](term:space)?\n"), register), "Bin ich Mitglied des Space?\n")
  assert.equal(toMarkdown(page("en", "a [](term:member)\n"), register), "a Member\n")
  const de = toMarkdown(page("de", "import Glossary from '@real-life/docs-kit/Glossary.astro'\n\nText\n\n<Glossary />\n"), register)
  assert.doesNotMatch(de, /import|<Glossary/)
  assert.ok(de.startsWith("\nText\n\n## "), de)
  assert.match(de, /## Mitglied\n\n\S/)
  const en = toMarkdown(page("en", "<Glossary />"), register)
  assert.match(en, /## Member\n\n\S/)
  const labels = [...en.matchAll(/^## (.+)$/gm)].map((m) => m[1])
  assert.equal(labels.length, Object.keys(register.concepts).length)
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, "en")))
  assert.equal(glossaryMarkdown(register, "de").match(/^## /gm).length, labels.length)
})
