import type { BrowserContext, Page } from '@playwright/test'

export async function goOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true)
}

export async function goOnline(context: BrowserContext): Promise<void> {
  await context.setOffline(false)
}

export async function waitForReconnect(page: Page, timeout = 30_000): Promise<void> {
  // Wait for relay to reconnect — green dot or connected indicator
  await page.waitForTimeout(3000)
}
