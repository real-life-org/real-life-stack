import type { MirrorOrderPosition } from "../types.js"

/**
 * Die totale Ordnung der Mirror-Schnappschüsse (Spec 09 Invariante 6):
 * `(seq, deviceId, tiebreak)` lexikographisch.
 *
 * `ts` aus `version` ist reine ANZEIGEZEIT und bewusst NICHT Teil der Ordnung —
 * Geräteuhren sind kein verlässlicher Zähler, und ein falsch gestelltes Gerät
 * könnte sonst jeden späteren Stand dauerhaft aussperren.
 *
 * Rückgabe wie bei `Array.prototype.sort`: < 0, 0, > 0.
 */
export function compareVersion(a: MirrorOrderPosition, b: MirrorOrderPosition): number {
  if (a.seq !== b.seq) return a.seq < b.seq ? -1 : 1
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1
  if (a.tiebreak === b.tiebreak) return 0
  return a.tiebreak < b.tiebreak ? -1 : 1
}

/**
 * Der tiebreak einer Ordnungsposition: `sha256` über die kanonischen signierten
 * Payload-Bytes, lowercase Hex (Spec 09 §Snapshot-Form).
 *
 * Er steht NICHT auf dem Draht: offline gleichzeitig erzeugte Schnappschüsse
 * dürfen dieselbe `(seq, deviceId)` tragen, und nur der Inhalts-Hash macht den
 * Vergleich dann noch entscheidbar. Empfänger MÜSSEN ihn beim Akzeptieren
 * berechnen und mit der Marke persistieren.
 */
export async function tiebreakOf(canonicalBytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", canonicalBytes as BufferSource)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
