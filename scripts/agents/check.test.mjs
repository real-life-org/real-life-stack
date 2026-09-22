import assert from "node:assert/strict"
import { test } from "node:test"
import { hooks, packages, renderLlms, renderTemplate, specDocs } from "./lib.mjs"

test("specDocs liest beide Tabellenformen des Spec-Index", () => {
  const rows = specDocs(`| Datei | Status | Inhalt |\n|---|---|---|\n| [00-a.md](00-a.md) | Normativ | Schichten |\n| [x](https://example.org) | - | extern |\n\n| Datei | Inhalt |\n|---|---|\n| [schemas/README.md](schemas/README.md) | Konventionen |\n`)
  assert.deepEqual(rows, [
    { label: "00-a.md", href: "00-a.md", status: "Normativ", description: "Schichten" },
    { label: "schemas/README.md", href: "schemas/README.md", status: "", description: "Konventionen" },
  ])
  const real = specDocs()
  assert.ok(real.some((r) => r.href === "01-app-composition.md"))
  assert.ok(real.some((r) => r.href === "12-profile.md"), "the spec index lists all twelve core specs")
})

test("jedes veroeffentlichte Paket hat eine Beschreibung", () => {
  const pkgs = packages()
  assert.ok(pkgs.length >= 6)
  for (const p of pkgs) assert.ok(p.description, `${p.name} without description`)
  assert.equal(pkgs[0].name, "@real-life-stack/data-interface")
})

test("llms.txt nennt jedes Paket, jede Spec-Datei und jeden Hook", () => {
  const out = renderLlms()
  for (const p of packages()) assert.ok(out.includes(`[${p.name}]`), p.name)
  for (const d of specDocs()) assert.ok(out.includes(`docs/spec/${d.href}`), d.href)
  for (const g of hooks()) for (const h of g.hooks) assert.ok(out.includes(`\`${h.name}(`), h.name)
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(out), "no timestamps — the check compares text")
})

// rls#443 (Codex): release-please bumpt Versionen, nicht llms.txt. Ein reiner
// Versionsbump darf die eingecheckte Datei deshalb nicht veralten lassen.
test("ein Versionsbump aendert llms.txt nicht", () => {
  const before = renderLlms()
  const bumped = packages().map((p) => ({ ...p, version: "9.9.9" }))
  assert.equal(renderLlms({ pkgs: bumped }), before)
  const packagesSection = before.slice(before.indexOf("## Packages"), before.indexOf("## Specification"))
  assert.ok(!/\d+\.\d+\.\d+/.test(packagesSection), "no package versions in the package list")
})

test("das App-Template traegt main.tsx und App.tsx der ersten App zwischen den Markern", () => {
  const out = renderTemplate()
  assert.ok(out.includes("<!-- first-app:start -->") && out.includes("<!-- first-app:end -->"))
  assert.ok(out.includes("RoutedAppFrame fallbackModule"), "App.tsx of the first app")
  assert.ok(out.includes("new MockConnector({"), "main.tsx of the first app")
  assert.throws(() => renderTemplate("# no markers"), /markers/)
})
