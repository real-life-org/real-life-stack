import { test, expect } from '@playwright/test'
import { createFreshContext, createIdentity, recoverIdentity, waitForRelayConnected } from './helpers/common'
import { performMutualVerification } from './helpers/verification'
import { createGroup, createTask, navigateToKanban, switchToGroup } from './helpers/kanban'
import { goOffline, goOnline, waitForReconnect } from './helpers/offline'
import { resetServerState } from './helpers/reset-servers'

/**
 * Helper: Open group dialog and remove a member by name.
 */
async function removeMember(page: import('@playwright/test').Page, memberName: string): Promise<void> {
  // Make sure we're in the Testgruppe (not Mein Netzwerk)
  await switchToGroup(page, 'Testgruppe')

  // Open group dialog via Feed → "Einladen" action card
  await page.getByRole('button', { name: 'Feed' }).click()
  await page.waitForTimeout(1000)
  await page.getByText('Einladen').click()
  await page.waitForTimeout(1000)

  // Group dialog is open — find the remove button next to the member name
  const removeBtn = page.getByTitle('Mitglied entfernen').first()
  await removeBtn.waitFor({ timeout: 5_000 })
  await removeBtn.click({ force: true })
  await page.waitForTimeout(2000)

  // Close group dialog
  await page.getByRole('button', { name: /Schliessen|Schließen|Close/ }).first().click()
  await page.waitForTimeout(500)
}

