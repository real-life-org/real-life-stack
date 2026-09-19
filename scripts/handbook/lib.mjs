import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
export const root = new URL('../../', import.meta.url)
export const read = (p) => readFileSync(new URL(p, root), 'utf8')
export const hash = (text) => createHash('sha256').update(text).digest('hex')
export function parse(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) throw new Error('Missing JSON frontmatter')
  return { meta: JSON.parse(match[1]), body: text.slice(match[0].length) }
}
export function pages() {
  return ['de', 'en'].flatMap((lang) =>
    readdirSync(new URL(`docs/handbook/${lang}/`, root))
      .filter((f) => f.endsWith('.mdx'))
      .map((file) => {
        const path = `docs/handbook/${lang}/${file}`,
          text = read(path)
        return { path, lang, id: file.slice(0, -4), text, ...parse(text) }
      }),
  )
}
export function validatePage(page, { files, terms, stories, routes, sources }) {
  const errors = []
  for (const file of page.meta.sources ?? [])
    if (!files(file)) errors.push(`Missing source: ${file}`)
  if (!page.meta.sources?.length) errors.push('No sources declared')
  for (const term of page.meta.terms ?? [])
    if (!terms.has(term)) errors.push(`Unknown term: ${term}`)
  const usedStories = [...page.body.matchAll(/<Story\s+id="([^"]+)"/g)].map(
    (m) => m[1],
  )
  for (const id of [...(page.meta.stories ?? []), ...usedStories])
    if (!stories.has(id)) errors.push(`Missing story: ${id}`)
  for (const id of usedStories)
    if (!page.meta.stories?.includes(id)) errors.push(`Undeclared story: ${id}`)
  for (const [, link] of page.body.matchAll(
    /(?:\]\(|href=")\/docs\/([^#)"]*)/g,
  ))
    if (!routes.has(link.replace(/\/$/, '')))
      errors.push(`Missing page: ${link}`)
  if (
    page.lang === 'en' &&
    page.meta.sourceHash !== hash(sources(page.meta.translationOf))
  )
    errors.push('Translation requires review: sourceHash changed')
  return errors
}

export function contentHash() {
  return hash(
    pages()
      .map((p) => p.text)
      .join('\n') +
      read('docs/reference/terms.json') +
      read('examples/handbook-app/src/App.tsx'),
  )
}
export function localLinkErrors(html, currentPath, exists, readTarget) {
  const errors = []
  for (const [, href] of html.matchAll(/(?:href|src)="([^"<>]+)"/g)) {
    const url = new URL(
      href.replaceAll('&amp;', '&'),
      `https://handbook.test${currentPath}`,
    )
    if (
      url.origin !== 'https://handbook.test' ||
      !url.pathname.startsWith('/docs/')
    )
      continue
    const path =
      url.pathname.slice(6) + (url.pathname.endsWith('/') ? 'index.html' : '')
    if (!exists(path)) {
      errors.push(`Broken built link: ${href}`)
      continue
    }
    if (
      url.hash &&
      path.endsWith('.html') &&
      !readTarget(path).includes(
        `id="${decodeURIComponent(url.hash.slice(1))}"`,
      )
    )
      errors.push(`Missing anchor: ${href}`)
  }
  return errors
}
