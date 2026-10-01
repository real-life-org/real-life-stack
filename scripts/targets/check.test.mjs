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

test("verbietet interne Helfer, abgeschaltete Prüfung und selbst gebaute Kontexte", () => {
  const src = [
    'import { resolveTarget, targetItemId } from "../lib/item-targets"',
    "const a = allSpacesScope(undefined, carrier)",
    "const b = { carrierSpace: null, spaceOf }",
    "const c = sameSpaceScope()",
    "const d = sameSpaceScope() // targets: ein Bereich — begründet",
  ].join("\n")
  const lines = findings("packages/toolkit/src/x.ts", src).map((f) => f.line)
  assert.deepEqual(lines.sort(), [1, 2, 3, 4])
})

test("Formularzustand: Widgets importieren nur Typen, kein roher Setter, kein Export", async () => {
  const { formFindings, FORM_STATE } = await import("./lib.mjs")
  const widget = "packages/toolkit/src/components/composer/widgets/x.tsx"
  assert.deepEqual(formFindings(widget, 'import type { FieldAccess } from "../../../lib/form-state"'), [])
  assert.deepEqual(formFindings(widget, 'import { type FieldAccess } from "@/lib/form-state"'), [])
  assert.equal(formFindings(widget, 'import { useFormState, type FieldAccess } from "@/lib/form-state"').length, 1)
  assert.equal(formFindings(widget, 'import { useActionState } from "../../lib/form-state"').length, 1)
  assert.deepEqual(formFindings("packages/toolkit/src/components/composer/content-composer.tsx", 'import { useFormState } from "@/lib/form-state"'), [])
  assert.equal(formFindings(widget, "const updateMany = (patch) => setData(patch)").length, 1)
  assert.deepEqual(formFindings(widget, "// früher: updateMany"), [])
  assert.equal(formFindings("packages/toolkit/src/index.ts", 'export * from "./lib/form-state"').length, 1)
  assert.equal(formFindings("packages/toolkit/src/index.ts", 'export { useFormState } from "./lib/form-state"').length, 1)
  assert.deepEqual(formFindings(FORM_STATE, "export function useFormState() {}"), [])
})
