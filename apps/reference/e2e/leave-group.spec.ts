import { test, expect } from '@playwright/test'
import { createFreshContext, createIdentity, waitForRelayConnected } from './helpers/common'
import { performMutualVerification } from './helpers/verification'
import { createGroup, createTask, navigateToKanban, switchToGroup } from './helpers/kanban'
import { resetServerState } from './helpers/reset-servers'

test.describe('Leave Group', () => {
  test.beforeEach(async () => { await resetServerState() })

  test('Bob leaves group → no longer sees items', async ({ browser }) => {
    const { context: aliceCtx, page: alicePage } = await createFreshContext(browser)
    const { context: bobCtx, page: bobPage } = await createFreshContext(browser)

    try {
      // Setup: Alice + Bob, verified, shared group
      await createIdentity(alicePage, { name: 'Alice', passphrase: 'alice123pw' })
      await waitForRelayConnected(alicePage)
      await createIdentity(bobPage, { name: 'Bob', passphrase: 'bob12345pw' })
      await waitForRelayConnected(bobPage)
      await performMutualVerification(alicePage, bobPage)

      // Alice creates group + invites Bob
      await createGroup(alicePage, 'Testgruppe')
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

      // Alice creates task
      await switchToGroup(alicePage, 'Testgruppe')
      await navigateToKanban(alicePage)
      await createTask(alicePage, 'Team-Task')
      await expect(alicePage.getByText('Team-Task')).toBeVisible({ timeout: 10_000 })

      // Bob sees the task
      await navigateToKanban(bobPage)
      await expect(bobPage.getByText('Team-Task')).toBeVisible({ timeout: 30_000 })

      // Bob opens group dialog and clicks "Verlassen"
      await bobPage.getByText('Testgruppe').first().click()
      await bobPage.getByTitle('Gruppe bearbeiten').first().click()
      await bobPage.waitForTimeout(1000)
      await bobPage.getByText('Verlassen').click()
      await bobPage.waitForTimeout(2000)

      // Bob should no longer be in the group — should see "Mein Netzwerk"
      await expect(bobPage.getByText('Mein Netzwerk')).toBeVisible({ timeout: 10_000 })

      // Bob should no longer see "Team-Task" (not in any group)
      await expect(bobPage.getByText('Team-Task')).not.toBeVisible({ timeout: 5_000 })

    } finally {
      await aliceCtx.close()
      await bobCtx.close()
    }
  })
})
