import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { sep } from 'node:path'
import { createHash } from 'node:crypto'

/** Gemeinsames der Site-Skripte: Wurzel, Lesen, Seiten des Handbuchs, Prüfregeln. */
export const root = new URL('../../', import.meta.url)
export const read = (p) => readFileSync(new URL(p, root), 'utf8')
export const exists = (p) => existsSync(new URL(p, root))
export const hash = (text) => createHash('sha256').update(text).digest('hex')

/** Frontmatter ist YAML im schlichten Fall `key: value` und JSON, wenn es mit `{` beginnt. */
export function parse(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) throw new Error('Frontmatter fehlt')
  const raw = match[1].trim()
  const meta = raw.startsWith('{') ? JSON.parse(raw) : parseYaml(raw)
  return { meta, body: text.slice(match[0].length) }
}

function parseYaml(raw) {
  const meta = {}
  let listKey = null
  for (const line of raw.split('\n')) {
    const item = line.match(/^\s+-\s+(.*)$/)
    if (item && listKey) { meta[listKey].push(unquote(item[1])); continue }
    const kv = line.match(/^([\w-]+):\s*(.*)$/)
    if (!kv) continue
    const [, key, value] = kv
    if (value === '' || value === '[]') { meta[key] = []; listKey = key; continue }
    if (value.startsWith('[')) { meta[key] = JSON.parse(value.replace(/'/g, '"')); listKey = null; continue }
    meta[key] = unquote(value); listKey = null
  }
  return meta
}
const unquote = (v) => v.replace(/^(['"])(.*)\1$/, '$2')

export const LANGS = ['de', 'en']

export function pages() {
  return LANGS.flatMap((lang) => {
    const dir = new URL(`docs/handbook/${lang}/`, root)
    if (!existsSync(dir)) return []
    // Rekursiv, wie der Astro-Loader: `handbuch/index.mdx` ist eine Seite mit
    // der Id `handbuch/index` — bis zum 22.09.2026 sah dieses Skript nur die
    // obersten Dateien und prüfte das Handbuch darum gar nicht (rls#434).
    return readdirSync(dir, { recursive: true })
      .map(String)
      .filter((f) => /\.mdx?$/.test(f))
      .sort()
      .map((file) => {
        const rel = file.split(sep).join("/")
        const path = `docs/handbook/${lang}/${rel}`
        const text = read(path)
        return { path, lang, id: rel.replace(/\.mdx?$/, ""), text, ...parse(text) }
      })
  })
}

/** Die Adresse einer Seite: Deutsch ohne Präfix, andere Sprachen mit; ein `index` fällt weg (`handbuch/index` → `/handbuch/`). */
export const route = (p) => {
  const slug = p.id.replace(/(^|\/)index$/, "")
  return `/${p.lang === 'de' ? '' : `${p.lang}/`}${slug ? `${slug}/` : ''}`
}

/**
 * Was eine Seite verspricht, muss es geben: genannte Quelldateien, eingebettete
 * Stories, verlinkte Seiten; eine Übersetzung muss zur Quelle passen.
 */
export function validatePage(page, { files, stories, routes, sources }) {
  const errors = []
  for (const file of page.meta.sources ?? []) if (!files(file)) errors.push(`Quelle fehlt: ${file}`)
  const used = [...page.body.matchAll(/<Story\s+id="([^"]+)"/g)].map((m) => m[1])
  for (const id of [...(page.meta.stories ?? []), ...used]) if (!stories.has(id)) errors.push(`Story fehlt: ${id}`)
  for (const id of used) if (!page.meta.stories?.includes(id)) errors.push(`Story nicht deklariert: ${id}`)
  for (const [, link] of page.body.matchAll(/(?:\]\(|href=")(\/(?:handbuch|en\/handbuch|datenschutz|en\/datenschutz)[^#)"]*)/g))
    if (!routes.has(link.replace(/\/?$/, '/'))) errors.push(`Seite fehlt: ${link}`)
  if (page.lang !== 'de' && page.meta.translationOf && page.meta.sourceHash !== hash(sources(page.meta.translationOf)))
    errors.push('Übersetzung prüfen: die Quelle hat sich geändert (sourceHash)')
  return errors
}
