import { execFileSync } from 'node:child_process'
import { pages, root } from './lib.mjs'
const base = process.argv[2]
if (!base)
  throw new Error('Usage: node scripts/handbook/impact.mjs <base-commit>')
const changed = new Set(
  execFileSync('git', ['diff', '--name-only', base, '--'], {
    cwd: root,
    encoding: 'utf8',
  })
    .trim()
    .split('\n'),
)
for (const page of pages()) {
  const hits = page.meta.sources.filter((p) => changed.has(p))
  if (hits.length) console.log(`${page.path} ← ${hits.join(', ')}`)
}
