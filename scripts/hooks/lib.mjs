import { readFileSync, readdirSync, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

/**
 * Die Hook-Referenz aus TSDoc (Plan D2, 22.09.2026): Jeder oeffentliche Hook
 * des Toolkits traegt einen Dokumentationskommentar mit festen Feldern; daraus
 * entsteht die Storybook-Seite „All hooks", und ein Waechter faellt, wenn ein
 * Hook ohne Block exportiert wird oder die Seite nicht mehr zum Code passt.
 */
export const root = fileURLToPath(new URL("../../", import.meta.url))
export const toolkitSrc = resolve(root, "packages/toolkit/src")

export const WITHOUT = ["—", "empty", "null", "value", "no-op", "throws on call", "throws on render"]
export const GROUPS = {
  read: "Read items", write: "Write items", people: "People, spaces and membership", permissions: "Permissions and capabilities",
  relations: "Relations", surface: "Surfaces and UI state", environment: "Environment", item: "Item properties",
}

/** Loest einen Modulpfad wie im Bundler auf: .ts, .tsx, /index.ts. */
function resolveModule(from, spec) {
  const base = resolve(dirname(from), spec)
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (existsSync(c) && !c.endsWith("/")) { try { if (readFileSync(c)) return c } catch { /* dir */ } }
  return null
}

/**
 * Welche `use…`-Funktionen das Paket nach aussen gibt — textlich ueber die
 * Export-Kette ab `src/index.ts` (und `src/router.tsx`), wie ein Bundler sie
 * liest. Kein TypeScript-Programm noetig, und kein gebautes `dist`.
 */
export function publicHooks(entries = ["index.ts", "router.tsx"]) {
  const found = new Map() // name → file
  const seen = new Set()
  const visit = (file, only) => {
    const key = `${file}|${only ? [...only].join(",") : "*"}`
    if (seen.has(key)) return
    seen.add(key)
    const src = readFileSync(file, "utf8")
    for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(use[A-Z]\w*)/g)) if (!only || only.has(m[1])) found.set(m[1], file)
    for (const m of src.matchAll(/export\s+const\s+(use[A-Z]\w*)\s*=/g)) if (!only || only.has(m[1])) found.set(m[1], file)
    for (const m of src.matchAll(/export\s+\*\s+from\s+["']([^"']+)["']/g)) { const t = resolveModule(file, m[1]); if (t) visit(t, only) }
    for (const m of src.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)) {
      const names = new Set(m[1].split(",").map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]).filter((n) => /^use[A-Z]/.test(n)))
      if (!names.size) continue
      const t = resolveModule(file, m[2]); if (t) visit(t, only ? new Set([...names].filter((n) => only.has(n))) : names)
    }
  }
  for (const e of entries) visit(resolve(toolkitSrc, e))
  return found
}

/** Der TSDoc-Block direkt ueber `export function <name>` in `file`, als Felder. */
export function hookDoc(file, name) {
  const src = readFileSync(file, "utf8")
  const re = new RegExp(String.raw`/\*\*((?:(?!\*/)[\s\S])*?)\*/\s*\nexport\s+(?:async\s+)?(?:function|const)\s+${name}\b`)
  const m = src.match(re)
  if (!m) return null
  const lines = m[1].split("\n").map((l) => l.replace(/^\s*\*? ?/, ""))
  const text = lines.join("\n").trim()
  const tags = {}
  const body = []
  for (const line of text.split("\n")) {
    const t = line.match(/^@(\w+)\s*(.*)$/)
    if (!t) { body.push(line); continue }
    if (t[1] === "see") { const s = t[2].match(/^(story|spec)\s+(\S+)(.*)$/); if (s) (tags[`see_${s[1]}`] ??= []).push(s[2]) ; continue }
    tags[t[1]] = t[2].trim()
  }
  const paragraphs = body.join("\n").trim().split(/\n\s*\n/)
  return { question: paragraphs[0]?.replace(/\s+/g, " ").trim() ?? "", rest: paragraphs.slice(1).join("\n\n").trim(), ...tags }
}

