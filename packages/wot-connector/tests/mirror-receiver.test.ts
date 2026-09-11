import { describe, expect, it } from "vitest"

import { evaluateSnapshot } from "../src/mirror/receiver.js"
import type { MirrorBinding, MirrorHighWaterMark, MirrorSnapshotPayload, SerializedItem } from "../src/types.js"

const HOME = "home-space"
const TARGET = "garden"
const AUTHOR = "did:key:zAuthor"
const FOREIGN = "did:key:zFremd"

const item = (createdBy = AUTHOR): SerializedItem => ({
  id: "task-1",
  type: "task",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy,
  data: { title: "Beet gießen" },
})

function verified(
  options: { seq: number; deviceId?: string; tiebreak?: string; live?: boolean; authorDid?: string } ,
): { payload: MirrorSnapshotPayload; tiebreak: string } {
  const authorDid = options.authorDid ?? AUTHOR
  return {
    payload: {
      homeSpaceId: HOME,
      itemId: "task-1",
      targetSpaceId: TARGET,
      version: { seq: options.seq, deviceId: options.deviceId ?? "dev-a", ts: "2026-01-02T00:00:00.000Z" },
      item: options.live === false ? null : item(authorDid),
      authorDid,
    },
    tiebreak: options.tiebreak ?? "aa",
  }
}

const mark = (
  seq: number,
  authorDid = AUTHOR,
  deviceId = "dev-a",
  tiebreak = "aa",
): MirrorHighWaterMark => ({ homeSpaceId: HOME, itemId: "task-1", authorDid, seq, deviceId, tiebreak })

const binding = (boundAuthorDid = AUTHOR): MirrorBinding => ({
  homeSpaceId: HOME,
  itemId: "task-1",
  boundAuthorDid,
})

/** Spec 09 Invariante 5, 6 und 8. */
describe("evaluateSnapshot — Erst-Annahme und Bindung", () => {
  it("bindet den logischen Schlüssel beim ersten Live-Schnappschuss", () => {
    const result = evaluateSnapshot({ verified: verified({ seq: 1 }), mark: null, binding: null })
    expect(result).toEqual({
      kind: "accept-live",
      mark: mark(1),
      bind: binding(),
    })
  })

  it("bindet NICHT erneut, wenn die Bindung schon steht", () => {
    const result = evaluateSnapshot({ verified: verified({ seq: 2 }), mark: mark(1), binding: binding() })
    expect(result.kind).toBe("accept-live")
    if (result.kind !== "accept-live") return
    expect(result.bind).toBeUndefined()
    expect(result.mark).toEqual(mark(2))
  })

  // Ein gefälschter Erst-Tombstone darf die Identität NICHT fremdbinden.
  it("bindet bei einem Tombstone nie — hält ihn aber als ungebundene Marke", () => {
    const result = evaluateSnapshot({ verified: verified({ seq: 3, live: false }), mark: null, binding: null })
    expect(result).toEqual({ kind: "accept-tombstone", mark: mark(3) })
  })
})

describe("evaluateSnapshot — Strikt-größer je authorDid", () => {
  it("lehnt dieselbe volle Version ab (idempotenter Wiederempfang)", () => {
    expect(evaluateSnapshot({ verified: verified({ seq: 2 }), mark: mark(2), binding: binding() })).toEqual({
      kind: "reject",
      reason: "not-newer",
    })
  })

  it("lehnt ein Downgrade ab", () => {
    expect(evaluateSnapshot({ verified: verified({ seq: 1 }), mark: mark(2), binding: binding() })).toEqual({
      kind: "reject",
      reason: "not-newer",
    })
  })

  it("entscheidet bei gleicher seq über deviceId und tiebreak", () => {
    expect(
      evaluateSnapshot({
        verified: verified({ seq: 2, deviceId: "dev-b" }),
        mark: mark(2, AUTHOR, "dev-a"),
        binding: binding(),
      }).kind,
    ).toBe("accept-live")
    expect(
      evaluateSnapshot({
        verified: verified({ seq: 2, tiebreak: "ab" }),
        mark: mark(2, AUTHOR, "dev-a", "ac"),
        binding: binding(),
      }),
    ).toEqual({ kind: "reject", reason: "not-newer" })
  })
})

describe("evaluateSnapshot — Tombstone und Resurrection (Invariante 8)", () => {
  it("nimmt den Tombstone des gebundenen Signers an", () => {
    expect(evaluateSnapshot({ verified: verified({ seq: 4, live: false }), mark: mark(3), binding: binding() })).toEqual(
      { kind: "accept-tombstone", mark: mark(4) },
    )
  })

  it("verwirft einen älteren Live-Schnappschuss NACH dem Tombstone", () => {
    expect(evaluateSnapshot({ verified: verified({ seq: 3 }), mark: mark(4), binding: binding() })).toEqual({
      kind: "reject",
      reason: "not-newer",
    })
  })

  it("lässt eine erneute Freigabe oberhalb des Tombstones zu", () => {
    expect(evaluateSnapshot({ verified: verified({ seq: 5 }), mark: mark(4), binding: binding() }).kind).toBe(
      "accept-live",
    )
  })

  // Offline-Reihenfolge: der Tombstone kommt vor dem Live-Schnappschuss an.
  it("sperrt über die ungebundene Tombstone-Marke ältere Live-Schnappschüsse aus", () => {
    const afterTombstone = evaluateSnapshot({
      verified: verified({ seq: 5, live: false }),
      mark: null,
      binding: null,
    })
    expect(afterTombstone.kind).toBe("accept-tombstone")
    expect(
      evaluateSnapshot({ verified: verified({ seq: 4 }), mark: mark(5), binding: null }),
    ).toEqual({ kind: "reject", reason: "not-newer" })
    // Ein NEUERER Live-Schnappschuss desselben Autors bindet dann doch.
    expect(evaluateSnapshot({ verified: verified({ seq: 6 }), mark: mark(5), binding: null })).toEqual({
      kind: "accept-live",
      mark: mark(6),
      bind: binding(),
    })
  })
})

describe("evaluateSnapshot — fremde Signer (Invariante 5)", () => {
  it("materialisiert nie, bindet nie um, macht den Konflikt aber sichtbar", () => {
    const result = evaluateSnapshot({
      verified: verified({ seq: 9, authorDid: FOREIGN }),
      mark: null,
      binding: binding(),
    })
    expect(result).toEqual({
      kind: "conflict",
      boundAuthorDid: AUTHOR,
      foreignAuthorDid: FOREIGN,
      mark: mark(9, FOREIGN),
    })
  })

  it("führt die Marke des fremden Signers getrennt und strikt größer", () => {
    expect(
      evaluateSnapshot({
        verified: verified({ seq: 9, authorDid: FOREIGN }),
        mark: mark(9, FOREIGN),
        binding: binding(),
      }),
    ).toEqual({ kind: "reject", reason: "not-newer" })
  })

  it("gilt auch für einen fremden Tombstone — keine stille Verwerfung", () => {
    const result = evaluateSnapshot({
      verified: verified({ seq: 2, live: false, authorDid: FOREIGN }),
      mark: null,
      binding: binding(),
    })
    expect(result.kind).toBe("conflict")
  })
})
