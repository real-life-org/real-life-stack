import { test, expect } from '@playwright/test'
import { createFreshContext, createIdentity, navigateTo, waitForRelayConnected } from './helpers/common'
import { performMutualVerification } from './helpers/verification'

test.describe('Cross-User — Verification, Invite, Sync', () => {
  test('Alice and Bob verify, create group, share tasks', async ({ browser }) => {
    const { context: aliceCtx, page: alicePage } = await createFreshContext(browser)
    const { context: bobCtx, page: bobPage } = await createFreshContext(browser)

    try {
      // Setup: Create two identities
      await createIdentity(alicePage, { name: 'Alice', passphrase: 'alice123pw' })
      await waitForRelayConnected(alicePage)

      await createIdentity(bobPage, { name: 'Bob', passphrase: 'bob12345pw' })
      await waitForRelayConnected(bobPage)

      // Step 1: Mutual verification
      await performMutualVerification(alicePage, bobPage)

      // Step 2: Alice navigates to Kanban and creates a task
      await alicePage.getByRole('button', { name: 'Kanban' }).click()
      await alicePage.getByText('To Do').waitFor({ timeout: 15_000 })

      // Create task "Einkaufen"
      await alicePage.getByRole('button', { name: 'Task', exact: true }).click()
      await alicePage.waitForTimeout(500)
      // Click the empty card to open edit panel
      const aliceEmptyCard = alicePage.locator('[class*="rounded-lg"][class*="border"]').filter({ has: alicePage.locator('p:empty') }).last()
      await aliceEmptyCard.click()
      const titleInput = alicePage.getByRole('textbox', { name: 'Titel' })
      await titleInput.waitFor({ timeout: 5_000 })
      await titleInput.fill('Einkaufen')
      await alicePage.getByRole('button', { name: 'Schliessen' }).click()
      await alicePage.waitForTimeout(500)
      await expect(alicePage.getByText('Einkaufen')).toBeVisible({ timeout: 10_000 })

      // Step 3: Alice invites Bob to her group
      // Go to Feed where "Einladen" action card is visible
      await alicePage.getByRole('button', { name: 'Feed' }).click()
      await alicePage.waitForTimeout(1000)
      // Click "Einladen / Mitglieder hinzufügen" action card → opens group dialog
      await alicePage.getByText('Einladen').click()
      await alicePage.waitForTimeout(1000)
      // In the group dialog, click "Einladen" button next to Bob's name
      await alicePage.getByRole('button', { name: 'Einladen' }).first().click()
      await alicePage.waitForTimeout(2000)
      // Close the group dialog
      await alicePage.getByRole('button', { name: /Schliessen|Schließen/ }).click()
      await alicePage.waitForTimeout(500)

      // Alice: back to Kanban (was on Feed for invite)
      await alicePage.getByRole('button', { name: 'Kanban' }).click()
      await alicePage.getByText('To Do').waitFor({ timeout: 10_000 })

      // Step 4: Bob accepts the invitation
      await bobPage.getByText('Neue Einladung').waitFor({ timeout: 30_000 })
      await bobPage.getByRole('button', { name: 'Öffnen' }).click()
      await bobPage.waitForTimeout(2000)

      // Step 5: Bob navigates to Kanban — should see Alice's task
      await bobPage.getByRole('button', { name: 'Kanban' }).click()
      await bobPage.getByText('To Do').waitFor({ timeout: 15_000 })
      await expect(bobPage.getByText('Einkaufen')).toBeVisible({ timeout: 30_000 })

      // Step 6: Bob creates a task "Kochen"
      await bobPage.getByRole('button', { name: 'Task', exact: true }).click()
      await bobPage.waitForTimeout(500)
      const bobEmptyCard = bobPage.locator('[class*="rounded-lg"][class*="border"]').filter({ has: bobPage.locator('p:empty') }).last()
      await bobEmptyCard.click()
      const titleInput2 = bobPage.getByRole('textbox', { name: 'Titel' })
      await titleInput2.waitFor({ timeout: 5_000 })
      await titleInput2.fill('Kochen')
      await bobPage.getByRole('button', { name: 'Schliessen' }).click()
      await bobPage.waitForTimeout(500)

      // Wait for sync
      await bobPage.waitForTimeout(5000)

      // Step 7: Both see both tasks
      await expect(alicePage.getByText('Einkaufen')).toBeVisible({ timeout: 30_000 })
      await expect(alicePage.getByText('Kochen')).toBeVisible({ timeout: 30_000 })
      await expect(bobPage.getByText('Einkaufen')).toBeVisible({ timeout: 10_000 })
      await expect(bobPage.getByText('Kochen')).toBeVisible({ timeout: 10_000 })

    } finally {
      await aliceCtx.close()
      await bobCtx.close()
    }
  })
})
