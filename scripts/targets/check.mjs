#!/usr/bin/env node
// pnpm check:targets — siehe lib.mjs.
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { findings, inScope, RESOLVER } from "./lib.mjs"

const files = execFileSync("git", ["ls-files", "packages/toolkit/src"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter(inScope)

let count = 0
for (const path of files) {
  for (const f of findings(path, readFileSync(path, "utf8"))) {
    count++
    console.error(`${path}:${f.line}: zerlegt ein Target außerhalb von ${RESOLVER}\n    ${f.text}`)
  }
}
if (count > 0) {
  console.error(`\n${count} Stelle(n). Das Ziel einer Kante bestimmt nur der Auflöser (resolveTarget, targetPointsTo, targetItemId aus lib/item-targets.ts; Spec 06, Verhältnis zu Relations, Regel 6).`)
  process.exit(1)
}
console.log(`Targets in Ordnung: ${files.length} Dateien, nur ${RESOLVER} zerlegt.`)
