import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    if ((await fetch('http://127.0.0.1:4322/docs/de/')).ok) break
  } catch {}
  if (attempt === 29)
    throw new Error('Start pnpm preview:handbook before this test')
  await new Promise((resolve) => setTimeout(resolve, 200))
}
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(
  'http://127.0.0.1:4322/storybook/iframe.html?id=rls-handbook-app--garden&viewMode=story',
)
await page.getByText('Erntefest', { exact: true }).click()
await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()

await page
  .getByPlaceholder('Titel', { exact: true })
  .fill('Erntefest gemeinsam')
await page.getByRole('button', { name: 'Speichern', exact: true }).click()
await page.getByRole('button', { name: 'Kalender', exact: true }).click()
await page.getByText('Erntefest gemeinsam', { exact: true }).first().waitFor()
assert.equal(
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).count(),
  1,
)
await page.getByRole('button', { name: 'Karte', exact: true }).click()
await page.locator('.maplibregl-canvas').waitFor()
// MapLibre renders markers in WebGL, not as DOM elements.
assert.equal(
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).count(),
  1,
)

await page.getByRole('button', { name: /Gemeinschaftsgarten/ }).click()
await page.getByRole('menuitem', { name: /Offene Werkstatt/ }).click()
assert.equal(
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).count(),
  0,
)
await page.getByRole('button', { name: 'Feed', exact: true }).click()
await page.getByText('Reparaturtreff', { exact: true }).waitFor()
assert.equal(
  await page.getByText('Erntefest gemeinsam', { exact: true }).count(),
  0,
)
await page.goto(
  'http://127.0.0.1:4322/storybook/iframe.html?id=rls-handbook-app--read-only&viewMode=story',
)
await page.getByText('Erntefest', { exact: true }).click()
assert.equal(
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).count(),
  0,
)
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(
  'http://127.0.0.1:4322/storybook/iframe.html?id=rls-handbook-app--garden&viewMode=story',
)
await page.getByText('Erntefest', { exact: true }).click()
await page.getByRole('button', { name: 'Bearbeiten', exact: true }).waitFor()

assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  'mobile story overflow',
)
await page.goto('http://127.0.0.1:4322/docs/de/glossar/')

assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  'mobile docs overflow',
)
console.log(
  'PASS: edit → calendar → map → space switch; read-only; mobile drawer and glossary. Errors:',
  errors,
)
await browser.close()
assert.deepEqual(errors, [])
