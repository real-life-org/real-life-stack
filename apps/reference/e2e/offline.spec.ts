import { test, expect } from '@playwright/test'
import { createFreshContext, createIdentity, recoverIdentity, waitForRelayConnected } from './helpers/common'
import { performMutualVerification } from './helpers/verification'
import { createGroup, createTask, navigateToKanban, switchToGroup } from './helpers/kanban'
import { goOffline, goOnline, waitForReconnect } from './helpers/offline'
import { resetServerState } from './helpers/reset-servers'

test.describe('Offline Scenarios', () => {
  test.beforeEach(async () => { await resetServerState() })

  test('Alice creates task offline → goes online → Bob sees it', async ({ browser }) => {
    const { context: aliceCtx, page: alicePage } = await createFreshContext(browser)
    const { context: bobCtx, page: bobPage } = await createFreshContext(browser)

    try {
      // Setup: Alice + Bob, verified, in shared group
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

      // Alice goes offline
      await goOffline(aliceCtx)
      await alicePage.waitForTimeout(1000)

      // Alice creates task while offline (switch back to Testgruppe if needed)
      await switchToGroup(alicePage, 'Testgruppe')
      await navigateToKanban(alicePage)
      await createTask(alicePage, 'Offline-Task')
      await expect(alicePage.getByText('Offline-Task')).toBeVisible({ timeout: 10_000 })

      // Alice goes back online
      await goOnline(aliceCtx)
      await waitForReconnect(alicePage)
      await alicePage.waitForTimeout(5000)

      // Bob should see the task
      await navigateToKanban(bobPage)
      await expect(bobPage.getByText('Offline-Task')).toBeVisible({ timeout: 30_000 })

    } finally {
      await aliceCtx.close()
      await bobCtx.close()
    }
  })

  test('Alice + Bob both offline, create tasks, merge on reconnect', async ({ browser }) => {
    const { context: aliceCtx, page: alicePage } = await createFreshContext(browser)
    const { context: bobCtx, page: bobPage } = await createFreshContext(browser)

    try {
      // Setup: Alice + Bob, verified, in shared group
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
      await bobPage.waitForTimeout(2000)

      // Both go offline
      await goOffline(aliceCtx)
      await goOffline(bobCtx)
      await alicePage.waitForTimeout(1000)

      // Alice creates task offline
      await switchToGroup(alicePage, 'Testgruppe')
      await navigateToKanban(alicePage)
      await createTask(alicePage, 'Alice-Offline')
      await expect(alicePage.getByText('Alice-Offline')).toBeVisible({ timeout: 10_000 })

      // Bob creates task offline
      await navigateToKanban(bobPage)
      await createTask(bobPage, 'Bob-Offline')
      await expect(bobPage.getByText('Bob-Offline')).toBeVisible({ timeout: 10_000 })

      // Both go online
      await goOnline(aliceCtx)
      await goOnline(bobCtx)
      await waitForReconnect(alicePage)
      await waitForReconnect(bobPage)
      await alicePage.waitForTimeout(8000)

      // Both should see both tasks (CRDT merge)
      await expect(alicePage.getByText('Alice-Offline')).toBeVisible({ timeout: 30_000 })
      await expect(alicePage.getByText('Bob-Offline')).toBeVisible({ timeout: 30_000 })
      await expect(bobPage.getByText('Alice-Offline')).toBeVisible({ timeout: 30_000 })
      await expect(bobPage.getByText('Bob-Offline')).toBeVisible({ timeout: 30_000 })

    } finally {
      await aliceCtx.close()
      await bobCtx.close()
    }
  })

  test('Device 2 offline catch-up via vault', async ({ browser }) => {
    const { context: d1Ctx, page: d1Page } = await createFreshContext(browser)
    const { context: d2Ctx, page: d2Page } = await createFreshContext(browser)

    try {
      // Device 1: create identity + group + task
      const { mnemonic } = await createIdentity(d1Page, { name: 'Alice', passphrase: 'alice123pw' })
      await waitForRelayConnected(d1Page)
      await createGroup(d1Page, 'Testgruppe')
      await navigateToKanban(d1Page)
      await createTask(d1Page, 'Vor-D2')
      await expect(d1Page.getByText('Vor-D2')).toBeVisible({ timeout: 10_000 })

      // Wait for vault push
      await d1Page.waitForTimeout(8000)

      // Device 2: recover identity
      await recoverIdentity(d2Page, { mnemonic, passphrase: 'alice-d2-pw' })
      await waitForRelayConnected(d2Page)

      // Device 2: switch to Testgruppe
      await d2Page.getByText('Mein Netzwerk').first().waitFor({ timeout: 30_000 })
      await d2Page.getByText('Mein Netzwerk').first().click()
      await d2Page.getByText('Testgruppe').waitFor({ timeout: 30_000 })
      await d2Page.getByText('Testgruppe').click()
      await d2Page.waitForTimeout(1000)

      // Device 2: should see the task
      await navigateToKanban(d2Page)
      await expect(d2Page.getByText('Vor-D2')).toBeVisible({ timeout: 30_000 })

    } finally {
      await d1Ctx.close()
      await d2Ctx.close()
    }
  })
})
