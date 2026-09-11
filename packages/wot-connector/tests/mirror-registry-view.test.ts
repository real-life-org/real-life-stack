import { describe, expect, it } from "vitest"

import { compareAdmissionOrUndefined, deriveRegistryView, nextSeq, nextStatusSeq } from "../src/mirror/registry-view.js"
import type { MirrorRegistryContribution, MirrorRegistryEntry } from "../src/types.js"

const gen = (keyGeneration: number) => ({ keyGeneration })

function contribution(partial: Partial<MirrorRegistryContribution>): MirrorRegistryContribution {
  return {
    statusSeq: 1,
    status: "accepted",
    seq: 1,
    tiebreak: "00",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  }
}

/**
 * Spec 09 §Ablage und Registry (+ Spec 12 Regel 9): die Lesesicht entsteht
 * deterministisch aus allen Gerätebeiträgen — Position als Maximum der
 * Ordnung, Status nach höchster Aufnahme-Kennung und darin nach
 * Widerrufs-Kausalität.
 */
describe("deriveRegistryView — Position", () => {
  it("nimmt das Maximum der Ordnung (seq, deviceId, tiebreak)", () => {
    const view = deriveRegistryView({
      a: contribution({ seq: 4, tiebreak: "ff", publishedHash: "hash-a" }),
      b: contribution({ seq: 7, tiebreak: "00", publishedHash: "hash-b" }),
    })
    expect(view).toMatchObject({ seq: 7, deviceId: "b", tiebreak: "00", publishedHash: "hash-b" })
  })

  it("entscheidet bei gleicher seq über deviceId, dann tiebreak", () => {
    expect(
      deriveRegistryView({
        a: contribution({ seq: 5, tiebreak: "ff" }),
        b: contribution({ seq: 5, tiebreak: "00" }),
      }),
    ).toMatchObject({ deviceId: "b" })
    expect(
      deriveRegistryView({
        a: contribution({ seq: 5, tiebreak: "aa" }),
      }),
    ).toMatchObject({ deviceId: "a", tiebreak: "aa" })
  })

  it("liefert publishedHash der GEWINNENDEN Position — leer nach einem Tombstone", () => {
    const view = deriveRegistryView({
      a: contribution({ seq: 1, publishedHash: "hash-a" }),
      b: contribution({ seq: 2 }),
    })
    expect(view?.deviceId).toBe("b")
    expect(view?.publishedHash).toBeUndefined()
  })

  it("liefert null für einen leeren Eintrag", () => {
    expect(deriveRegistryView({})).toBeNull()
  })
})

describe("deriveRegistryView — Aufnahme-Kennung", () => {
  it("nimmt den Status aus der höchsten Kennung", () => {
    const view = deriveRegistryView({
      alt: contribution({ status: "revoked", statusSeq: 9, admission: gen(1) }),
      neu: contribution({ status: "accepted", statusSeq: 1, admission: gen(2) }),
    })
    expect(view?.status).toBe("accepted")
    expect(view?.admission).toEqual(gen(2))
  })

  it("legt keine Kennung (undefined) unter jede Kennung", () => {
    const view = deriveRegistryView({
      ohne: contribution({ status: "accepted", statusSeq: 9 }),
      mit: contribution({ status: "revoked", statusSeq: 1, admission: gen(0) }),
    })
    expect(view?.status).toBe("revoked")
    expect(view?.admission).toEqual(gen(0))
  })

  it("behandelt zwei fehlende Kennungen als dieselbe Aufnahme", () => {
    const view = deriveRegistryView({
      a: contribution({ status: "revoked", statusSeq: 2 }),
      b: contribution({ status: "accepted", statusSeq: 3 }),
    })
    expect(view?.status).toBe("revoked")
    expect(view?.admission).toBeUndefined()
  })
})

describe("deriveRegistryView — Widerrufs-Kausalität", () => {
  // Das Gegenbeispiel aus Spec 09: ein Widerruf, den keine Freigabe gesehen
  // hat, gewinnt auch gegen eine nebenläufige Freigabe mit höherem statusSeq.
  it("bleibt revoked, solange ein unabgedeckter Widerruf existiert", () => {
    const view = deriveRegistryView({
      // B hat offline erst widerrufen (2) und dann selbst wieder freigegeben (3).
      B: contribution({ status: "accepted", statusSeq: 3, supersedes: { B: 2 } }),
      // A hat nebenläufig widerrufen — B kannte diesen Widerruf nicht.
      A: contribution({ status: "revoked", statusSeq: 2 }),
    })
    expect(view?.status).toBe("revoked")
  })

  it("wird accepted, sobald eine Freigabe beide Widerrufe abdeckt", () => {
    const view = deriveRegistryView({
      B: contribution({ status: "accepted", statusSeq: 4, supersedes: { A: 2, B: 2 } }),
      A: contribution({ status: "revoked", statusSeq: 2 }),
    })
    expect(view?.status).toBe("accepted")
  })

  it("deckt nur ab, wenn supersedes mindestens den statusSeq des Widerrufs erreicht", () => {
    expect(
      deriveRegistryView({
        A: contribution({ status: "revoked", statusSeq: 5 }),
        B: contribution({ status: "accepted", statusSeq: 9, supersedes: { A: 4 } }),
      })?.status,
    ).toBe("revoked")
    expect(
      deriveRegistryView({
        A: contribution({ status: "revoked", statusSeq: 5 }),
        B: contribution({ status: "accepted", statusSeq: 9, supersedes: { A: 5 } }),
      })?.status,
    ).toBe("accepted")
  })

  it("vergleicht Kausalität nur innerhalb derselben Kennung", () => {
    const view = deriveRegistryView({
      A: contribution({ status: "revoked", statusSeq: 7, admission: gen(1) }),
      B: contribution({ status: "accepted", statusSeq: 1, admission: gen(2) }),
    })
    expect(view?.status).toBe("accepted")
  })
})

