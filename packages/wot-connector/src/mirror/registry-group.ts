import type { MirrorRegistryContribution } from "../types.js"
import { mirrorRegistryEntryKey, parseMirrorRegistryKey } from "./keys.js"

/**
 * Die Brücke zwischen der physischen Ablage und dem Lesemodell aus Spec 09
 * §Ablage und Registry.
 *
 * Physisch liegt je Gerät ein eigener flacher Schlüssel
 * `[itemId, targetSpaceId, deviceId]` — nur so mergen nebenläufige Erstanlagen
 * zweier Geräte konfliktfrei. Gefaltet wird aber je EINTRAG
 * `(itemId, targetSpaceId)` über alle Gerätebeiträge. Diese Funktion gruppiert
 * genau das um; die Faltung selbst (`deriveRegistryView`, `nextStatusSeq`,
 * `supersedesOf`) bleibt unverändert auf `byDevice`.
 *
 * Unlesbare Schlüssel werden übergangen: die Registry ist ein gemeinsam
 * beschriebenes CRDT-Feld, und ein fremder Schreiber darf die Lesesicht nicht
 * zum Werfen bringen.
 */
export function groupRegistryByEntry(
  registry: Record<string, MirrorRegistryContribution>,
): Map<string, Record<string, MirrorRegistryContribution>> {
  const grouped = new Map<string, Record<string, MirrorRegistryContribution>>()
  for (const [key, contribution] of Object.entries(registry ?? {})) {
    if (!contribution) continue
    const parsed = parseMirrorRegistryKey(key)
    if (!parsed) continue
    const entryKey = mirrorRegistryEntryKey(parsed.itemId, parsed.targetSpaceId)
    const byDevice = grouped.get(entryKey) ?? {}
    byDevice[parsed.deviceId] = contribution
    grouped.set(entryKey, byDevice)
  }
  return grouped
}
