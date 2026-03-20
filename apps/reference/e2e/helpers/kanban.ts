import type { Page } from '@playwright/test'

/**
 * Create a new group and switch to it.
 * "Mein Netzwerk" is a meta-group — tests need real groups for items.
 */
export async function createGroup(page: Page, name: string): Promise<void> {
  // Open workspace switcher dropdown
  await page.getByText('Mein Netzwerk').first().click()
  await page.getByText('Neue Gruppe erstellen').waitFor({ timeout: 5_000 })
  await page.getByText('Neue Gruppe erstellen').click()

  // Fill group name in the dialog
  const nameInput = page.getByPlaceholder('z.B. Nachbarschaft, Projekt-Team...')
  await nameInput.waitFor({ timeout: 5_000 })
  await nameInput.click()
  await page.keyboard.type(name)
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /Erstellen/ }).click()
  await page.waitForTimeout(2000)
}

/**
 * Create a task in the Kanban board.
 * Clicks "Task" button → waits for edit panel → fills title → closes panel.
 */
export async function createTask(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: 'Task', exact: true }).click()

  // Wait for edit panel to open with title input (placeholder="Titel")
  const titleInput = page.getByPlaceholder('Titel')
  await titleInput.waitFor({ timeout: 10_000 })
  await titleInput.fill(title)

  // Wait for liveUpdate debounce (300ms) + save
  await page.waitForTimeout(1000)

  // Close the edit panel
  await page.getByRole('button', { name: 'Schliessen' }).click()
  await page.waitForTimeout(500)
}

/**
 * Navigate to Kanban and wait for columns to appear.
 */
export async function navigateToKanban(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Kanban' }).click()
  await page.getByText('To Do').waitFor({ timeout: 15_000 })
}
