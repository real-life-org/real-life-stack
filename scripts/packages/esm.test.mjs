import assert from "node:assert/strict"
import { mkdtempSync, readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { test } from "node:test"

/**
 * Jedes veroeffentlichte Paket muss sich in reinem Node-ESM laden lassen —
 * nicht nur in Vite. Die Pakete, die mit `tsc` bauen, kopieren relative
 * Importe aus dem Quelltext; ein `from "./x"` ohne Endung loest Vite auf,
 * Node nicht (ERR_MODULE_NOT_FOUND). Genau so lag mock-connector 0.2.0 auf
 * npm, und der Handbuch-Test der ersten App fiel damit (23.09.2026).
 * Laeuft nach `pnpm test` (turbo hat die dists gebaut).
 */
const root = fileURLToPath(new URL("../../", import.meta.url))

/**
 * Was beim Laden passieren darf: nur der Griff nach einem Browser-Global
 * (Toolkit, WoT-Komponenten fassen `document` beim Import an). Alles andere —
 * fehlende Datei, fehlender benannter Export (SyntaxError ohne Code), Fehler
 * im Modulkoerper — ist ein Befund.
 */
export function tolerable(e) {
  return e instanceof ReferenceError && /\b(document|window|navigator|self|localStorage|HTMLElement)\b is not defined/.test(e.message)
}

async function loads(target) {
  try { await import(pathToFileURL(target).href) } catch (e) { if (!tolerable(e)) throw e }
}

const packages = readdirSync(resolve(root, "packages")).filter((d) => existsSync(resolve(root, "packages", d, "package.json")))
for (const dir of packages) {
  const pkg = JSON.parse(readFileSync(resolve(root, "packages", dir, "package.json"), "utf8"))
  if (pkg.private) continue
  const entries = Object.entries(pkg.exports ?? {}).filter(([, v]) => v && typeof v === "object" && v.import).map(([k, v]) => [k, v.import])
  test(`${pkg.name} loads in plain Node ESM`, async () => {
    for (const [subpath, file] of entries) {
      const target = resolve(root, "packages", dir, file)
      assert.ok(existsSync(target), `${pkg.name}${subpath.slice(1)}: ${file} missing — build first`)
      await loads(target).catch((e) => { throw new Error(`${pkg.name}${subpath.slice(1)}: ${e.code ?? e.name} ${e.message}`) })
    }
  })
}

// Der Waechter muss beissen: ein dist mit Import ohne Endung, ein dist mit
// fehlendem benannten Export, und der erlaubte Fall.
test("the guard rejects a missing extension and a missing export, tolerates a browser global", async () => {
  const dir = mkdtempSync(join(tmpdir(), "esm-guard-"))
  writeFileSync(join(dir, "package.json"), '{"type":"module"}')
  writeFileSync(join(dir, "helper.js"), "export const a = 1\n")
  writeFileSync(join(dir, "no-ext.js"), 'export * from "./helper"\n')
  writeFileSync(join(dir, "no-export.js"), 'import { b } from "./helper.js"\nexport { b }\n')
  writeFileSync(join(dir, "dom.js"), "export const x = document.title\n")
  await assert.rejects(loads(join(dir, "no-ext.js")), (e) => e.code === "ERR_MODULE_NOT_FOUND")
  await assert.rejects(loads(join(dir, "no-export.js")), (e) => e instanceof SyntaxError)
  await loads(join(dir, "dom.js"))
  assert.equal(tolerable(new ReferenceError("document is not defined")), true)
  assert.equal(tolerable(new ReferenceError("foo is not defined")), false)
})
