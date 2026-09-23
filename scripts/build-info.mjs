import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

/**
 * Der Build-Stand einer App fuer den Rahmen (`build`-Prop, Toolkit lib/build-info)
 * und fuer Betreiber (`build-info.json` neben der App). Einmal hier, damit
 * Referenz- und Netzwerk-App dieselbe Herleitung nehmen: Version aus der
 * package.json der App, Commit aus Git (oder GITHUB_SHA in CI), Kanal aus
 * VITE_UPDATE_CHANNEL (der OTA-Kanal des Bundles; Web hat keinen).
 */
export function buildInfo(packageJsonUrl) {
  const version = JSON.parse(readFileSync(packageJsonUrl, "utf8")).version
  let commit = process.env.GITHUB_SHA
  if (!commit) { try { commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim() } catch { commit = undefined } }
  const channel = process.env.VITE_UPDATE_CHANNEL || undefined
  return { version, commit: commit?.slice(0, 7), channel }
}

/** Vite: `__RLS_BUILD__` zur Build-Zeit einsetzen und `build-info.json` neben die App legen. */
export function buildInfoPlugin(info) {
  return {
    name: "rls-build-info",
    config: () => ({ define: { __RLS_BUILD__: JSON.stringify(info) } }),
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "build-info.json", source: JSON.stringify(info, null, 2) + "\n" })
    },
  }
}
