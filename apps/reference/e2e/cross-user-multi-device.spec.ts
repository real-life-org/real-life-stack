import { test, expect } from '@playwright/test'
import { createFreshContext, createIdentity, recoverIdentity, waitForRelayConnected } from './helpers/common'
import { performMutualVerification } from './helpers/verification'
import { createTask, navigateToKanban } from './helpers/kanban'
import { resetServerState } from './helpers/reset-servers'

test.describe('Cross-User + Multi-Device', () => {
  test.beforeEach(async () => { await resetServerState() })
  test('Alice D1 + D2 + Bob: group invite, space discovery, task sync across all devices', async ({ browser }) => {
    const { context: d1Ctx, page: d1Page } = await createFreshContext(browser)
    const { context: d2Ctx, page: d2Page } = await createFreshContext(browser)
    const { context: bobCtx, page: bobPage } = await createFreshContext(browser)

    try {
      // Setup: Alice D1 + Bob create identities
      const { mnemonic: aliceMnemonic } = await createIdentity(d1Page, { name: 'Alice', passphrase: 'alice123pw' })
      await waitForRelayConnected(d1Page)

      await createIdentity(bobPage, { name: 'Bob', passphrase: 'bob12345pw' })
      await waitForRelayConnected(bobPage)

      // Alice + Bob: mutual verification
      await performMutualVerification(d1Page, bobPage)

      // Alice D1: invite Bob
      await d1Page.getByRole('button', { name: 'Feed' }).click()
      await d1Page.waitForTimeout(1000)
      await d1Page.getByText('Einladen').click()
      await d1Page.waitForTimeout(1000)
      await d1Page.getByRole('button', { name: 'Einladen' }).first().click()
      await d1Page.waitForTimeout(2000)
      await d1Page.getByRole('button', { name: /Schliessen|Schließen/ }).click()

      // Bob accepts invitation
      await bobPage.getByText('Neue Einladung').waitFor({ timeout: 30_000 })
      await bobPage.getByRole('button', { name: 'Öffnen' }).click()
      await bobPage.waitForTimeout(2000)

      // Alice D1: create task "Von D1"
      await navigateToKanban(d1Page)
      await createTask(d1Page, 'Von D1')
      await expect(d1Page.getByText('Von D1')).toBeVisible({ timeout: 10_000 })

      // Wait for sync + vault push (5s debounce + network)
      await d1Page.waitForTimeout(10000)

      // Alice D2: recover same identity
      await recoverIdentity(d2Page, { mnemonic: aliceMnemonic, passphrase: 'alice-d2-pw' })
      await waitForRelayConnected(d2Page)

      // Alice D2: should see the group and task
      await d2Page.getByRole('button', { name: 'Kanban' }).waitFor({ timeout: 30_000 })
      await navigateToKanban(d2Page)
      await expect(d2Page.getByText('Von D1')).toBeVisible({ timeout: 30_000 })

      // Bob: should see "Von D1"
      await navigateToKanban(bobPage)
      await expect(bobPage.getByText('Von D1')).toBeVisible({ timeout: 30_000 })

      // Bob: create task "Von Bob"
      await createTask(bobPage, 'Von Bob')

      // Wait for sync
      await bobPage.waitForTimeout(5000)

      // All three devices should see both tasks
      await expect(d1Page.getByText('Von D1')).toBeVisible({ timeout: 30_000 })
      await expect(d1Page.getByText('Von Bob')).toBeVisible({ timeout: 30_000 })
      await expect(d2Page.getByText('Von D1')).toBeVisible({ timeout: 10_000 })
      await expect(d2Page.getByText('Von Bob')).toBeVisible({ timeout: 10_000 })
      await expect(bobPage.getByText('Von D1')).toBeVisible({ timeout: 10_000 })
      await expect(bobPage.getByText('Von Bob')).toBeVisible({ timeout: 10_000 })

    } finally {
      await d1Ctx.close()
      await d2Ctx.close()
      await bobCtx.close()
    }
  })
})
