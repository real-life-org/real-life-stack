import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { root, read, pages, route } from './lib.mjs'

/**
 * Vor jedem Build der Site: Build-Stand und die Markdown-Ausgabe des Handbuchs
 * fuer Agenten (dieselben Seiten als reiner Text, Beispielcode eingebettet) —
 * plus `llms.txt` als Inhaltsverzeichnis. Alles landet in `apps/site/public`,
 * das nur erzeugt und nie eingecheckt wird.
 */
const write = (path, text) => {
  const url = new URL(path, root)
  mkdirSync(new URL('.', url), { recursive: true })
  writeFileSync(url, text)
}
const git = (args) => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim() } catch { return '' } }
const version = (path) => JSON.parse(read(path)).version
const info = {
  commit: git(['rev-parse', 'HEAD']) || 'unbekannt',
  dirty: !!git(['status', '--porcelain']),
  app: version('apps/reference/package.json'),
  toolkit: version('packages/toolkit/package.json'),
  dataInterface: version('packages/data-interface/package.json'),
}
rmSync(new URL('apps/site/public', root), { recursive: true, force: true })
write('apps/site/public/build-info.json', JSON.stringify(info, null, 2))
write('apps/site/public/favicon.svg', read('apps/reference/public/favicon.svg'))

const all = pages()
for (const p of all) {
  const body = p.body
    .replace(/^import .+;?\n/gm, '')
    .replace(/<Source file="([^"]+)"[^>]*\/>/g, (_, file) => `\n\`\`\`tsx\n${read(file)}\`\`\`\n`)
    .replace(/<Story id="([^"]+)" title="([^"]+)"[^>]*\/>/g, (_, id, title) => `[${title}](https://real-life-stack.de/storybook/?path=/story/${id})`)
    .replace(/<LinkCard title="([^"]+)" description="([^"]+)" href="([^"]+)" \/>/g, (_, title, description, href) => `- [${title}](${href}): ${description}`)
    .replace(/<\/?CardGrid>/g, '')
  write(
    `apps/site/public/markdown/${p.lang}/${p.id}.md`,
    `# ${p.meta.title}\n${body}\n${p.meta.sources?.length ? '## Quellen\n\n' + p.meta.sources.map((f) => `- https://github.com/real-life-org/real-life-stack/blob/master/${f}`).join('\n') + '\n' : ''}`,
  )
}
// Das Inhaltsverzeichnis fuer Agenten: das Repo-llms.txt zuerst (Pakete, Spec), dann das Handbuch.
write(
  'apps/site/public/llms.txt',
  read('llms.txt').trimEnd() +
    '\n\n## Handbook (German first; Markdown export of the site)\n\n' +
    all.map((p) => `- [${p.meta.title}](https://real-life-stack.de/markdown/${p.lang}/${p.id}.md) — ${route(p)}: ${p.meta.description ?? ''}`).join('\n') +
    '\n',
)
console.log(`Site vorbereitet: ${all.length} Handbuchseiten, Stand ${info.commit.slice(0, 8)}${info.dirty ? ' (Arbeitskopie)' : ''}`)
