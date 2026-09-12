import { describe, expect, it } from "vitest"

import { compareVersion, tiebreakOf } from "../src/mirror/version.js"

/**
 * Spec 09 Invariante 6: die totale Ordnung ist `(seq, deviceId, tiebreak)`
 * lexikographisch, `ts` ist NICHT Teil davon.
 */
describe("compareVersion", () => {
  const at = (seq: number, deviceId: string, tiebreak: string) => ({ seq, deviceId, tiebreak })

  it("ordnet zuerst nach seq", () => {
    expect(compareVersion(at(1, "z", "ff"), at(2, "a", "00"))).toBeLessThan(0)
    expect(compareVersion(at(2, "a", "00"), at(1, "z", "ff"))).toBeGreaterThan(0)
  })

  it("ordnet bei gleicher seq nach deviceId", () => {
    expect(compareVersion(at(1, "a", "ff"), at(1, "b", "00"))).toBeLessThan(0)
  })

  it("entscheidet bei gleicher (seq, deviceId) über den tiebreak", () => {
    expect(compareVersion(at(1, "a", "aa"), at(1, "a", "ab"))).toBeLessThan(0)
    expect(compareVersion(at(1, "a", "ab"), at(1, "a", "aa"))).toBeGreaterThan(0)
  })

  it("ist auf der vollen Position gleich — idempotenter Wiederempfang", () => {
    expect(compareVersion(at(3, "d", "cc"), at(3, "d", "cc"))).toBe(0)
  })

  it("ignoriert Felder außerhalb der Ordnung (ts)", () => {
    const a = { ...at(1, "a", "aa"), ts: "2026-01-01T00:00:00.000Z" }
    const b = { ...at(1, "a", "aa"), ts: "2030-01-01T00:00:00.000Z" }
    expect(compareVersion(a, b)).toBe(0)
  })

  it("sortiert eine Liste stabil und deterministisch", () => {
    const list = [at(2, "b", "00"), at(1, "b", "ff"), at(2, "a", "ff"), at(2, "b", "01")]
    const sorted = [...list].sort(compareVersion).map((p) => `${p.seq}/${p.deviceId}/${p.tiebreak}`)
    expect(sorted).toEqual(["1/b/ff", "2/a/ff", "2/b/00", "2/b/01"])
  })
})

describe("tiebreakOf", () => {
  it("ist sha256 in lowercase hex", async () => {
    expect(await tiebreakOf(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    )
    expect(await tiebreakOf(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    )
  })
})
