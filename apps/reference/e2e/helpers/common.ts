import { type Browser, type BrowserContext, type Page, expect } from '@playwright/test'

export async function createFreshContext(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
    locale: 'de-DE',
  })
  const page = await context.newPage()

  return { context, page }
}

export async function navigateTo(page: Page, path = '/'): Promise<void> {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${path}${sep}connector=wot`
  await page.goto(url)

  // Clear IndexedDB to ensure fresh identity per context
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.() ?? []
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name)
    }
  }).catch(() => {})

  // Reload to pick up the clean state
  await page.goto(url)
}

/**
 * Complete the RLS WoT onboarding. Steps: Welcome → Seed → Verify → Profile → Password.
 *
 * Selects by `data-testid` (set in `@real-life/wot-connector/components`) and
 * by structure, never by wording — the onboarding texts are translated and
 * the helper must not depend on the language or the exact phrasing.
 */
export async function createIdentity(page: Page, opts: { name: string; passphrase: string }): Promise<{ mnemonic: string }> {
  await navigateTo(page, '/')

  // Step 1: Welcome → create identity
  const create = page.getByTestId('wot-onboarding-create')
  await create.waitFor({ timeout: 15_000 })
  await create.click()

  // Step 2: Seed — capture mnemonic words via the grid's copy button
  // (most reliable — uses the app's own copy logic)
  const seedStep = page.getByTestId('wot-onboarding-seed')
  await seedStep.waitFor({ timeout: 10_000 })
  await seedStep.getByRole('button').first().click()
  await page.waitForTimeout(300)
  const mnemonic = await page.evaluate(() => navigator.clipboard.readText())
  const words = mnemonic.split(' ')

  // Check all three checkboxes
  await page.getByTestId('wot-onboarding-check-written').check()
  await page.getByTestId('wot-onboarding-check-safe').check()
  await page.getByTestId('wot-onboarding-check-understand').check()
  await page.getByTestId('wot-onboarding-to-verify').click()

  // Step 3: Verify — each row is "<label with the word number> <input>"
  const verifyStep = page.getByTestId('wot-onboarding-verify')
  await verifyStep.waitFor({ timeout: 10_000 })
  const verifyInputs = verifyStep.locator('input[type="text"]')
  const inputCount = await verifyInputs.count()
  for (let i = 0; i < inputCount; i++) {
    const input = verifyInputs.nth(i)
    const labelText = await input.locator('xpath=preceding-sibling::*[1]').textContent()
    const wordNum = parseInt(labelText?.match(/(\d+)/)?.[1] ?? '0')
    if (wordNum > 0 && wordNum <= words.length) {
      await input.fill(words[wordNum - 1])
    }
  }

  // Step 4: Profile — enter name
  const nameInput = page.getByTestId('wot-onboarding-name')
  await nameInput.waitFor({ timeout: 10_000 })
  await nameInput.fill(opts.name)
  await page.getByTestId('wot-onboarding-profile-continue').click()

  // Step 5: Password — passphrase + confirmation
  const passwordForm = page.getByTestId('wot-onboarding-password')
  await passwordForm.waitFor({ timeout: 10_000 })
  await passwordForm.locator('input[type="password"]').nth(0).fill(opts.passphrase)
  await passwordForm.locator('input[type="password"]').nth(1).fill(opts.passphrase)
  await page.getByTestId('wot-onboarding-set-password').click()

  // Wait for main app to load (could land on Feed, Kanban, or Mein Netzwerk)
  await page.getByText(/Mein Netzwerk|Feed|Kanban/).first().waitFor({ timeout: 30_000 })

  return { mnemonic }
}

/**
 * Recover identity from mnemonic. Same selector rule as `createIdentity`.
 */
export async function recoverIdentity(page: Page, opts: { mnemonic: string; passphrase: string }): Promise<void> {
  await navigateTo(page, '/')

  const haveSeed = page.getByTestId('wot-onboarding-have-seed')
  await haveSeed.waitFor({ timeout: 15_000 })
  await haveSeed.click()

  // Enter mnemonic — a single textarea takes all words at once
  await page.getByTestId('wot-recovery-mnemonic').fill(opts.mnemonic)
  await page.getByTestId('wot-recovery-continue').click()

  // Password
  const passwordForm = page.getByTestId('wot-recovery-password')
  await passwordForm.waitFor({ timeout: 10_000 })
  await passwordForm.locator('input[type="password"]').nth(0).fill(opts.passphrase)
  await passwordForm.locator('input[type="password"]').nth(1).fill(opts.passphrase)
  await page.getByTestId('wot-recovery-submit').click()

  // Wait for main app
  await page.getByText(/Mein Netzwerk|Feed|Kanban/).first().waitFor({ timeout: 30_000 })
}

export async function waitForRelayConnected(page: Page): Promise<void> {
  await page.waitForTimeout(3_000)
}
