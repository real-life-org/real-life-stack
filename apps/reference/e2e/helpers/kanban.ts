import type { Page } from '@playwright/test'

/**
 * Create a task in the Kanban board.
 * Clicks "Task" button → waits for edit panel → fills title → closes panel.
 */
export async function createTask(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: 'Task', exact: true }).click()

  // Wait for the edit panel — it opens via URL route /kanban/item/{id}
  // The "Titel" textbox appears in the side panel
  const titleInput = page.getByRole('textbox', { name: 'Titel' })

  // If panel didn't open, click the empty card that was just created
  if (!await titleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    // The new card is the last empty paragraph in a card
    const emptyCards = page.locator('p:empty')
    if (await emptyCards.count() > 0) {
      await emptyCards.last().click()
    }
  }

  await titleInput.waitFor({ timeout: 10_000 })
  await titleInput.fill(title)

  // Close the edit panel
  await page.getByRole('button', { name: 'Schliessen' }).click()
  await page.waitForTimeout(1000)
}

/**
 * Navigate to Kanban and wait for columns to appear.
 */
export async function navigateToKanban(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Kanban' }).click()
  await page.getByText('To Do').waitFor({ timeout: 15_000 })
}
