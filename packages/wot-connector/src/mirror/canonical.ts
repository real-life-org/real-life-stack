import { jcsCanonicalize } from "@real-life-stack/data-interface"

import type { MirrorSnapshotPayload, SerializedItem } from "../types.js"

/**
 * Kanonisierung nach RFC 8785 (JCS) für Mirror-Schnappschüsse — Spec 09
 * §Snapshot-Form: „Die Felder homeSpaceId, itemId, targetSpaceId, version,
 * item, authorDid werden nach RFC 8785 serialisiert (UTF-8). Die JWS signiert
 * exakt diese Bytes."
 *
 * Die JCS-Implementierung kommt aus `data-interface` (dort für die
 * deterministische Relation-Id nach Spec 08 gebaut) — sie wird
 * WIEDERVERWENDET, nicht dupliziert: zwei Kanonisierungen im selben Repo sind
 * zwei Gelegenheiten, unterschiedliche Bytes zu signieren.
 */

const encoder = new TextEncoder()

/**
 * Baut das kanonische Objekt mit GENAU den sechs signierten Feldern. Das
 * Auflesen Feld für Feld ist der Punkt: eine Payload mit Zusatzfeldern
 * kanonisiert zu denselben Bytes und fällt damit später in `verifySnapshot`
 * über den Vergleich mit dem JWS-Payload-Segment auf.
 */
export function signedSnapshotFields(payload: MirrorSnapshotPayload): Record<string, unknown> {
  return {
    homeSpaceId: payload.homeSpaceId,
    itemId: payload.itemId,
    targetSpaceId: payload.targetSpaceId,
    version: {
      seq: payload.version.seq,
      deviceId: payload.version.deviceId,
      ts: payload.version.ts,
    },
    item: payload.item ?? null,
    authorDid: payload.authorDid,
  }
}

/** Die kanonische Serialisierung als String (JCS sortiert die Schlüssel rekursiv). */
export function canonicalSnapshotString(payload: MirrorSnapshotPayload): string {
  return jcsCanonicalize(signedSnapshotFields(payload))
}

/** Die Bytes, die signiert werden und über die der tiebreak gebildet wird (UTF-8). */
export function canonicalSnapshotBytes(payload: MirrorSnapshotPayload): Uint8Array {
  return encoder.encode(canonicalSnapshotString(payload))
}

/** Die kanonische Serialisierung eines Items — Grundlage von {@link itemHash}. */
export function canonicalItemString(item: SerializedItem): string {
  return jcsCanonicalize(item as unknown as Record<string, unknown>)
}

/**
 * `sha256(kanonisches Item)`, lowercase Hex — der `publishedHash` der Registry
 * (Spec 09 §Ablage, Spec 12 Regel 5). Der Abgleich publiziert neu, sobald er
 * vom gespeicherten Hash abweicht; er ist damit der einzige Auslöser, der
 * Inhaltsänderungen erkennt, ohne die alte JWS aufzubewahren.
 */
export async function itemHash(item: SerializedItem): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonicalItemString(item)) as BufferSource,
  )
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
