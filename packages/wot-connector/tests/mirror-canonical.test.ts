import { describe, expect, it } from "vitest"

import { canonicalSnapshotBytes, canonicalSnapshotString, itemHash } from "../src/mirror/canonical.js"
import type { MirrorSnapshotPayload, SerializedItem } from "../src/types.js"

const ITEM: SerializedItem = {
  id: "task-1",
  type: "task",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "did:key:zAuthor",
  data: { title: "Beet gießen", status: "todo" },
}

const PAYLOAD: MirrorSnapshotPayload = {
  homeSpaceId: "home",
  itemId: "task-1",
  targetSpaceId: "garden",
  version: { seq: 1, deviceId: "dev-a", ts: "2026-01-02T00:00:00.000Z" },
  item: ITEM,
  authorDid: "did:key:zAuthor",
}

/**
 * Spec 09 §Snapshot-Form: kanonisiert werden GENAU die sechs Felder nach
 * RFC 8785. Signaturprüfung und Versionsvergleich müssen
 * implementierungsunabhängig dieselben Bytes sehen.
 */
describe("canonicalSnapshotBytes", () => {
  it("ist unabhängig von der Feldreihenfolge der Eingabe", () => {
    const reordered = {
      authorDid: PAYLOAD.authorDid,
      item: { data: { status: "todo", title: "Beet gießen" }, createdBy: ITEM.createdBy, type: "task", createdAt: ITEM.createdAt, id: "task-1" },
      version: { ts: PAYLOAD.version.ts, deviceId: "dev-a", seq: 1 },
      targetSpaceId: "garden",
      itemId: "task-1",
      homeSpaceId: "home",
    } as MirrorSnapshotPayload
    expect(canonicalSnapshotString(reordered)).toBe(canonicalSnapshotString(PAYLOAD))
  })

  it("sortiert die Schlüssel aufsteigend — die sechs Felder in fester Folge", () => {
    expect(canonicalSnapshotString(PAYLOAD)).toBe(
      '{"authorDid":"did:key:zAuthor","homeSpaceId":"home","item":' +
        '{"createdAt":"2026-01-01T00:00:00.000Z","createdBy":"did:key:zAuthor","data":' +
        '{"status":"todo","title":"Beet gießen"},"id":"task-1","type":"task"},' +
        '"itemId":"task-1","targetSpaceId":"garden","version":' +
        '{"deviceId":"dev-a","seq":1,"ts":"2026-01-02T00:00:00.000Z"}}',
    )
  })

  it("nimmt AUSSCHLIESSLICH die sechs signierten Felder auf", () => {
    const withExtra = { ...PAYLOAD, schmuggel: "nicht signiert" } as unknown as MirrorSnapshotPayload
    expect(canonicalSnapshotString(withExtra)).toBe(canonicalSnapshotString(PAYLOAD))
  })

  it("serialisiert den Tombstone als item: null", () => {
    const tombstone: MirrorSnapshotPayload = { ...PAYLOAD, item: null }
    expect(canonicalSnapshotString(tombstone)).toContain('"item":null')
  })

  it("bewahrt Unicode als UTF-8 und sortiert Schlüssel nach UTF-16-Code-Units", () => {
    const unicode: MirrorSnapshotPayload = {
      ...PAYLOAD,
      item: { ...ITEM, data: { z: "z", "ä": "ä", a: "a" } },
    }
    const text = canonicalSnapshotString(unicode)
    expect(text).toContain('"data":{"a":"a","z":"z","ä":"ä"}')
    // UTF-8, nicht \u-Escapes: zwei Bytes je Umlaut.
    const bytes = canonicalSnapshotBytes(unicode)
    expect(bytes).toEqual(new TextEncoder().encode(text))
    expect(bytes.length).toBeGreaterThan(text.length)
  })

  it("liefert für dieselbe Payload byte-identische Ergebnisse", () => {
    expect(canonicalSnapshotBytes(PAYLOAD)).toEqual(canonicalSnapshotBytes({ ...PAYLOAD }))
  })
})

describe("itemHash", () => {
  it("ist sha256 über das kanonische Item und feldreihenfolge-unabhängig", async () => {
    const reordered: SerializedItem = {
      data: { status: "todo", title: "Beet gießen" },
      createdBy: ITEM.createdBy,
      createdAt: ITEM.createdAt,
      type: "task",
      id: "task-1",
    } as SerializedItem
    expect(await itemHash(reordered)).toBe(await itemHash(ITEM))
    expect(await itemHash(ITEM)).toMatch(/^[0-9a-f]{64}$/)
  })

  it("ändert sich mit jeder Inhaltsänderung — der Auslöser des Abgleichs", async () => {
    const changed: SerializedItem = { ...ITEM, data: { ...ITEM.data, title: "Beet mulchen" } }
    expect(await itemHash(changed)).not.toBe(await itemHash(ITEM))
  })
})
