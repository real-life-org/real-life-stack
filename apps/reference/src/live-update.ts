import { Capacitor } from "@capacitor/core"
import { LiveUpdate } from "@capawesome/capacitor-live-update"

/**
 * Checks for OTA updates on app startup.
 * Only runs on native platforms (iOS/Android), no-op in browser.
 *
 * Channel URLs (set VITE_UPDATE_SERVER_URL + VITE_UPDATE_CHANNEL at build time):
 *   https://real-life-stack.de/updates/ios/latest.json
 *   https://real-life-stack.de/updates/android/latest.json
 *   https://real-life-stack.de/updates/android-foss/latest.json
 *
 * Falls back to platform name if VITE_UPDATE_CHANNEL is not set.
 */
export async function checkForLiveUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const serverUrl = import.meta.env.VITE_UPDATE_SERVER_URL ?? 'https://real-life-stack.de'

  const channel =
    import.meta.env.VITE_UPDATE_CHANNEL || Capacitor.getPlatform()

  try {
    const response = await fetch(`${serverUrl}/updates/${channel}/latest.json`)
    if (!response.ok) return

    const { bundleId, url, sha256 } = (await response.json()) as {
      bundleId: string
      url: string
      sha256?: string
    }

    const currentBundleId = await LiveUpdate.getCurrentBundle()
    if (currentBundleId.bundleId === bundleId) return

    await LiveUpdate.downloadBundle({
      bundleId,
      url,
      checksum: sha256,
    })
    await LiveUpdate.setNextBundle({ bundleId })
    await LiveUpdate.reload()
  } catch (err) {
    // Update failures must never crash the app
    console.warn("[LiveUpdate] Update check failed:", err)
  }
}
