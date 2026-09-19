import { existsSync } from 'node:fs'
import {
  root,
  read,
  pages,
  validatePage,
  localLinkErrors,
  contentHash,
} from './lib.mjs'
const entries = JSON.parse(
  read('packages/toolkit/storybook-static/index.json'),
).entries
const terms = JSON.parse(read('docs/reference/terms.json'))
const all = pages(),
  errors = []
const context = {
  files: (p) => existsSync(new URL(p, root)),
  terms: new Set(terms.map((t) => t.id)),
  stories: new Set(Object.keys(entries)),
  routes: new Set([
    'llms.txt',
    ...all.map((p) =>
      `${p.lang}/${p.id === 'index' ? '' : p.id}`.replace(/\/$/, ''),
    ),
  ]),
  sources: (p) => read(p),
}
for (const page of all)
  for (const error of validatePage(page, context))
    errors.push(`${page.path}: ${error}`)
if (context.terms.size !== terms.length) errors.push('Duplicate glossary IDs')
for (const term of terms) {
  if (!context.files(term.spec)) errors.push(`Missing term spec: ${term.spec}`)
  if (!context.stories.has(term.story))
    errors.push(`Missing term story: ${term.id}: ${term.story}`)
}
for (const migration of JSON.parse(read('docs/reference/story-migration.json')))
  for (const id of migration.storyIds) {
    if (!entries[id]) errors.push(`Broken legacy story URL: ${id}`)
    else if (entries[id].title !== migration.title)
      errors.push(`Unexpected migrated title: ${id}`)
  }
for (const entry of Object.values(entries))
  if (
    !/^RLS\/(Einstieg|App|App Shell|Spaces|Module|Items|Grundlagen)\//.test(
      entry.title,
    )
  )
    errors.push(`Story outside UI hierarchy: ${entry.title}`)
const built = new URL('apps/docs/dist/de/index.html', root)
if (!existsSync(built)) errors.push('Handbook build missing')
if (
  process.env.HANDBOOK_PREVIEW_EN !== '1' &&
  existsSync(new URL('apps/docs/dist/en/index.html', root))
)
  errors.push('English leaked into German publication')
const dist = 'apps/docs/dist/'
for (const page of all.filter(
  (p) => p.lang === 'de' || process.env.HANDBOOK_PREVIEW_EN === '1',
)) {
  const path = `${page.lang}/${page.id === 'index' ? '' : page.id + '/'}index.html`
  if (!context.files(dist + path)) {
    errors.push(`Page not built: ${path}`)
    continue
  }
  for (const error of localLinkErrors(
    read(dist + path),
    `/docs/${path}`,
    (p) => context.files(dist + p),
    (p) => read(dist + p),
  ))
    errors.push(`${path}: ${error}`)
}
const manifest = JSON.parse(read(dist + 'build-info.json'))
if (manifest.contentHash !== contentHash())
  errors.push('Stale handbook build: content changed since build')
for (const [key, file] of [
  ['app', 'apps/reference/package.json'],
  ['toolkit', 'packages/toolkit/package.json'],
  ['dataInterface', 'packages/data-interface/package.json'],
]) {
  if (manifest[key] !== JSON.parse(read(file)).version)
    errors.push(`Stale version: ${key}`)
}
// Check public symbol names through TypeScript, including re-exported types.
const ts = (await import('typescript')).default
const entriesToCheck = [
  'packages/toolkit/src/index.ts',
  'packages/data-interface/src/index.ts',
]
const program = ts.createProgram(
  entriesToCheck.map((p) => new URL(p, root).pathname),
  {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
  },
)
const checker = program.getTypeChecker()
const exports = new Set(
  entriesToCheck.flatMap((p) =>
    checker
      .getExportsOfModule(
        checker.getSymbolAtLocation(
          program.getSourceFile(new URL(p, root).pathname),
        ),
      )
      .map((s) => s.name),
  ),
)
for (const term of terms)
  for (const symbol of term.symbols)
    if (!exports.has(symbol))
      errors.push(`Unknown public symbol: ${term.id}: ${symbol}`)
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else
  console.log(
    `Handbook: ${all.length} pages, ${terms.length} terms, ${Object.keys(entries).length} story entries verified.`,
  )
