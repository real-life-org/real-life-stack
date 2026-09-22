#!/usr/bin/env node
/**
 *   node scripts/agents/generate.mjs           schreibt llms.txt und den Code-Block des App-Templates
 *   node scripts/agents/generate.mjs --check   faellt, wenn eines davon nicht mehr zum Repo passt
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { packages, renderLlms, renderTemplate, root, specDocs } from "./lib.mjs"

const targets = [
  ["llms.txt", renderLlms],
  ["docs/templates/AGENTS.md", () => renderTemplate()],
]
const errors = []
for (const p of packages()) if (!p.description) errors.push(`${p.name}: package.json has no description (llms.txt lists it)`)
if (specDocs().length < 10) errors.push(`docs/spec/README.md: only ${specDocs().length} spec rows found — table format changed?`)
if (errors.length) { console.error(`agent entry points: ${errors.length} problem(s)\n${errors.map((e) => `  ${e}`).join("\n")}`); process.exit(1) }

const check = process.argv.includes("--check")
let stale = 0
for (const [file, render] of targets) {
  const out = render()
  let current = ""
  try { current = readFileSync(resolve(root, file), "utf8") } catch { /* fehlt */ }
  if (current === out) continue
  if (check) { console.error(`agent entry points: ${file} is stale — run pnpm docs:agents`); stale++ }
  else { writeFileSync(resolve(root, file), out); console.log(`agent entry points: wrote ${file}`) }
}
if (stale) process.exit(1)
if (check) console.log(`agent entry points: ${targets.map(([f]) => f).join(", ")} up to date`)
