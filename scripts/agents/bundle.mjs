#!/usr/bin/env node
/**
 *   node scripts/agents/bundle.mjs [ziel]   legt die Doku ins Toolkit-Paket (Standard: packages/toolkit/docs/stack)
 *
 * Laeuft als `prepack` des Toolkits, also bei `pnpm pack` im Publish-Workflow.
 * Ein Agent findet dann in node_modules/@real-life-stack/toolkit/docs/stack/
 * dieselben Regeln wie im Repo, und zwar in der Version, die er installiert hat,
 * nicht im Stand von master oder eines alten Checkouts (Karabirrdt, 13.09.2026).
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { root, specDocs } from "./lib.mjs"

const mdIn = (dir, ext) => readdirSync(resolve(root, dir)).filter((f) => f.endsWith(ext) && statSync(resolve(root, dir, f)).isFile()).sort()

/**
 * [Quelle, Ziel] relativ zum Repo bzw. zum Doku-Ordner. Die Spec-Dateien kommen
 * aus dem Spec-Index (dieselbe Liste wie in llms.txt); ein Verzeichnis im Index
 * bringt seine Markdown-Dateien mit, nicht seine Unterordner.
 */
export function bundleFiles() {
  const files = [
    ["llms.txt", "llms.txt"],
    ["docs/templates/AGENTS.md", "AGENTS.md"],
    ["docs/spec/README.md", "spec/README.md"],
  ]
  for (const d of specDocs()) {
    if (d.href.endsWith(".md")) files.push([`docs/spec/${d.href}`, `spec/${d.href}`])
    else if (d.href.endsWith("/")) for (const f of mdIn(`docs/spec/${d.href}`, ".md")) files.push([`docs/spec/${d.href}${f}`, `spec/${d.href}${f}`])
  }
  for (const lang of ["de", "en"]) {
    for (const f of mdIn(`docs/handbook/${lang}/handbuch`, ".mdx")) files.push([`docs/handbook/${lang}/handbuch/${f}`, `handbuch/${lang}/${f}`])
  }
  return files
}

const readme = (version) => `# Real Life Stack documentation, as of @real-life-stack/toolkit ${version}

A copy of the repository's documentation at the time this package was built. It matches the code next to it; the repository may already be further along.

Reading order for building an app:

1. \`AGENTS.md\` — the app template: packages, the first app as code, what stays with the app.
2. \`handbuch/de/erste-app.mdx\` (German) or \`handbuch/en/erste-app.mdx\` — the first app, every line explained.
3. \`spec/01-app-composition.md\` — frame, modules, module host (normative, German).
4. \`spec/modules/shared-components.md\` — preview, detail, composer, filters.
5. \`llms.txt\` — every package, spec file, module and hook in one list.

When something is missing, report it as a gap in the toolkit instead of building a second version in the app.

Links that point outside this folder (schemas, decisions, the site) resolve on GitHub: https://github.com/real-life-org/real-life-stack/tree/toolkit-v${version}
`

/** Schreibt die Doku nach `target` und gibt die Zahl der kopierten Dateien zurueck. */
export function writeBundle(target, version) {
  rmSync(target, { recursive: true, force: true })
  const files = bundleFiles()
  for (const [from, to] of files) {
    mkdirSync(dirname(join(target, to)), { recursive: true })
    copyFileSync(resolve(root, from), join(target, to))
  }
  writeFileSync(join(target, "README.md"), readme(version))
  return files.length
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = resolve(process.argv[2] ?? resolve(root, "packages/toolkit/docs/stack"))
  const { version } = JSON.parse(readFileSync(resolve(root, "packages/toolkit/package.json"), "utf8"))
  console.log(`toolkit docs: ${writeBundle(target, version)} files → ${target}`)
}
