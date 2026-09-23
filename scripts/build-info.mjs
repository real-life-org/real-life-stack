import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Der Build-Stand einer App fuer den Rahmen (`build`-Prop, Toolkit lib/build-info)
 * und fuer Betreiber (`build-info.json` neben der App). Einmal hier, damit
 * Referenz- und Netzwerk-App dieselbe Herleitung nehmen: Version aus der
 * package.json der App, Commit aus dem tatsaechlich gebauten Checkout, Kanal
 * aus VITE_UPDATE_CHANNEL (der OTA-Kanal des Bundles; Web hat keinen).
 *
 * Der Commit kommt aus Git im Verzeichnis der package.json — NICHT aus
 * GITHUB_SHA: Der Event-SHA gehoert zum gestarteten Workflow, ein Nachbau von
 * einem aelteren Tag (build-on-tag mit inputs.tag) checkt aber den Tag aus.
 * Sonst zeigte die App die richtige Version zum falschen Commit (rls#462).
 * GITHUB_SHA ist nur der Rueckfall, wenn kein Git da ist.
 */
export function buildInfo(packageJsonUrl, { env = process.env, revParse = gitHead } = {}) {
  const pkgPath = typeof packageJsonUrl === "string" ? packageJsonUrl : fileURLToPath(packageJsonUrl)
  const version = JSON.parse(readFileSync(pkgPath, "utf8")).version
  let commit
  try { commit = revParse(dirname(pkgPath)) } catch { commit = env.GITHUB_SHA }
  const channel = env.VITE_UPDATE_CHANNEL || undefined
  return { version, commit: commit?.slice(0, 7) || undefined, channel }
}

/** HEAD des Checkouts, in dem `cwd` liegt. Wirft ohne Git. */
export function gitHead(cwd) {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
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
