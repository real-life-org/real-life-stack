import { Capacitor } from "@capacitor/core"
import { LiveUpdate } from "@capawesome/capacitor-live-update"

/**
 * Checks for OTA updates on app startup.
 * Only runs on native platforms (iOS/Android), no-op in browser.
 *
 * Server contract:
 *   GET <UPDATE_SERVER_URL>/latest.json
 *   → { "bundleId": "1.0.1", "url": "https://…/bundle-1.0.1.zip" }
 *
 * Works with any static host (GitHub Pages, Cloudflare Pages, S3, …).
 * Set VITE_UPDATE_SERVER_URL in your .env to enable.
 */
export async function checkForLiveUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const serverUrl = import.meta.env.VITE_UPDATE_SERVER_URL
  if (!serverUrl) return

  try {
    const response = await fetch(`${serverUrl}/latest.json`)
    if (!response.ok) return

    const { bundleId, url } = (await response.json()) as {
      bundleId: string
      url: string
    }

    const currentBundleId = await LiveUpdate.getCurrentBundle()
    if (currentBundleId.bundleId === bundleId) return

    await LiveUpdate.downloadBundle({ bundleId, url })
    await LiveUpdate.setNextBundle({ bundleId })
    await LiveUpdate.reload()
  } catch (err) {
    // Update failures must never crash the app
    console.warn("[LiveUpdate] Update check failed:", err)
  }
}
