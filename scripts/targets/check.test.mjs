import { test } from "node:test"
import assert from "node:assert/strict"
import { findings, inScope, RESOLVER } from "./lib.mjs"

test("meldet das Zerlegen außerhalb des Auflösers", () => {
  const src = [
    'const id = t.startsWith("item:") ? t.slice("item:".length) : null',
    "const q = parseQualifiedItemTarget(t)",
    "const ok = `item:${id}`",
  ].join("\n")
  assert.deepEqual(findings("packages/toolkit/src/x.ts", src).map((f) => f.line), [1, 2])
})

test("der Auflöser selbst und markierte Zeilen sind erlaubt", () => {
  assert.deepEqual(findings(RESOLVER, "parseLocalItemTarget(t)"), [])
  assert.deepEqual(findings("packages/toolkit/src/g.ts", 'n.startsWith("item:") // targets: kein Target — Knoten-Id'), [])
})

test("Kommentare zählen nicht; Tests und Stories sind nicht im Umfang", () => {
  assert.deepEqual(findings("packages/toolkit/src/x.ts", '// früher: t.startsWith("item:")'), [])
  assert.equal(inScope("packages/toolkit/src/a.stories.tsx"), false)
  assert.equal(inScope("packages/toolkit/tests/a.test.ts"), false)
  assert.equal(inScope("packages/toolkit/src/lib/a.ts"), true)
})
