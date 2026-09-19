import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validatePage, hash, localLinkErrors } from './lib.mjs'
const context = {
  files: (p) => p === 'source.ts',
  terms: new Set(['app']),
  stories: new Set(['demo--default']),
  routes: new Set(['de']),
  sources: () => 'original',
}
const page = {
  lang: 'de',
  meta: { sources: ['source.ts'], terms: ['app'], stories: ['demo--default'] },
  body: '<Story id="demo--default" /> [Start](/docs/de/)',
}
test('valid references pass', () =>
  assert.deepEqual(validatePage(page, context), []))
for (const [name, mutation, expected] of [
  [
    'removed source',
    { meta: { ...page.meta, sources: ['removed.ts'] } },
    /Missing source/,
  ],
  ['renamed term', { meta: { ...page.meta, terms: ['lens'] } }, /Unknown term/],
  [
    'removed embedded story',
    { body: '<Story id="gone--default" />' },
    /Missing story/,
  ],
  ['broken internal link', { body: '[Gone](/docs/de/gone/)' }, /Missing page/],
  [
    'stale translation',
    {
      lang: 'en',
      meta: {
        ...page.meta,
        translationOf: 'source.ts',
        sourceHash: hash('old'),
      },
    },
    /Translation requires review/,
  ],
])
  test(name, () =>
    assert.match(
      validatePage({ ...page, ...mutation }, context).join('\n'),
      expected,
    ),
  )

test('built links catch a removed page and a renamed anchor', () => {
  const errors = localLinkErrors(
    '<a href="/docs/de/gone/">x</a><a href="/docs/de/#gone">y</a>',
    '/docs/de/',
    (p) => p === 'de/index.html',
    () => '<h1 id="start">Start</h1>',
  )
  assert.match(errors.join('\n'), /Broken built link/)
  assert.match(errors.join('\n'), /Missing anchor/)
})
test('built links accept a real anchor and external links', () => {
  assert.deepEqual(
    localLinkErrors(
      '<a href="/docs/de/#start">x</a><a href="https://example.org">y</a>',
      '/docs/de/',
      () => true,
      () => '<h1 id="start">Start</h1>',
    ),
    [],
  )
})
