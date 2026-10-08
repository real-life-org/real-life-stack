import assert from "node:assert/strict"
import { readdirSync, readFileSync, realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { test } from "node:test"

/**
 * Das gebaute Toolkit importiert die Workspace-Pakete, von denen es abhängt,
 * statt eine eigene Kopie zu bündeln (real-life-stack#555). Vorher steckte
 * data-interface ein zweites Mal im Toolkit-dist: `setTypeManifest` des
 * Toolkits band nur die Kopie, `getTypeManifest()` aus
 * `@real-life/data-interface` sah das Manifest ohne App-Schicht, und
 * jede App mit eigener Register-Schicht musste beide binden.
 * Läuft nach dem Toolkit-Build (`pnpm test` baut es über turbo).
 */
const root = fileURLToPath(new URL("../../", import.meta.url))
const toolkitDir = resolve(root, "packages/toolkit")
const dist = resolve(toolkitDir, "dist")
const pkg = JSON.parse(readFileSync(resolve(toolkitDir, "package.json"), "utf8"))
const workspaceDeps = Object.entries(pkg.dependencies ?? {})
  .filter(([, range]) => String(range).startsWith("workspace:"))
  .map(([name]) => name)

const distJs = readdirSync(dist).filter((f) => f.endsWith(".js"))
const distSource = distJs.map((f) => readFileSync(resolve(dist, f), "utf8")).join("\n")

test("data-interface is a runtime dependency of the toolkit, not a dev dependency", () => {
  assert.ok(workspaceDeps.includes("@real-life/data-interface"), "dependencies must list @real-life/data-interface")
  assert.equal(pkg.devDependencies?.["@real-life/data-interface"], undefined)
})

test("every workspace dependency is imported by the dist, not bundled", () => {
  for (const name of workspaceDeps) {
    const escaped = name.replace(/[/.]/g, "\\$&")
    assert.ok(new RegExp(`from\\s*["']${escaped}(/[^"']*)?["']`).test(distSource), `${name}: no import in toolkit dist`)
  }
  // Kennsätze aus composeTypeManifest (data-interface/src/type-manifest.ts):
  // stehen sie im Toolkit-dist, ist die Kopie wieder da.
  assert.ok(!/Typ-Manifest \[/.test(distSource), "toolkit dist carries a copy of composeTypeManifest")
  assert.ok(!/eine Typdefinition führt eine NEUE Id ein/.test(distSource), "toolkit dist carries a copy of composeTypeManifest")
})

test("setTypeManifest from the toolkit binds the manifest data-interface sees", async () => {
  // Das Toolkit fasst beim Import `document` an; jsdom stellt die Globals.
  const require = createRequire(resolve(toolkitDir, "package.json"))
  const { JSDOM } = require("jsdom")
  const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" })
  for (const key of ["window", "document", "navigator", "HTMLElement", "localStorage", "getComputedStyle", "matchMedia"]) {
    if (!(key in globalThis) && window[key] !== undefined) {
      Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true, writable: true })
    }
  }
  const toolkit = await import(pathToFileURL(resolve(dist, "index.js")).href)
  // Über den Symlink im Toolkit aufgelöst: dieselbe Datei, die das Toolkit-dist importiert.
  const diDir = realpathSync(resolve(toolkitDir, "node_modules/@real-life/data-interface"))
  const di = await import(pathToFileURL(resolve(diDir, "dist/src/index.js")).href)

  const composed = di.composeTypeManifest([di.TOOLKIT_TYPE_LAYER])
  assert.notEqual(di.getTypeManifest(), composed)
  toolkit.setTypeManifest(composed)
  assert.equal(di.getTypeManifest(), composed, "toolkit bound its own copy, data-interface did not see the manifest")
})
