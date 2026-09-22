import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { root, read, exists, pages, route, validatePage } from './lib.mjs'

/**
 * Prueft das Handbuch gegen das, was es verspricht: Quelldateien, Stories
 * (aus dem gebauten Storybook-Index, wenn vorhanden), Links zwischen den
 * Seiten, Uebersetzungen. Danach die gebaute Site: jeder lokale Link fuehrt
 * auf eine Datei. Faellt mit Liste, nie stumm.
 */
const errors = []
const all = pages()
const indexPath = 'packages/toolkit/storybook-static/index.json'
const stories = exists(indexPath) ? new Set(Object.keys(JSON.parse(read(indexPath)).entries)) : null
const routes = new Set(all.map(route))
for (const page of all) {
  for (const e of validatePage(page, {
    files: exists,
    stories: stories ?? { has: () => true },
    routes,
    sources: (p) => read(p),
  })) errors.push(`${page.path}: ${e}`)
}
if (!stories) console.warn('Hinweis: kein Storybook-Index (packages/toolkit/storybook-static) — Stories nicht geprueft')

const dist = fileURLToPath(new URL('apps/site/dist/', root))
if (existsSync(dist)) {
  const files = []
  const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); statSync(p).isDirectory() ? walk(p) : files.push(p) } }
  walk(dist)
  const has = (p) => existsSync(join(dist, p))
  for (const file of files.filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8')
    for (const [, href] of html.matchAll(/(?:href|src)="(\/[^"#?]+)/g)) {
      if (/^\/(app|storybook|edge|updates)\//.test(href)) continue // andere Builds im selben Pages-Deploy
      const target = href.endsWith('/') ? `${href}index.html` : href
      if (!has(target) && !has(`${href}/index.html`) && !has(`${href}.html`)) errors.push(`${file.slice(dist.length)}: Link ins Leere: ${href}`)
    }
  }
} else console.warn('Hinweis: apps/site/dist fehlt — gebaute Links nicht geprueft')

if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`Handbuch in Ordnung: ${all.length} Seiten${existsSync(dist) ? ', gebaute Links geprueft' : ''}`)
