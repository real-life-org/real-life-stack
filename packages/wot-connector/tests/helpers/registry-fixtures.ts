import {
  groupRegistryByEntry,
  mirrorRegistryEntryKey,
  mirrorRegistryKey,
} from "../../src/mirror/index.js"
import type { MirrorRegistryRoot } from "../../src/mirror/index.js"
import { registryContributionsOf } from "../../src/mirror/index.js"
import type { MirrorRegistryContribution } from "../../src/types.js"

/**
 * Die physische Registry-Ablage aus Spec 09 §Ablage und Registry: je Gerät ein
 * flacher Schlüssel `[itemId, targetSpaceId, deviceId]`. Die Tests beschreiben
 * ihre Ausgangslage weiter je Eintrag — das ist das Lesemodell —, legen sie
 * aber flach ab, so wie der Connector schreibt.
 */
export function flatRegistry(
  itemId: string,
  entries: Record<string, Record<string, MirrorRegistryContribution>>,
): MirrorRegistryRoot {
  const registry: MirrorRegistryRoot = {}
  for (const [targetSpaceId, byDevice] of Object.entries(entries)) {
    for (const [deviceId, contribution] of Object.entries(byDevice)) {
      registry[mirrorRegistryKey(itemId, targetSpaceId, deviceId)] = contribution
    }
  }
  return registry
}

/**
 * Die Gerätebeiträge eines Eintrags, aus der flachen Ablage der WURZEL
 * `mirrorRegistry` umgruppiert (Spec 09 §Ablage und Registry, Fassung rls#354).
 */
export function byDeviceOf(
  root: MirrorRegistryRoot | undefined,
  itemId: string,
  targetSpaceId: string,
): Record<string, MirrorRegistryContribution> {
  return groupRegistryByEntry(registryContributionsOf(root)).get(mirrorRegistryEntryKey(itemId, targetSpaceId)) ?? {}
}

/** Hat irgendein Gerät zu diesem Eintrag beigetragen? */
export function hasEntry(
  root: MirrorRegistryRoot | undefined,
  itemId: string,
  targetSpaceId: string,
): boolean {
  return groupRegistryByEntry(registryContributionsOf(root)).has(mirrorRegistryEntryKey(itemId, targetSpaceId))
}
