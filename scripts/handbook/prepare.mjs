import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { root, read, pages, contentHash } from './lib.mjs'
const write = (path, text) => {
  const url = new URL(path, root)
  mkdirSync(new URL('.', url), { recursive: true })
  writeFileSync(url, text)
}
const version = (path) => JSON.parse(read(path)).version
const info = {
  contentHash: contentHash(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  app: version('apps/reference/package.json'),
  toolkit: version('packages/toolkit/package.json'),
  dataInterface: version('packages/data-interface/package.json'),
}
write('docs/reference/build-info.json', JSON.stringify(info, null, 2) + '\n')
// Generated directory only: removes stale English exports when leaving preview mode.
rmSync(new URL('apps/docs/public', root), { recursive: true, force: true })
write('apps/docs/public/build-info.json', JSON.stringify(info, null, 2))
write('apps/docs/public/favicon.svg', read('apps/landing/public/favicon.svg'))
const included = pages().filter(
  (p) => p.lang === 'de' || process.env.HANDBOOK_PREVIEW_EN === '1',
)
const terms = JSON.parse(read('docs/reference/terms.json'))
for (const p of included) {
  // Export readable Markdown: agents receive real example code, not MDX imports.
  const body = p.body
    .replace(/^import .+;?\n/gm, '')
    .replace(
      /<Source file="([^"]+)" \/>/g,
      (_, file) => `\n\`\`\`tsx\n${read(file)}\`\`\`\n`,
    )
    .replace(
      /<Story id="([^"]+)" title="([^"]+)"[^>]*\/>/g,
      (_, id, title) =>
        `[${title}](https://real-life-stack.de/storybook/?path=/story/${id})`,
    )
    .replace(
      /<LinkCard title="([^"]+)" description="([^"]+)" href="([^"]+)" \/>/g,
      (_, title, description, href) => `- [${title}](${href}): ${description}`,
    )
    .replace(/<\/?CardGrid>/g, '')
    .replace(
      /<Glossary \/>/g,
      terms
        .map(
          (t) =>
            `## ${t.label.de} (${t.label.en})\n\n${t.definition.de}\n\nCode: ${t.symbols.join(', ') || 'Kein einzelnes Code-Symbol'}\n`,
        )
        .join('\n'),
    )
    .replace(
      /<(?:Flow|Anatomy) \/>/g,
      'App → Instanz → App Shell → Space → Modul → Item-Vorschau → Detailansicht',
    )
  write(
    `apps/docs/public/markdown/${p.lang}/${p.id}.md`,
    `# ${p.meta.title}\n${body}\n## Quellen\n\n` +
      p.meta.sources
        .map(
          (file) =>
            `- https://github.com/real-life-org/real-life-stack/blob/master/${file}`,
        )
        .join('\n') +
      '\n',
  )
}
write(
  'apps/docs/public/llms.txt',
  '# Real Life Stack handbook\n\nGerman working edition. Normative contracts: /docs/de/pflege/.\n\n' +
    included
      .map(
        (p) =>
          `- [${p.meta.title}](/docs/markdown/${p.lang}/${p.id}.md): ${p.meta.description}`,
      )
      .join('\n') +
    '\n',
)
console.log(
  `Prepared ${included.length} handbook pages at ${info.commit.slice(0, 8)}${info.dirty ? ' (working tree)' : ''}`,
)