/** Was fehlt oder falsch ist — eine Zeile je Befund, leer ist gut. */
export function validate(name, doc) {
  const errors = []
  if (!doc) return [`${name}: no documentation comment`]
  if (!doc.question) errors.push(`${name}: first paragraph (the question) is missing`)
  if (!doc.answers) errors.push(`${name}: @answers is missing`)
  if (!doc.without) errors.push(`${name}: @without is missing`)
  else if (!WITHOUT.some((w) => doc.without === w || doc.without.startsWith(`${w} —`) || doc.without.startsWith(`${w} (`))) errors.push(`${name}: @without must start with one of ${WITHOUT.join(" | ")}, got "${doc.without}"`)
  if (!doc.group) errors.push(`${name}: @group is missing`)
  else if (!(doc.group in GROUPS)) errors.push(`${name}: @group must be one of ${Object.keys(GROUPS).join(", ")}, got "${doc.group}"`)
  return errors
}

/** Die Parameter eines Hooks, wie die Referenz sie zeigt: `filter?`, `id`, `options`. */
export function hookSignature(file, name) {
  const src = readFileSync(file, "utf8")
  const m = src.match(new RegExp(String.raw`export\s+(?:async\s+)?(?:function\s+${name}\s*(?:<[^(]*>)?\(|const\s+${name}\s*=\s*(?:<[^(]*>)?\()`))
  if (!m) return ""
  let i = m.index + m[0].length
  let depth = 1
  const start = i
  for (; i < src.length && depth > 0; i++) { const c = src[i]; if ("([{<".includes(c)) depth++; else if (")]}>".includes(c) && !(c === ">" && src[i - 1] === "=")) depth-- }
  const inner = src.slice(start, i - 1)
  const params = []
  let d = 0, cur = ""
  for (const c of inner) {
    if ("([{<".includes(c)) d++
    else if (")]}>".includes(c)) d--
    if (c === "," && d === 0) { params.push(cur); cur = "" } else cur += c
  }
  if (cur.trim()) params.push(cur)
  return params.map((p) => {
    const t = p.trim()
    if (/^[{[]/.test(t)) return /=\s*\{\s*\}\s*$|=\s*\{/.test(t.split(":").slice(-1)[0] ?? "") || /\}\s*=/.test(t) ? "options?" : "options"
    const n = t.match(/^(\.\.\.)?(\w+)\s*(\?)?\s*(?::[^=]*)?(=)?/)
    if (!n) return t
    return `${n[1] ?? ""}${n[2]}${n[3] || n[4] ? "?" : ""}`
  }).join(", ")
}

/** Zeile, in der `export … <name>` steht — fuer den Quell-Link. */
export function hookLine(file, name) {
  const src = readFileSync(file, "utf8")
  const m = src.match(new RegExp(String.raw`export\s+(?:async\s+)?(?:function|const)\s+${name}\b`))
  return m ? src.slice(0, m.index).split("\n").length : 0
}

/** Storybooks `sanitize`: aus Titel oder Story-Name ein Id-Segment. */
export function sanitize(str) {
  return str.toLowerCase().replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, "-").replace(/-+/g, "-").replace(/^-+/, "").replace(/-+$/, "")
}

/** lodash `startCase`, wie Storybook den Story-Namen aus dem Export bildet: `CapabilityCheck` → `Capability Check`, `Item2` → `Item 2`. */
export function startCase(str) {
  const words = str.match(/[A-Z]{2,}(?=[A-Z][a-z]|\b|[0-9]|$)|[A-Z]?[a-z]+|[A-Z]|[0-9]+/g) ?? []
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
}

/** Den Ausdruck hinter `as`, `satisfies`, Klammern und Bezeichnern aufloesen. */
function unwrap(expr, decls) {
  const seen = new Set()
  while (expr) {
    if (ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isParenthesizedExpression(expr) || ts.isTypeAssertionExpression(expr)) { expr = expr.expression; continue }
    if (ts.isIdentifier(expr)) { if (seen.has(expr.text)) return null; seen.add(expr.text); expr = decls.get(expr.text); continue }
    return expr
  }
  return null
}

/**
 * Die Story-Ids EINER CSF-Datei, wie Storybook sie bildet: `<meta.id | sanitize(meta.title)>--<sanitize(startCase(export))>`
 * fuer jeden benannten Export, dazu `--docs` bei `tags: ["autodocs"]`. Gelesen aus dem
 * Syntaxbaum — das exportierte Meta, nicht die erste `id:` in der Datei (rls#438:
 * vorher gewann eine Fixture-Id wie `event-1`, und blosse Meta-Ids galten als Story).
 */
export function storyIdsOf(src, file = "story.tsx") {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const decls = new Map()
  const named = []
  let metaExpr = null
  const isExported = (st) => ts.canHaveModifiers(st) && (ts.getModifiers(st) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue
        decls.set(d.name.text, d.initializer)
        if (isExported(st)) named.push(d.name.text)
      }
    } else if (ts.isFunctionDeclaration(st) && st.name && isExported(st)) {
      if (!(ts.getModifiers(st) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) named.push(st.name.text)
    } else if (ts.isExportAssignment(st) && !st.isExportEquals) metaExpr = st.expression
  }
  const meta = unwrap(metaExpr, decls)
  if (!meta || !ts.isObjectLiteralExpression(meta)) return new Set()
  const prop = (name) => meta.properties.find((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name)?.initializer
  const str = (e) => (e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e.text : null)
  const base = str(prop("id")) ?? (str(prop("title")) ? sanitize(str(prop("title"))) : null)
  if (!base) return new Set()
  const ids = new Set(named.map((n) => `${base}--${sanitize(startCase(n))}`))
  const tags = prop("tags")
  if (tags && ts.isArrayLiteralExpression(tags) && tags.elements.some((e) => str(e) === "autodocs")) ids.add(`${base}--docs`)
  return ids
}

/** Alle Story-Ids unter `dir` — ohne gebautes Storybook pruefbar, was der Waechter braucht. */
export function storyIds(dir = toolkitSrc) {
  const ids = new Set()
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = resolve(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith(".stories.tsx")) for (const id of storyIdsOf(readFileSync(p, "utf8"), p)) ids.add(id)
    }
  }
  walk(dir)
  return ids
}

/** Die vollstaendige Referenz: je Hook Name, Signatur, Felder, Quelle. Sortiert nach Gruppe, dann Datei-Reihenfolge. */
export function reference(hooks = publicHooks()) {
  const rows = []
  for (const [name, file] of hooks) {
    const doc = hookDoc(file, name)
    const errors = validate(name, doc)
    const source = file.slice(root.length)
    rows.push({ name, signature: hookSignature(file, name), source, line: hookLine(file, name), ...(doc ?? {}), errors })
  }
  const order = Object.keys(GROUPS)
  rows.sort((a, b) => (order.indexOf(a.group) - order.indexOf(b.group)) || a.source.localeCompare(b.source) || a.line - b.line)
  return rows
}

/** Befunde ueber die ganze Referenz: Felder, Story-Ids, Spec-Dateien. */
export function checkReference(rows, { stories = storyIds() } = {}) {
  const errors = []
  for (const r of rows) {
    errors.push(...r.errors)
    for (const s of r.see_story ?? []) if (!stories.has(s)) errors.push(`${r.name}: @see story ${s} — no such story`)
    for (const s of r.see_spec ?? []) if (!existsSync(resolve(root, s))) errors.push(`${r.name}: @see spec ${s} — no such file`)
  }
  return errors
}
