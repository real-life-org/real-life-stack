import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { GROUPS, checkReference, hookDoc, hookSignature, publicHooks, reference, root, startCase, storyIds, storyIdsOf, validate } from "./lib.mjs"

const fixture = (src) => {
  const dir = mkdtempSync(join(tmpdir(), "hooks-"))
  const file = join(dir, "use-x.ts")
  writeFileSync(file, src)
  return file
}

test("hookDoc: Frage, Tags und see-Verweise aus dem Block direkt ueber dem Export", () => {
  const file = fixture(`/**
 * Which items match?
 *
 * Longer note.
 *
 * @answers \`{data}\`
 * @without empty — never throws
 * @group read
 * @see story rls-a--b
 * @see spec docs/spec/02-data-interface.md
 */
export function useX(filter?: string) {}
`)
  const d = hookDoc(file, "useX")
  assert.equal(d.question, "Which items match?")
  assert.equal(d.rest, "Longer note.")
  assert.equal(d.answers, "`{data}`")
  assert.equal(d.without, "empty — never throws")
  assert.equal(d.group, "read")
  assert.deepEqual(d.see_story, ["rls-a--b"])
  assert.deepEqual(d.see_spec, ["docs/spec/02-data-interface.md"])
  assert.equal(hookSignature(file, "useX"), "filter?")
})

test("hookDoc: ein Block, der nicht direkt ueber dem Export steht, zaehlt nicht", () => {
  const file = fixture(`/** Something else. */\nconst y = 1\nexport function useX() {}\n`)
  assert.equal(hookDoc(file, "useX"), null)
  assert.match(validate("useX", null)[0], /no documentation comment/)
})

test("validate: Pflichtfelder und Aufzaehlungen", () => {
  const ok = { question: "Q?", answers: "a", without: "null", group: "read" }
  assert.deepEqual(validate("useX", ok), [])
  assert.match(validate("useX", { ...ok, without: "maybe" })[0], /@without must start with/)
  assert.match(validate("useX", { ...ok, group: "misc" })[0], /@group must be one of/)
  assert.match(validate("useX", { ...ok, answers: "" })[0], /@answers is missing/)
  assert.deepEqual(validate("useX", { ...ok, without: "throws on call — see note" }), [])
})

test("hookSignature: Defaults, Rest und destrukturierte Parameter", () => {
  const file = fixture(`export function useX(a: Item, b = 1, ...rest: string[]) {}\nexport const useY = <T,>({ a, b }: Opts<T>, ids: string[]) => {}\nexport function useZ({ a }: Opts = {}) {}\n`)
  assert.equal(hookSignature(file, "useX"), "a, b?, ...rest")
  assert.equal(hookSignature(file, "useY"), "options, ids")
  assert.equal(hookSignature(file, "useZ"), "options?")
})

test("checkReference: fehlende Story oder Spec-Datei ist ein Befund", () => {
  const row = (extra) => ({ name: "useX", errors: [], ...extra })
  const stories = new Set(["rls-a--b"])
  assert.deepEqual(checkReference([row({ see_story: ["rls-a--b"], see_spec: ["docs/spec/02-data-interface.md"] })], { stories }), [])
  assert.match(checkReference([row({ see_story: ["rls-nope"] })], { stories })[0], /no such story/)
  assert.match(checkReference([row({ see_spec: ["docs/spec/nope.md"] })], { stories })[0], /no such file/)
})

// rls#438 (Codex): Die Story-Ids kommen aus dem exportierten Meta, nicht aus der
// ersten `id:` der Datei; eine blosse Meta-Id ist keine Story.
test("storyIdsOf: Fixture-Id vor dem Meta, Inline-Meta, Titel ohne Id, nackte Meta-Id", () => {
  const withFixture = `const EVENTS = [{ id: "event-1", data: {} }]
const meta: Meta<typeof X> = {
  id: "rls-modules-calendar",
  title: "RLS/Modules/Calendar",
  tags: ["autodocs"],
}
export default meta
export const Default: Story = {}
export const CapabilityCheck: Story = {}
`
  const ids = storyIdsOf(withFixture)
  assert.ok(ids.has("rls-modules-calendar--default"))
  assert.ok(ids.has("rls-modules-calendar--capability-check"))
  assert.ok(ids.has("rls-modules-calendar--docs"))
  assert.ok(!ids.has("rls-modules-calendar"), "a bare meta id is no story")
  assert.ok(!ids.has("event-1--default"))

  const inline = `export default { id: "rls-a", title: "T" } satisfies Meta
export const Full = {}
`
  assert.deepEqual([...storyIdsOf(inline)], ["rls-a--full"])

  const titled = `const meta = { title: "RLS/App shell/Navbar" } as Meta
export default meta
export const Item2 = {}
export function NotAStory() {}
`
  assert.deepEqual([...storyIdsOf(titled)].sort(), ["rls-app-shell-navbar--item-2", "rls-app-shell-navbar--not-a-story"])
})

test("startCase wie lodash: Story-Namen aus Exporten", () => {
  assert.equal(startCase("CapabilityCheck"), "Capability Check")
  assert.equal(startCase("Item2"), "Item 2")
  assert.equal(startCase("HTMLExport"), "HTML Export")
  assert.equal(startCase("withDraft"), "With Draft")
})

// Der Abgleich mit dem echten Build, wenn er da ist: jede berechnete Story
// existiert im Index, und jede Story des Index ist berechnet.
test("storyIds() matches the built Storybook index (skipped without a build)", (t) => {
  const index = resolve(root, "packages/toolkit/storybook-static/index.json")
  if (!existsSync(index)) return t.skip("no storybook-static/index.json")
  const built = new Set(Object.entries(JSON.parse(readFileSync(index, "utf8")).entries).filter(([, e]) => e.type === "story").map(([id]) => id))
  const computed = new Set([...storyIds()].filter((id) => !id.endsWith("--docs")))
  assert.deepEqual([...computed].filter((id) => !built.has(id)), [], "computed but not built")
  assert.deepEqual([...built].filter((id) => !computed.has(id)), [], "built but not computed")
})

// Der eigentliche Waechter, als Test: jeder exportierte Hook hat seinen Block,
// jede Gruppe ist bekannt, jede Story-Id existiert im Quelltext.
test("every public hook of the toolkit is documented", () => {
  const hooks = publicHooks()
  // 61 oeffentliche Hooks seit dem Schnitt oeffentlich/intern (23.09.2026); die Schwelle faengt eine kaputte Export-Aufloesung, nicht eine bewusste Kuerzung.
  assert.ok(hooks.size >= 50, `found only ${hooks.size} hooks — export resolution broken?`)
  // router.tsx exportiert seit dem Schnitt (23.09.2026) keinen Hook mehr; es bleibt Einstieg, falls einer dazukommt.
  assert.ok(hooks.has("useItems") && hooks.has("useModuleHost") && !hooks.has("useRegisterDetail"), "public hooks in, wiring out")
  const rows = reference(hooks)
  assert.deepEqual(checkReference(rows), [])
  assert.ok(storyIds().has("rls-foundations-hooks--read"))
  for (const g of Object.keys(GROUPS)) assert.ok(rows.some((r) => r.group === g), `group ${g} has no hook`)
})
