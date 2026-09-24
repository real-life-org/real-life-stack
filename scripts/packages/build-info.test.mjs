import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import { buildInfo, gitHead } from "../build-info.mjs"

const pkg = () => { const d = mkdtempSync(join(tmpdir(), "build-info-")); const p = join(d, "package.json"); writeFileSync(p, '{"version":"1.2.3"}'); return p }

// rls#462 (Codex): Der Event-SHA darf den Checkout nicht ueberschreiben.
test("commit comes from the checkout, not from GITHUB_SHA", () => {
  const info = buildInfo(pkg(), { env: { GITHUB_SHA: "a".repeat(40), VITE_UPDATE_CHANNEL: "android-foss" }, revParse: () => "b".repeat(40) })
  assert.deepEqual(info, { version: "1.2.3", commit: "bbbbbbb", channel: "android-foss" })
})

test("GITHUB_SHA is only the fallback without git; nothing yields no commit", () => {
  const noGit = () => { throw new Error("git: not found") }
  assert.equal(buildInfo(pkg(), { env: { GITHUB_SHA: "c".repeat(40) }, revParse: noGit }).commit, "ccccccc")
  const bare = buildInfo(pkg(), { env: {}, revParse: noGit })
  assert.equal(bare.commit, undefined)
  assert.equal(bare.channel, undefined)
})

// Im Container-Build gibt es kein git: `node:22-alpine` bringt keines mit, und
// der Build-Kontext ist ohnehin kein Checkout. Ohne einen ausdruecklich
// gereichten Commit lieferte das Image nur die Version — genau so stand
// reallife.network am 24.09.2026 mit einer Build-Zeile ohne Commit da.
test("RLS_BUILD_COMMIT ist die Quelle, wo es kein git gibt", () => {
  const noGit = () => { throw new Error("git: not found") }
  const info = buildInfo(pkg(), { env: { RLS_BUILD_COMMIT: "d".repeat(40) }, revParse: noGit })
  assert.equal(info.commit, "ddddddd")
})

// Es ist der Commit des TATSAECHLICH gebauten Baums — der Workflow ermittelt
// ihn dort, wo git noch da ist, und reicht ihn als Build-Arg herein. Deshalb
// darf er auch den Git-Stand ueberschreiben: im Image ist er der genauere.
test("RLS_BUILD_COMMIT hat Vorrang vor git und vor GITHUB_SHA", () => {
  const info = buildInfo(pkg(), {
    env: { RLS_BUILD_COMMIT: "d".repeat(40), GITHUB_SHA: "a".repeat(40) },
    revParse: () => "b".repeat(40),
  })
  assert.equal(info.commit, "ddddddd")
})

// Ein leeres Build-Arg (`BUILD_COMMIT=""` als Docker-Standard) darf nicht als
// gesetzt gelten, sonst verdeckt es den Git-Stand mit nichts.
test("leeres RLS_BUILD_COMMIT zaehlt als nicht gesetzt", () => {
  const info = buildInfo(pkg(), { env: { RLS_BUILD_COMMIT: "" }, revParse: () => "b".repeat(40) })
  assert.equal(info.commit, "bbbbbbb")
})

test("gitHead reads the HEAD of the checkout that contains cwd", () => {
  const head = gitHead(fileURLToPath(new URL("../../", import.meta.url)))
  assert.match(head, /^[0-9a-f]{40}$/)
})
