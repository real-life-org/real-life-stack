import { test, expect } from '@playwright/test'
import { createFreshContext, createIdentity, recoverIdentity, waitForRelayConnected } from './helpers/common'
import { createTask, navigateToKanban } from './helpers/kanban'
import { resetServerState } from './helpers/reset-servers'

test.describe('CRDT Merge — Concurrent Items', () => {
  test.beforeEach(async () => { await resetServerState() })
  test('two devices create tasks, sync via relay — no data loss', async ({ browser }) => {
    const { context: d1Ctx, page: d1Page } = await createFreshContext(browser)
    const { context: d2Ctx, page: d2Page } = await createFreshContext(browser)

    try {
      // Device 1: Create identity
      const { mnemonic } = await createIdentity(d1Page, {
        name: 'Alice',
        passphrase: 'alice123pw',
      })
      await waitForRelayConnected(d1Page)

      // Device 1: Navigate to Kanban + create task
      await navigateToKanban(d1Page)
      await createTask(d1Page, 'Einkaufen')
      await expect(d1Page.getByText('Einkaufen')).toBeVisible({ timeout: 10_000 })

      // Wait for sync
      await d1Page.waitForTimeout(5000)

      // Device 2: Recover same identity
      await recoverIdentity(d2Page, {
        mnemonic,
        passphrase: 'alice-d2-pw',
      })
      await waitForRelayConnected(d2Page)

      // Device 2: Navigate to Kanban — should see "Einkaufen"
      await navigateToKanban(d2Page)
      await expect(d2Page.getByText('Einkaufen')).toBeVisible({ timeout: 30_000 })

      // Device 2: Create task "Kochen"
      await createTask(d2Page, 'Kochen')
      await expect(d2Page.getByText('Kochen')).toBeVisible({ timeout: 10_000 })

      // Wait for sync
      await d2Page.waitForTimeout(5000)

      // Both devices should see both tasks
      await expect(d1Page.getByText('Einkaufen')).toBeVisible({ timeout: 30_000 })
      await expect(d1Page.getByText('Kochen')).toBeVisible({ timeout: 30_000 })
      await expect(d2Page.getByText('Einkaufen')).toBeVisible({ timeout: 10_000 })
      await expect(d2Page.getByText('Kochen')).toBeVisible({ timeout: 10_000 })

    } finally {
      await d1Ctx.close()
      await d2Ctx.close()
    }
  })
})