describe("deriveRegistryView — pending-Overlay (Spec 12 Regel 9)", () => {
  it("ist pending, wenn ein unabgedeckter pending-Beitrag existiert", () => {
    const view = deriveRegistryView({
      A: contribution({ status: "pending", statusSeq: 1, admission: gen(2) }),
      B: contribution({ status: "accepted", statusSeq: 2, admission: gen(2) }),
    })
    expect(view?.status).toBe("pending")
  })

  it("wird accepted, sobald die Annahme den pending-Beitrag abdeckt", () => {
    const view = deriveRegistryView({
      A: contribution({ status: "pending", statusSeq: 1, admission: gen(2) }),
      B: contribution({ status: "accepted", statusSeq: 2, admission: gen(2), supersedes: { A: 1 } }),
    })
    expect(view?.status).toBe("accepted")
  })

  it("lässt den Widerruf vor pending gewinnen", () => {
    const view = deriveRegistryView({
      A: contribution({ status: "pending", statusSeq: 1 }),
      B: contribution({ status: "revoked", statusSeq: 1 }),
    })
    expect(view?.status).toBe("revoked")
  })

  it("ist accepted, wenn nur Freigaben vorliegen", () => {
    expect(deriveRegistryView({ A: contribution({ status: "accepted" }) })?.status).toBe("accepted")
  })
})

describe("nextSeq", () => {
  it("zählt HOME-WEIT über alle Ziele desselben Items", () => {
    const gardenEntry: MirrorRegistryEntry = { byDevice: { a: contribution({ seq: 3 }) } }
    const campEntry: MirrorRegistryEntry = { byDevice: { a: contribution({ seq: 11 }), b: contribution({ seq: 7 }) } }
    expect(nextSeq([gardenEntry, campEntry])).toBe(12)
  })

  it("beginnt bei 1, wenn es noch keine Publikation gibt", () => {
    expect(nextSeq([])).toBe(1)
    expect(nextSeq([{ byDevice: {} }])).toBe(1)
  })

  // Ohne Grenze gäbe `max + 1` wieder `max` zurück: jeder neue Schnappschuss
  // trüge dieselbe Position und fiele beim Empfänger unter die
  // Strikt-größer-Regel — der Mirror fröre still ein.
  it("scheitert laut, statt am Rand des sicheren Ganzzahlbereichs zu stagnieren", () => {
    expect(() => nextSeq([{ byDevice: { a: contribution({ seq: Number.MAX_SAFE_INTEGER }) } }])).toThrow(
      /Ganzzahlbereich/,
    )
    expect(() => nextSeq([{ byDevice: { a: contribution({ seq: Number.MAX_SAFE_INTEGER - 1 }) } }])).toThrow(
      /Ganzzahlbereich/,
    )
    expect(nextSeq([{ byDevice: { a: contribution({ seq: Number.MAX_SAFE_INTEGER - 2 }) } }])).toBe(
      Number.MAX_SAFE_INTEGER - 1,
    )
  })
})

describe("nextStatusSeq", () => {
  it("ist 1 + max(beobachtet)", () => {
    expect(nextStatusSeq({ a: contribution({ statusSeq: 4 }), b: contribution({ statusSeq: 9 }) })).toBe(10)
    expect(nextStatusSeq({})).toBe(1)
  })
})

describe("compareAdmissionOrUndefined", () => {
  it("ordnet undefined unter jede Kennung und Kennungen nach keyGeneration", () => {
    expect(compareAdmissionOrUndefined(undefined, gen(0))).toBeLessThan(0)
    expect(compareAdmissionOrUndefined(gen(0), undefined)).toBeGreaterThan(0)
    expect(compareAdmissionOrUndefined(undefined, undefined)).toBe(0)
    expect(compareAdmissionOrUndefined(gen(1), gen(2))).toBeLessThan(0)
    expect(compareAdmissionOrUndefined(gen(2), gen(2))).toBe(0)
  })
})
