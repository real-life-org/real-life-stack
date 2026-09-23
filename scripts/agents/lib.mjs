import { existsSync, readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Die Einstiege fuer Agenten aus einer Quelle (Plan D4, 22.09.2026):
 * `llms.txt` entsteht aus den Paketen, dem Spec-Index und den Hook-Kommentaren;
 * das App-Template traegt den Code der ersten App woertlich. Ein Waechter
 * faellt, wenn eines davon nicht mehr zum Repo passt.
 */
/**
 * Der Repo-Stamm: vom Arbeitsverzeichnis aufwaerts bis zur pnpm-workspace.yaml.
 * Nicht ueber import.meta.url — wenn die Site diese Datei buendelt, liegt der
 * Chunk unter apps/site/dist, und ../../ zeigte ins Leere.
 */
function findRoot() {
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir + "/"
    const up = resolve(dir, "..")
    if (up === dir) break
    dir = up
  }
  return fileURLToPath(new URL("../../", import.meta.url))
}
export const root = findRoot()
export const REPO = "https://github.com/real-life-org/real-life-stack/blob/master/"
const read = (p) => readFileSync(resolve(root, p), "utf8")

/** Die veroeffentlichten Pakete: Name, Version, Beschreibung aus package.json. */
export function packages() {
  const out = []
  for (const dir of readdirSync(resolve(root, "packages"))) {
    let pkg
    try { pkg = JSON.parse(read(`packages/${dir}/package.json`)) } catch { continue }
    if (pkg.private) continue
    out.push({ name: pkg.name, version: pkg.version, description: pkg.description ?? "", dir })
  }
  return out.sort((a, b) => (a.name.endsWith("data-interface") ? -1 : b.name.endsWith("data-interface") ? 1 : a.name.endsWith("toolkit") ? -1 : b.name.endsWith("toolkit") ? 1 : a.name.localeCompare(b.name)))
}

/** Die Spec-Dokumente aus den Tabellen in docs/spec/README.md: Datei, Status, Beschreibung. */
export function specDocs(text = read("docs/spec/README.md")) {
  const rows = []
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*?)\s*\|(?:\s*([^|]*?)\s*\|)?\s*$/)
    if (!m) continue
    const [, label, href, a, b] = m
    if (href.startsWith("http")) continue
    // Zwei Tabellenformen: | Datei | Status | Beschreibung | und | Datei | Beschreibung |
    rows.push(b !== undefined ? { label, href, status: a, description: b } : { label, href, status: "", description: a })
  }
  return rows
}

/** Die Modul-Referenz, wie scripts/modules sie erzeugt. */
export function modules() {
  return JSON.parse(read("packages/toolkit/src/lib/all-modules.json")).modules
}

/** Die Hook-Referenz, wie D2 sie erzeugt. */
export function hooks() {
  return JSON.parse(read("packages/toolkit/src/hooks/all-hooks.json")).groups
}

/**
 * llms.txt: Kopf (Hand), Pakete, Spec, Hooks, Schluss (Hand). Ohne Zeitstempel
 * und ohne Versionen — ein Release-Bump (release-please) darf die eingecheckte
 * Datei nicht veralten lassen (rls#443); die Version steht auf npm.
 */
export function renderLlms({ pkgs: pkgList = packages(), spec: specList = specDocs(), groups = hooks(), mods = modules() } = {}) {
  const head = read("scripts/agents/llms.head.md").trimEnd()
  const tail = read("scripts/agents/llms.tail.md").trimEnd()
  const pkgs = pkgList.map((p) => `- [${p.name}](https://www.npmjs.com/package/${p.name}): ${p.description}`).join("\n")
  const spec = specList.map((d) => `- [${d.label}](${REPO}docs/spec/${d.href})${d.status ? ` (${d.status})` : ""}: ${d.description}`).join("\n")
  const n = groups.reduce((s, g) => s + g.hooks.length, 0)
  const moduleLines = mods.map((m) => `- \`${m.id}\` (${m.label}): ${m.intro.replace(/\*\*/g, "")} presents: ${m.presents.length ? m.presents.map((p) => `\`${p}\``).join(", ") : "everything that stands as a card"}; loads: ${m.loads}${m.options.suggestType ? `; suggests \`${m.options.suggestType}\`` : ""}${m.spec ? `; spec: ${REPO}${m.spec}` : ""}; story: https://real-life-stack.de/storybook/?path=/docs/${m.story}`).join("\n")
  const hookLines = groups.map((g) => `### ${g.title}\n\n${g.hooks.map((h) => `- \`${h.name}(${h.signature})\` → ${h.answers}: ${h.question} Without capability: ${h.without}.`).join("\n")}`).join("\n\n")
  return [
    head,
    "## Packages (npm)\n\n" + pkgs,
    "## Specification (normative, German)\n\nThe spec is the single source of truth of the repository; when code and spec disagree, the spec wins. Index: " + REPO + "docs/spec/README.md\n\n" + spec,
    `## Modules (${mods.length}, generated from the module register)\n\nA module is a register entry plus a view; the host loads what a module presents and provides detail, create and the plus button. Register order is tab order. Reference: https://real-life-stack.de/reference/modules/\n\n` + moduleLines,
    `## Hooks (${n}, generated from the toolkit's documentation comments)\n\nEvery surface asks hooks, never the connector. Reading hooks answer empty without a capability; writing hooks fail on the call, not on render. Living examples: https://real-life-stack.de/storybook/?path=/docs/rls-foundations-all-hooks--docs\n\n` + hookLines,
    tail,
  ].join("\n\n") + "\n"
}

const START = "<!-- first-app:start -->"
const END = "<!-- first-app:end -->"

/** Das App-Template mit dem Code der ersten App zwischen den Markern. */
export function renderTemplate(current = read("docs/templates/AGENTS.md")) {
  const a = current.indexOf(START)
  const b = current.indexOf(END)
  if (a < 0 || b < 0 || b < a) throw new Error("docs/templates/AGENTS.md: markers first-app:start/end missing")
  const block = (file, title) => `\`\`\`tsx\n// ${title}\n${read(`examples/first-app/src/${file}`).trimEnd()}\n\`\`\``
  const generated = `${START}\n${block("main.tsx", "src/main.tsx — data and address")}\n\n${block("App.tsx", "src/App.tsx — the frame")}\n${END}`
  return current.slice(0, a) + generated + current.slice(b + END.length)
}
