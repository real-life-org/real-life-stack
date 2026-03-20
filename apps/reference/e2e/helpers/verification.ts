import type { Page } from '@playwright/test'

/**
 * Open the verification dialog via UserMenu → Verifizieren.
 */
async function openVerificationDialog(page: Page): Promise<void> {
  // Click the user menu trigger (data-testid for reliable E2E targeting)
  await page.locator('[data-testid="user-menu-trigger"]').click()
  // Click "Verifizieren" in the dropdown menu
  await page.getByRole('menuitem', { name: 'Verifizieren' }).waitFor({ timeout: 5_000 })
  await page.getByRole('menuitem', { name: 'Verifizieren' }).click()
  // Wait for dialog
  await page.locator('img[alt="QR Code"]').waitFor({ timeout: 15_000 })
}

/**
 * Open the verification dialog and get the challenge code via clipboard.
 */
export async function getVerificationCode(page: Page): Promise<string> {
  await openVerificationDialog(page)
  await page.getByText('Code kopieren').click()
  await page.waitForTimeout(300)
  const code = await page.evaluate(() => navigator.clipboard.readText())
  return code
}

/**
 * Submit a verification code manually (Bob's side).
 */
export async function submitVerificationCode(page: Page, code: string): Promise<void> {
  await openVerificationDialog(page)

  // Expand manual entry and fill
  await page.getByText('Code manuell eingeben').click()
  const codeInput = page.getByRole('textbox', { name: 'Code hier einfügen...' })
  await codeInput.waitFor({ timeout: 5_000 })
  await codeInput.fill(code)
  await page.waitForTimeout(300)

  // Click the check-icon submit button (sibling of textarea in flex container)
  const container = codeInput.locator('..')
  await container.locator('button').click()
  await page.waitForTimeout(1000)
}

/**
 * Confirm "Stehst du vor dieser Person?" in the verification dialog.
 */
export async function confirmVerification(page: Page): Promise<void> {
  await page.getByText(/Stehst du.*vor dieser Person/).waitFor({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Bestätigen' }).click()
}

/**
 * Dismiss the "Gegenseitig verifiziert!" dialog.
 */
export async function dismissMutualDialog(page: Page): Promise<void> {
  await page.getByText('Gegenseitig verifiziert!').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Fertig' }).click()
  await page.waitForTimeout(500)
}

/**
 * Full mutual verification between Alice and Bob.
 * Both pages must be logged in and relay-connected.
 */
export async function performMutualVerification(alicePage: Page, bobPage: Page): Promise<void> {
  // Alice shows her QR code
  const code = await getVerificationCode(alicePage)

  // Bob enters the code manually
  await submitVerificationCode(bobPage, code)

  // Bob confirms "Stehst du vor dieser Person?"
  await confirmVerification(bobPage)

  // Alice gets the incoming verification dialog and confirms
  await confirmVerification(alicePage)

  // Both should see "Gegenseitig verifiziert!" — dismiss on both
  await dismissMutualDialog(alicePage)
  await dismissMutualDialog(bobPage)
}
