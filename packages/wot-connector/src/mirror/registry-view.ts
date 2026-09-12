import { compareAdmission } from "@real-life/wot-core"
import type { SpaceAdmission } from "@real-life/wot-core/types"

import type { MirrorOrderPosition, MirrorRegistryContribution, MirrorRegistryEntry } from "../types.js"
import { compareVersion } from "./version.js"

/**
 * Die eine Lesesicht auf einen Registry-Eintrag (Spec 09 §Ablage und Registry,
 * Spec 12 Regel 9). Sie wird deterministisch aus den Beiträgen ALLER Geräte
 * abgeleitet und nirgends gespeichert.
 */
export interface MirrorRegistryView {
  status: "pending" | "accepted" | "revoked"
  /** Die Kennung der Aufnahme, aus der der Status stammt. */
  admission?: SpaceAdmission
  /** Die gewinnende Ordnungsposition — das Maximum über alle Gerätebeiträge. */
  seq: number
  deviceId: string
  tiebreak: string
  /** `publishedHash` der GEWINNENDEN Position; leer, wenn das ein Tombstone war. */
  publishedHash?: string
}

/**
 * Ordnung über Aufnahme-Kennungen mit der Regel aus Spec 09: **keine Kennung
 * (`undefined`) liegt unter jeder Kennung**.
 *
 * `undefined` heißt in beiden Entstehungsfällen dasselbe — „keine gültige
 * Aufnahme": ein Alt-Space ohne Ereignisse, oder ein Gewinner-Ereignis
 * `removed` der eigenen DID. Deshalb ist jeder Anstieg über `undefined`
 * hinaus eine Wiederaufnahme, nicht bloß eine nachgereichte Information.
 */
export function compareAdmissionOrUndefined(
  a: SpaceAdmission | undefined,
  b: SpaceAdmission | undefined,
): number {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  return compareAdmission(a, b)
}

/**
 * Faltet die Gerätebeiträge einer Freigabe zur Lesesicht. `null`, solange kein
 * Gerät beigetragen hat.
 *
 * Position und Status werden GETRENNT bestimmt: die Position ist das Maximum
 * über alle Beiträge (sie zählt Publikationen und muss monoton bleiben, sonst
 * bricht der home-weite Zähler), der Status folgt der höchsten Aufnahme-Kennung
 * — ein Beitrag aus einer alten Aufnahme darf über die neue nichts aussagen.
 */
export function deriveRegistryView(
  byDevice: Record<string, MirrorRegistryContribution>,
): MirrorRegistryView | null {
  const devices = Object.keys(byDevice)
  if (devices.length === 0) return null

  let winner: { position: MirrorOrderPosition; contribution: MirrorRegistryContribution } | null = null
  let highestAdmission: SpaceAdmission | undefined
  let sawAdmission = false

  for (const deviceId of devices) {
    const contribution = byDevice[deviceId]
    if (!contribution) continue
    const position: MirrorOrderPosition = { seq: contribution.seq, deviceId, tiebreak: contribution.tiebreak }
    if (!winner || compareVersion(position, winner.position) > 0) {
      winner = { position, contribution }
    }
    if (!sawAdmission || compareAdmissionOrUndefined(contribution.admission, highestAdmission) > 0) {
      highestAdmission = contribution.admission
      sawAdmission = true
    }
  }
  if (!winner) return null

  // Nur die Beiträge der HÖCHSTEN Aufnahme entscheiden über den Status.
  const current = devices
    .map((deviceId) => [deviceId, byDevice[deviceId]] as const)
    .filter((pair): pair is readonly [string, MirrorRegistryContribution] => Boolean(pair[1]))
    .filter(([, contribution]) => compareAdmissionOrUndefined(contribution.admission, highestAdmission) === 0)

  return {
    status: foldStatus(current),
    ...(highestAdmission ? { admission: highestAdmission } : {}),
    seq: winner.position.seq,
    deviceId: winner.position.deviceId,
    tiebreak: winner.position.tiebreak,
    ...(winner.contribution.publishedHash ? { publishedHash: winner.contribution.publishedHash } : {}),
  }
}

