import type { MirrorBinding, MirrorHighWaterMark, MirrorSnapshotPayload } from "../types.js"
import { compareVersion } from "./version.js"

/**
 * Die Empfänger-Entscheidung aus Spec 09 Invariante 5, 6 und 8 — rein, ohne
 * Speicher: sie bekommt den verifizierten Schnappschuss, die Marke SEINES
 * Autors und die Bindung des logischen Schlüssels und sagt, was zu tun ist.
 * Das Schreiben (Slot materialisieren, Marke und Bindung persistieren)
 * verdrahtet eine spätere Scheibe.
 */
export type MirrorEvaluation =
  | { kind: "accept-live"; mark: MirrorHighWaterMark; bind?: MirrorBinding }
  | { kind: "accept-tombstone"; mark: MirrorHighWaterMark }
  | { kind: "reject"; reason: "not-newer" }
  | {
      kind: "conflict"
      mark: MirrorHighWaterMark
      boundAuthorDid: string
      foreignAuthorDid: string
    }

export interface EvaluateSnapshotInput {
  /** Das Ergebnis von `verifySnapshot` — Signatur und alle Formregeln sind bereits geprüft. */
  verified: { payload: MirrorSnapshotPayload; tiebreak: string }
  /**
   * Die Marke GENAU DIESES Autors für `(homeSpaceId, itemId)`, oder `null`.
   * Marken fremder DIDs sind eigene Marken (Invariante 6); wer hier die Marke
   * des gebundenen Signers für einen fremden Schnappschuss übergibt, bricht
   * die Strikt-größer-Regel je `authorDid`.
   */
  mark: MirrorHighWaterMark | null
  /** Die Bindung des logischen Schlüssels, oder `null` (noch nie ein Live-Schnappschuss). */
  binding: MirrorBinding | null
}

export function evaluateSnapshot(input: EvaluateSnapshotInput): MirrorEvaluation {
  const { payload, tiebreak } = input.verified
  const mark: MirrorHighWaterMark = {
    homeSpaceId: payload.homeSpaceId,
    itemId: payload.itemId,
    authorDid: payload.authorDid,
    seq: payload.version.seq,
    deviceId: payload.version.deviceId,
    tiebreak,
  }

  // Strikt größer, je authorDid, über Live UND Tombstone (Invariante 6 und 8).
  // Gleiche volle Version = identischer Schnappschuss = idempotenter
  // Wiederempfang; alles darunter ist Downgrade oder Replay — und nach einem
  // Tombstone genau die Resurrection, die Invariante 8 verhindert.
  if (input.mark && compareVersion(mark, input.mark) <= 0) return { kind: "reject", reason: "not-newer" }

  // Fremder Signer: NIE materialisieren, NIE umbinden — aber auch nie still
  // verwerfen. Die Marke wird geführt, der Herkunftskonflikt sichtbar gemacht.
  if (input.binding && input.binding.boundAuthorDid !== payload.authorDid) {
    return {
      kind: "conflict",
      mark,
      boundAuthorDid: input.binding.boundAuthorDid,
      foreignAuthorDid: payload.authorDid,
    }
  }

  // Ein Tombstone bindet NIE (Invariante 5): ein gefälschter Erst-Tombstone
  // könnte sonst den Schlüssel fremdbinden und den echten Autor aussperren.
  // Ohne Bindung bleibt er als ungebundene Marke stehen und sperrt nur ältere
  // Live-Schnappschüsse desselben Autors aus (Offline-Reihenfolge).
  if (payload.item === null) return { kind: "accept-tombstone", mark }

  // Die Erst-Annahme bindet — nur hier ist `authorDid` gegen `item.createdBy`
  // prüfbar (von `verifySnapshot` bereits erzwungen).
  if (input.binding) return { kind: "accept-live", mark }
  return {
    kind: "accept-live",
    mark,
    bind: { homeSpaceId: payload.homeSpaceId, itemId: payload.itemId, boundAuthorDid: payload.authorDid },
  }
}
