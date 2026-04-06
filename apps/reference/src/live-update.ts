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

  const serverUrl = import.meta.env.VITE_UPDATE_SERVER_URL
  if (!serverUrl) return

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

    await LiveUpdate.downloadBundle({ bundleId, url })

    if (sha256) {
      const isValid = await verifyBundleHash(bundleId, sha256)
      if (!isValid) {
        console.warn("[LiveUpdate] Bundle hash mismatch — skipping update")
        await LiveUpdate.deleteBundle({ bundleId })
        return
      }
    }

    await LiveUpdate.setNextBundle({ bundleId })
    await LiveUpdate.reload()
  } catch (err) {
    // Update failures must never crash the app
    console.warn("[LiveUpdate] Update check failed:", err)
  }
}

async function verifyBundleHash(
  bundleId: string,
  expectedHash: string
): Promise<boolean> {
  try {
    const path = await LiveUpdate.getBundlePath({ bundleId })
    const response = await fetch(path.path)
    const buffer = await response.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
    return hashHex === expectedHash
  } catch {
    return false
  }
}