/**
 * Widerrufs-Kausalität statt bloßer Ordnung (Spec 09 §Ablage und Registry,
 * Spec 12 Regel 9): ein Widerruf, den keine Freigabe per `supersedes`
 * beobachtet hat, gewinnt immer — auch gegen eine nebenläufige Freigabe mit
 * höherem `statusSeq`. Erst eine Freigabe, die ihn gesehen hat, löst ihn ab.
 *
 * Dieselbe Abdeckung gilt für `pending` (Spec 12 Regel 9: „sonst pending, wenn
 * ein pending-Beitrag existiert, den keine Annahme abdeckt"); `supersedes`
 * trägt deshalb die beobachteten NICHT-`accepted`-Beiträge, nicht nur die
 * Widerrufe.
 */
function foldStatus(
  contributions: ReadonlyArray<readonly [string, MirrorRegistryContribution]>,
): "pending" | "accepted" | "revoked" {
  const covered = (deviceId: string, statusSeq: number) =>
    contributions.some(
      ([, contribution]) =>
        contribution.status === "accepted" && (contribution.supersedes?.[deviceId] ?? -1) >= statusSeq,
    )
  const uncovered = (status: "revoked" | "pending") =>
    contributions.some(
      ([deviceId, contribution]) => contribution.status === status && !covered(deviceId, contribution.statusSeq),
    )

  if (uncovered("revoked")) return "revoked"
  if (uncovered("pending")) return "pending"
  return "accepted"
}

/**
 * Der nächste Publikations-Zähler: `1 + max(seq aller Einträge dieses itemId)`
 * — HOME-WEIT über alle Ziele, nicht je Ziel (Spec 09 Invariante 6).
 *
 * Getrennte Zähler je Ziel würden dazu führen, dass ein Gerät, das den
 * gemergten Home-Stand publiziert, unter einem bereits zugestellten
 * Schnappschuss landet und neuere Inhalte dauerhaft verworfen werden.
 */
export function nextSeq(registryEntriesOfItem: Iterable<MirrorRegistryEntry>): number {
  let max = 0
  for (const entry of registryEntriesOfItem) {
    for (const contribution of Object.values(entry.byDevice ?? {})) {
      if (contribution && contribution.seq > max) max = contribution.seq
    }
  }
  // Lieber laut scheitern als still stagnieren: jenseits von MAX_SAFE_INTEGER
  // liefert `max + 1` wieder `max`, jeder neue Schnappschuss trüge dieselbe
  // Position und fiele beim Empfänger unter die Strikt-größer-Regel
  // (Invariante 6) — der Mirror würde einfrieren, ohne dass irgendwo ein
  // Fehler sichtbar wird.
  if (!Number.isSafeInteger(max) || max + 1 >= Number.MAX_SAFE_INTEGER) {
    throw new Error(`nextSeq: Zählerstand ${max} erschöpft den sicheren Ganzzahlbereich`)
  }
  return max + 1
}

/** Der nächste Lamport-Zähler der Statuswechsel: `1 + max(beobachtet)`. */
export function nextStatusSeq(byDevice: Record<string, MirrorRegistryContribution>): number {
  let max = 0
  for (const contribution of Object.values(byDevice ?? {})) {
    if (contribution && contribution.statusSeq > max) max = contribution.statusSeq
  }
  // Wie nextSeq (#351): jenseits des sicheren Bereichs liefert `max + 1`
  // wieder `max`, eine alte supersedes-Abdeckung deckte dann einen späteren
  // Widerruf desselben Geräts ab. Lieber laut scheitern.
  if (!Number.isSafeInteger(max) || max + 1 >= Number.MAX_SAFE_INTEGER) {
    throw new Error(`nextStatusSeq: Zählerstand ${max} erschöpft den sicheren Ganzzahlbereich`)
  }
  return max + 1
}
