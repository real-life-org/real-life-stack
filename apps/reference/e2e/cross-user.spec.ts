import { test, expect } from '@playwright/test'
import { createFreshContext, createIdentity, waitForRelayConnected } from './helpers/common'
import { performMutualVerification } from './helpers/verification'
import { createTask, navigateToKanban } from './helpers/kanban'
import { resetServerState } from './helpers/reset-servers'

test.describe('Cross-User — Verification, Invite, Sync', () => {
  test.beforeEach(async () => { await resetServerState() })
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

      // Step 2: Alice creates task in Kanban
      await navigateToKanban(alicePage)
      await createTask(alicePage, 'Einkaufen')
      await expect(alicePage.getByText('Einkaufen')).toBeVisible({ timeout: 10_000 })

      // Step 3: Alice invites Bob
      await alicePage.getByRole('button', { name: 'Feed' }).click()
      await alicePage.waitForTimeout(1000)
      await alicePage.getByText('Einladen').click()
      await alicePage.waitForTimeout(1000)
      await alicePage.getByRole('button', { name: 'Einladen' }).first().click()
      await alicePage.waitForTimeout(2000)
      await alicePage.getByRole('button', { name: /Schliessen|Schließen/ }).click()
      await alicePage.waitForTimeout(500)

      // Alice back to Kanban
      await navigateToKanban(alicePage)

      // Step 4: Bob accepts invitation
      await bobPage.getByText('Neue Einladung').waitFor({ timeout: 30_000 })
      await bobPage.getByRole('button', { name: 'Öffnen' }).click()
      // Wait until Bob is in the group (navbar tabs appear)
      await bobPage.getByRole('button', { name: 'Feed' }).waitFor({ timeout: 30_000 })
      await bobPage.waitForTimeout(1000)

      // Step 5: Bob sees "Einkaufen"
      await navigateToKanban(bobPage)
      await expect(bobPage.getByText('Einkaufen')).toBeVisible({ timeout: 30_000 })

      // Step 6: Bob creates task "Kochen"
      await createTask(bobPage, 'Kochen')

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
