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
 */
export async function createIdentity(page: Page, opts: { name: string; passphrase: string }): Promise<{ mnemonic: string }> {
  await navigateTo(page, '/')

  // Step 1: Welcome → click "Identity generieren"
  await page.getByText('Identity generieren').waitFor({ timeout: 15_000 })
  await page.getByText('Identity generieren').click()

  // Step 2: Seed — capture mnemonic words
  await page.getByText('aufgeschrieben').waitFor({ timeout: 10_000 })

  // Extract seed words via clipboard (most reliable — uses the app's own copy logic)
  await page.getByText('Wörter kopieren').click()
  await page.waitForTimeout(300)
  const mnemonic = await page.evaluate(() => navigator.clipboard.readText())
  const words = mnemonic.split(' ')

  // Check all three checkboxes
  await page.getByLabel('Ich habe alle 12 Wörter aufgeschrieben').check()
  await page.getByLabel('Ich habe sie an einem sicheren Ort verwahrt').check()
  await page.getByLabel('Ich verstehe, dass sie nicht wiederhergestellt werden können').check()
  await page.getByText('Weiter zur Verifizierung').click()

  // Step 3: Verify — fill in 3 random words by their label "Wort N:"
  await page.getByText('Seed bestätigen').waitFor({ timeout: 10_000 })
  const verifyLabels = page.locator('text=/Wort \\d+:/')
  const labelCount = await verifyLabels.count()
  for (let i = 0; i < labelCount; i++) {
    const labelText = await verifyLabels.nth(i).textContent()
    const wordNum = parseInt(labelText!.match(/Wort (\d+):/)?.[1] ?? '0')
    if (wordNum > 0 && wordNum <= words.length) {
      const input = page.locator('input[type="text"]').nth(i)
      await input.fill(words[wordNum - 1])
    }
  }

  // Step 4: Profile — enter name
  const nameInput = page.getByPlaceholder(/Name|name/)
  await nameInput.waitFor({ timeout: 10_000 })
  await nameInput.fill(opts.name)
  await page.getByRole('button', { name: /Weiter|Speichern/ }).click()

  // Step 5: Password
  const passInput = page.getByPlaceholder(/Passwort eingeben|Mindestens 8 Zeichen/)
  await passInput.waitFor({ timeout: 10_000 })
  await passInput.fill(opts.passphrase)
  const confirmInput = page.getByPlaceholder(/wiederholen|bestätigen/i)
  if (await confirmInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmInput.fill(opts.passphrase)
  }
  await page.getByRole('button', { name: /Schützen|Fertig|Passwort setzen/ }).click()

  // Wait for main app to load
  await page.getByRole('button', { name: 'Kanban' }).waitFor({ timeout: 30_000 })

  return { mnemonic }
}

/**
 * Recover identity from mnemonic.
 */
export async function recoverIdentity(page: Page, opts: { mnemonic: string; passphrase: string }): Promise<void> {
  await navigateTo(page, '/')

  await page.getByText(/Ich habe bereits einen Seed|Seed.*importieren/).waitFor({ timeout: 15_000 })
  await page.getByText(/Ich habe bereits einen Seed|Seed.*importieren/).click()

  // Enter mnemonic — could be 12 individual inputs or a single textarea
  const textarea = page.getByPlaceholder(/Wort 1|Wörter/)
  if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Single textarea: paste all words at once
    await textarea.fill(opts.mnemonic)
  } else {
    // Individual inputs
    const words = opts.mnemonic.split(' ')
    const inputs = page.locator('input[type="text"]')
    for (let i = 0; i < words.length; i++) {
      await inputs.nth(i).fill(words[i])
    }
  }

  await page.getByRole('button', { name: /Wiederherstellen|Importieren|Weiter/ }).click()

  // Password
  const passInput = page.getByPlaceholder(/Passwort eingeben|Mindestens 8 Zeichen/)
  if (await passInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await passInput.fill(opts.passphrase)
    const confirmInput = page.getByPlaceholder(/wiederholen|bestätigen/i)
    if (await confirmInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmInput.fill(opts.passphrase)
    }
    await page.getByRole('button', { name: /Schützen|Fertig|Passwort setzen|Identity wiederherstellen/ }).click()
  }

  // Wait for main app
  await page.getByRole('button', { name: 'Kanban' }).waitFor({ timeout: 30_000 })
}

export async function waitForRelayConnected(page: Page): Promise<void> {
  await page.waitForTimeout(3_000)
}
