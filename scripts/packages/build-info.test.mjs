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

test("gitHead reads the HEAD of the checkout that contains cwd", () => {
  const head = gitHead(fileURLToPath(new URL("../../", import.meta.url)))
  assert.match(head, /^[0-9a-f]{40}$/)
})
