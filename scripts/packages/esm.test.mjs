import assert from "node:assert/strict"
import { readdirSync, existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { test } from "node:test"

/**
 * Jedes veroeffentlichte Paket muss sich in reinem Node-ESM laden lassen —
 * nicht nur in Vite. Die Pakete, die mit `tsc` bauen, kopieren relative
 * Importe aus dem Quelltext; ein `from "./x"` ohne Endung loest Vite auf,
 * Node nicht (ERR_MODULE_NOT_FOUND). Genau so lag mock-connector 0.2.0 auf
 * npm, und der Handbuch-Test der ersten App fiel damit (23.09.2026).
 * Laeuft nach `pnpm test` (turbo hat die dists gebaut).
 */
const root = resolve(new URL("../../", import.meta.url).pathname)
const packages = readdirSync(resolve(root, "packages")).filter((d) => existsSync(resolve(root, "packages", d, "package.json")))

for (const dir of packages) {
  const pkg = JSON.parse(readFileSync(resolve(root, "packages", dir, "package.json"), "utf8"))
  if (pkg.private) continue
  const entries = Object.entries(pkg.exports ?? {}).filter(([, v]) => v && typeof v === "object" && v.import).map(([k, v]) => [k, v.import])
  test(`${pkg.name} loads in plain Node ESM`, async () => {
    for (const [subpath, file] of entries) {
      const target = resolve(root, "packages", dir, file)
      assert.ok(existsSync(target), `${pkg.name}${subpath.slice(1)}: ${file} missing — build first`)
      // Fehlt eine Endung, faellt genau dieser Import mit ERR_MODULE_NOT_FOUND.
      // Ein Paket, das beim Laden `document` anfasst (Toolkit, WoT-Komponenten),
      // ist aufgeloest — das ist ein ReferenceError ohne Node-Fehlercode, kein Befund.
      await import(pathToFileURL(target).href).catch((e) => {
        if (typeof e?.code === "string" && e.code.startsWith("ERR_")) throw new Error(`${pkg.name}${subpath.slice(1)}: ${e.code} ${e.message}`)
      })
    }
  })
}