test.describe('Key Rotation + Offline', () => {
  test.beforeEach(async () => { await resetServerState() })

  test('Phase 1: remove member → new content invisible to removed user', async ({ browser }) => {
    const { context: aliceCtx, page: alicePage } = await createFreshContext(browser)
    const { context: bobCtx, page: bobPage } = await createFreshContext(browser)

    try {
      // Setup: Alice + Bob, verified, shared group with initial task
      await createIdentity(alicePage, { name: 'Alice', passphrase: 'alice123pw' })
      await waitForRelayConnected(alicePage)
      await createIdentity(bobPage, { name: 'Bob', passphrase: 'bob12345pw' })
      await waitForRelayConnected(bobPage)
      await performMutualVerification(alicePage, bobPage)

      await createGroup(alicePage, 'Testgruppe')
      // Invite Bob
      await alicePage.getByRole('button', { name: 'Feed' }).click()
      await alicePage.waitForTimeout(1000)
      await alicePage.getByText('Einladen').click()
      await alicePage.waitForTimeout(1000)
      await alicePage.getByRole('button', { name: 'Einladen' }).first().click()
      await alicePage.waitForTimeout(2000)
      await alicePage.getByRole('button', { name: /Schliessen|Schließen/ }).click()

      // Bob accepts
      await bobPage.getByText('Neue Einladung').waitFor({ timeout: 30_000 })
      await bobPage.getByRole('button', { name: 'Öffnen' }).click()
      await bobPage.getByRole('button', { name: 'Feed' }).waitFor({ timeout: 30_000 })
      await bobPage.waitForTimeout(1000)

      // Alice creates initial task (both can see)
      await switchToGroup(alicePage, 'Testgruppe')
      await navigateToKanban(alicePage)
      await createTask(alicePage, 'Vor-Rotation')
      await expect(alicePage.getByText('Vor-Rotation')).toBeVisible({ timeout: 10_000 })

      // Bob sees initial task
      await navigateToKanban(bobPage)
      await expect(bobPage.getByText('Vor-Rotation')).toBeVisible({ timeout: 30_000 })

      // Alice removes Bob → key rotation
      await removeMember(alicePage, 'Bob')

      // Alice switches back to Testgruppe (removeMember switches to Mein Netzwerk)
      await switchToGroup(alicePage, 'Testgruppe')
      // Alice creates task with new key
      await navigateToKanban(alicePage)
      await createTask(alicePage, 'Nach-Rotation')
      await expect(alicePage.getByText('Nach-Rotation')).toBeVisible({ timeout: 10_000 })

      // Wait for sync
      await alicePage.waitForTimeout(5000)

      // Bob should still see old task but NOT the new one
      await expect(bobPage.getByText('Vor-Rotation')).toBeVisible({ timeout: 10_000 })
      // Bob should NOT see "Nach-Rotation" (encrypted with new key)
      await bobPage.waitForTimeout(5000)
      await expect(bobPage.getByText('Nach-Rotation')).not.toBeVisible({ timeout: 5_000 })

    } finally {
      await aliceCtx.close()
      await bobCtx.close()
    }
  })

  test('Phase 2: Device 2 offline during rotation → gets new key on reconnect', async ({ browser }) => {
    const { context: d1Ctx, page: d1Page } = await createFreshContext(browser)
    const { context: d2Ctx, page: d2Page } = await createFreshContext(browser)
    const { context: bobCtx, page: bobPage } = await createFreshContext(browser)

    try {
      // Setup: Alice D1 + Bob, verified, shared group
      const { mnemonic: aliceMnemonic } = await createIdentity(d1Page, { name: 'Alice', passphrase: 'alice123pw' })
      await waitForRelayConnected(d1Page)
      await createIdentity(bobPage, { name: 'Bob', passphrase: 'bob12345pw' })
      await waitForRelayConnected(bobPage)
      await performMutualVerification(d1Page, bobPage)

      await createGroup(d1Page, 'Testgruppe')
      await d1Page.getByRole('button', { name: 'Feed' }).click()
      await d1Page.waitForTimeout(1000)
      await d1Page.getByText('Einladen').click()
      await d1Page.waitForTimeout(1000)
      await d1Page.getByRole('button', { name: 'Einladen' }).first().click()
      await d1Page.waitForTimeout(2000)
      await d1Page.getByRole('button', { name: /Schliessen|Schließen/ }).click()

      // Bob accepts
      await bobPage.getByText('Neue Einladung').waitFor({ timeout: 30_000 })
      await bobPage.getByRole('button', { name: 'Öffnen' }).click()
      await bobPage.waitForTimeout(2000)

      // Initial task
      await switchToGroup(d1Page, 'Testgruppe')
      await navigateToKanban(d1Page)
      await createTask(d1Page, 'Vor-Rotation')
      await expect(d1Page.getByText('Vor-Rotation')).toBeVisible({ timeout: 10_000 })

      // Wait for vault push
      await d1Page.waitForTimeout(8000)

      // Alice D2: recover identity
      await recoverIdentity(d2Page, { mnemonic: aliceMnemonic, passphrase: 'alice-d2-pw' })
      await waitForRelayConnected(d2Page)

      // D2 switch to Testgruppe
      await d2Page.getByText('Mein Netzwerk').first().waitFor({ timeout: 30_000 })
      await d2Page.getByText('Mein Netzwerk').first().click()
      await d2Page.getByText('Testgruppe').waitFor({ timeout: 30_000 })
      await d2Page.getByText('Testgruppe').click()
      await d2Page.waitForTimeout(1000)
      await navigateToKanban(d2Page)
      await expect(d2Page.getByText('Vor-Rotation')).toBeVisible({ timeout: 30_000 })

      // D2 goes offline
      await goOffline(d2Ctx)
      await d2Page.waitForTimeout(1000)

      // D1 removes Bob (key rotation) while D2 is offline
      await removeMember(d1Page, 'Bob')

      // D1 switches back to Testgruppe after removeMember
      await switchToGroup(d1Page, 'Testgruppe')
      // D1 creates task with new key
      await navigateToKanban(d1Page)
      await createTask(d1Page, 'Waehrend-D2-Offline')
      await expect(d1Page.getByText('Waehrend-D2-Offline')).toBeVisible({ timeout: 10_000 })

      // Wait for vault push
      await d1Page.waitForTimeout(8000)

      // D2 comes back online → should get the new key and see the task
      await goOnline(d2Ctx)
      await waitForReconnect(d2Page)
      await d2Page.waitForTimeout(10000)

      // D2 should see the task created after rotation
      await expect(d2Page.getByText('Waehrend-D2-Offline')).toBeVisible({ timeout: 30_000 })

    } finally {
      await d1Ctx.close()
      await d2Ctx.close()
      await bobCtx.close()
    }
  })
})
