import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"
import { bundleFiles, writeBundle } from "./bundle.mjs"
import { root, specDocs } from "./lib.mjs"

const targets = () => bundleFiles().map(([, to]) => to)

test("das Paket traegt die Einstiege, die Vorlage und das Handbuch", () => {
  const t = targets()
  for (const f of ["llms.txt", "AGENTS.md", "spec/README.md", "spec/modules/shared-components.md", "spec/modules/template.md", "handbuch/de/erste-app.mdx", "handbuch/en/erste-app.mdx"]) {
    assert.ok(t.includes(f), f)
  }
})

// Die Liste kommt aus dem Spec-Index, nicht von Hand: eine neue Spec-Datei
// landet im Paket, sobald sie im Index steht.
test("jede Markdown-Datei des Spec-Index liegt im Paket", () => {
  const t = targets()
  for (const d of specDocs()) {
    if (d.href.endsWith(".md")) assert.ok(t.includes(`spec/${d.href}`), d.href)
  }
})

test("jede Quelle existiert, kein Ziel doppelt", () => {
  const files = bundleFiles()
  for (const [from] of files) assert.ok(existsSync(resolve(root, from)), from)
  const t = files.map(([, to]) => to)
  assert.equal(new Set(t).size, t.length)
})

test("writeBundle schreibt die Dateien, eine README mit Version und raeumt Altes weg", () => {
  const dir = mkdtempSync(join(tmpdir(), "toolkit-docs-"))
  writeFileSync(join(dir, "veraltet.md"), "aus einer frueheren Version")
  const n = writeBundle(dir, "9.9.9")
  assert.equal(n, bundleFiles().length)
  assert.ok(!existsSync(join(dir, "veraltet.md")))
  assert.equal(readFileSync(join(dir, "llms.txt"), "utf8"), readFileSync(resolve(root, "llms.txt"), "utf8"))
  const readme = readFileSync(join(dir, "README.md"), "utf8")
  assert.ok(readme.includes("9.9.9"), "README names the package version")
  assert.ok(readme.includes("AGENTS.md") && readme.includes("spec/01-app-composition.md"), "README gives the reading order")
})

test("das Toolkit packt die Doku beim Packen mit ein", () => {
  const pkg = JSON.parse(readFileSync(resolve(root, "packages/toolkit/package.json"), "utf8"))
  assert.ok(pkg.files.includes("docs/stack"), "files contains docs/stack")
  assert.match(pkg.scripts.prepack ?? "", /scripts\/agents\/bundle\.mjs/)
})
