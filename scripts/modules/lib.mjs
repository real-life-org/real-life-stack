import { existsSync, readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { storyIds } from "../hooks/lib.mjs"

/**
 * Die Modul-Referenz aus dem Register (Plan-Frage 8, Anton 23.09.2026: „die
 * Module ins Handbuch holen"): Was ein Modul zeigt (`presents`), wer laedt,
 * welche Optionen sein Eintrag kennt, seine Story und seine Spec — gelesen aus
 * dem Syntaxbaum von `module-register.ts`, nicht zur Laufzeit (das Toolkit
 * fasst beim Import `document` an). Dazu die Hinweis-Tabelle aus
 * data-interface: Hinweis → Filter, derselbe Vertrag, den der Host anwendet.
 */
export const root = fileURLToPath(new URL("../../", import.meta.url))
const read = (p) => readFileSync(resolve(root, p), "utf8")
export const REGISTER = "packages/toolkit/src/lib/module-register.ts"
export const HINTS = "packages/data-interface/src/module-hints.ts"

/** Storybook-Docs-Seite je Modul; nur die Liste heisst anders als ihre Id. */
const STORY_BY_ID = { collection: "rls-modules-list" }
export const storyFor = (id) => `${STORY_BY_ID[id] ?? `rls-modules-${id}`}--docs`

function literal(node) {
  if (!node) return undefined
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text)
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal)
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map((p) => [p.name.getText(), literal(p.initializer)]))
  if (ts.isIdentifier(node)) return { $ref: node.text }
  return undefined
}

/** Die sieben Eintraege von `TOOLKIT_MODULES`, in Registerreihenfolge. */
export function registerEntries(src = read(REGISTER)) {
  const sf = ts.createSourceFile("module-register.ts", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let arr = null
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== "TOOLKIT_MODULES" || !d.initializer) continue
      let e = d.initializer
      while (ts.isCallExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) e = ts.isCallExpression(e) ? e.arguments[0] : e.expression
      if (ts.isArrayLiteralExpression(e)) arr = e
    }
  }
  if (!arr) throw new Error(`${REGISTER}: TOOLKIT_MODULES not found`)
  return arr.elements.filter(ts.isObjectLiteralExpression).map((o) => {
    const e = literal(o)
    return {
      id: e.id, label: e.label, icon: e.icon?.$ref ?? null, view: e.view?.$ref ?? null,
      enabledByDefault: !!e.enabledByDefault, fill: e.fill ?? "container", panelFit: e.panelFit ?? "inset",
      maxWidth: e.maxWidth ?? null, keepMounted: !!e.keepMounted, presents: e.presents ?? [], loads: e.loads ?? "host", options: e.options ?? {},
    }
  })
}

/** Die Hinweis-Tabelle: Name → { key, filter } mit dem Filter als Quelltext. */
export function moduleHints(src = read(HINTS)) {
  const sf = ts.createSourceFile("module-hints.ts", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const hints = {}
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "registerModuleHint" && n.arguments.length === 2 && ts.isStringLiteral(n.arguments[0]) && ts.isObjectLiteralExpression(n.arguments[1])) {
      const def = {}
      for (const p of n.arguments[1].properties) {
        if (!ts.isPropertyAssignment(p) && !ts.isMethodDeclaration(p)) continue
        const name = p.name.getText()
        if (name === "key") def.key = literal(p.initializer)
        if (name === "filter") {
          const body = ts.isPropertyAssignment(p) && ts.isArrowFunction(p.initializer) ? p.initializer.body : p.body
          def.filter = body.getText().replace(/^\(|\)$/g, "").replace(/\s+/g, " ").trim()
        }
      }
      hints[n.arguments[0].text] = def
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return hints
}

/** Erster Absatz des JSDoc-Blocks ueber dem Meta der Modul-Story (Englisch, wie Storybook). */
export function storyIntro(storyId) {
  const dirs = ["packages/toolkit/src/modules", "packages/toolkit/src/components"]
  for (const dir of dirs) {
    const found = findStoryFile(resolve(root, dir), storyId.replace(/--docs$/, ""))
    if (!found) continue
    const src = readFileSync(found, "utf8")
    const block = src.match(/\/\*\*([\s\S]*?)\*\//)?.[1] ?? ""
    const text = block.split("\n").map((l) => l.replace(/^\s*\*\s?/, "")).join("\n").trim()
    return { file: found.slice(root.length), intro: text.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim() }
  }
  return { file: null, intro: "" }
}
function findStoryFile(dir, id) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name)
    if (e.isDirectory()) { const f = findStoryFile(p, id); if (f) return f; continue }
    if (!e.name.endsWith(".stories.tsx")) continue
    if (new RegExp(`^\\s*id:\\s*["']${id}["']`, "m").test(readFileSync(p, "utf8"))) return p
  }
  return null
}

/** Die ganze Referenz: Eintraege mit Hinweisen, Story, Spec und Einleitung. */
export function reference() {
  const hints = moduleHints()
  const stories = storyIds()
  const errors = []
  const modules = registerEntries().map((e) => {
    const story = storyFor(e.id)
    if (!stories.has(story)) errors.push(`${e.id}: story ${story} does not exist`)
    for (const h of e.presents) if (!hints[h]) errors.push(`${e.id}: presents "${h}" has no row in the hint table`)
    const spec = `docs/spec/modules/${e.id}.md`
    const { file, intro } = storyIntro(story)
    if (!intro) errors.push(`${e.id}: no intro paragraph in the story file`)
    return { ...e, hints: e.presents.map((h) => ({ name: h, key: hints[h]?.key ?? h, filter: hints[h]?.filter ?? "" })), story, storyFile: file, spec: existsSync(resolve(root, spec)) ? spec : null, intro }
  })
  return { modules, hints, errors }
}
