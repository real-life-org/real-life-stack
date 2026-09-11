import { WebCryptoProtocolCryptoAdapter } from "@real-life/wot-core"
import { beforeAll, describe, expect, it } from "vitest"

import { canonicalSnapshotBytes } from "../src/mirror/canonical.js"
import { mirrorMapKey } from "../src/mirror/keys.js"
import {
  MIRROR_SNAPSHOT_JWS_TYP,
  buildSnapshotPayload,
  isProfileSnapshot,
  signSnapshot,
  verifySnapshot,
} from "../src/mirror/snapshot.js"
import { tiebreakOf } from "../src/mirror/version.js"
import type { MirrorSnapshotPayload, SerializedItem } from "../src/types.js"
import { makeMirrorIdentity, type MirrorTestIdentity } from "./helpers/mirror-identity.js"

const protocolCrypto = new WebCryptoProtocolCryptoAdapter()
const HOME = "home-space"
const TARGET = "garden"

let author: MirrorTestIdentity
let stranger: MirrorTestIdentity

beforeAll(async () => {
  author = await makeMirrorIdentity()
  stranger = await makeMirrorIdentity()
})

/**
 * Ein Low-Level-Signierer für die Angriffsfälle: er signiert BELIEBIGE Bytes
 * als JWS-Payload und umgeht damit die Zusicherungen von `signSnapshot`. Nur
 * so lassen sich Schnappschüsse bauen, die ein ehrlicher Absender nie
 * erzeugen würde — genau die, gegen die `verifySnapshot` schützt.
 */
const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const fromBase64Url = (value: string): Uint8Array => {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function signRaw(
  payloadBytes: Uint8Array,
  identity: MirrorTestIdentity,
  header: Record<string, unknown> = { alg: "EdDSA", kid: identity.kid, typ: MIRROR_SNAPSHOT_JWS_TYP },
): Promise<string> {
  const b64 = toBase64Url
  const signingInput = `${b64(new TextEncoder().encode(JSON.stringify(header)))}.${b64(payloadBytes)}`
  const signature = await identity.signEd25519(new TextEncoder().encode(signingInput))
  return `${signingInput}.${b64(signature)}`
}

const signCanonical = (payload: MirrorSnapshotPayload, identity: MirrorTestIdentity) =>
  signRaw(canonicalSnapshotBytes(payload), identity)

function taskItem(overrides: Partial<SerializedItem> = {}): SerializedItem {
  return {
    id: "task-1",
    type: "task",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: author.did,
    data: { title: "Beet gießen" },
    ...overrides,
  }
}

function profileItem(overrides: Partial<SerializedItem> = {}): SerializedItem {
  return {
    id: author.did,
    type: "person",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: author.did,
    data: { displayName: "Anton", did: author.did },
    ...overrides,
  }
}

function payloadFor(
  item: SerializedItem | null,
  overrides: Partial<MirrorSnapshotPayload> = {},
): MirrorSnapshotPayload {
  return {
    homeSpaceId: HOME,
    itemId: item ? item.id : "task-1",
    targetSpaceId: TARGET,
    version: { seq: 1, deviceId: "dev-a", ts: "2026-01-02T00:00:00.000Z" },
    item,
    authorDid: author.did,
    ...overrides,
  }
}

const resolve = (did: string) =>
  did === author.did ? author.publicKey : did === stranger.did ? stranger.publicKey : null

const verify = (jws: string, options: { mapKey?: string; ownSpaceId?: string } = {}) =>
  verifySnapshot({
    jws,
    mapKey: options.mapKey ?? mirrorMapKey(HOME, "task-1"),
    ownSpaceId: options.ownSpaceId ?? TARGET,
    resolvePublicKey: resolve,
    crypto: protocolCrypto,
  })

describe("buildSnapshotPayload", () => {
  const base = {
    homeSpaceId: HOME,
    targetSpaceId: TARGET,
    itemId: "task-1",
    authorDid: "",
    seq: 4,
    deviceId: "dev-a",
    ts: "2026-01-02T00:00:00.000Z",
  }

  it("baut genau die Snapshot-Form aus Spec 09", () => {
    expect(buildSnapshotPayload({ ...base, authorDid: author.did, item: taskItem() })).toEqual(
      payloadFor(taskItem(), { version: { seq: 4, deviceId: "dev-a", ts: "2026-01-02T00:00:00.000Z" } }),
    )
  })

  it("verweigert einen Live-Schnappschuss unter fremder Autorschaft (Invariante 5)", () => {
    expect(() => buildSnapshotPayload({ ...base, authorDid: stranger.did, item: taskItem() })).toThrow(/createdBy/)
  })

  it("verweigert einen Live-Schnappschuss unter fremder itemId (Invariante 6)", () => {
    expect(() =>
      buildSnapshotPayload({ ...base, itemId: "task-2", authorDid: author.did, item: taskItem() }),
    ).toThrow(/item\.id/)
  })

  it("erlaubt den Tombstone ohne Item", () => {
    expect(buildSnapshotPayload({ ...base, authorDid: author.did, item: null }).item).toBeNull()
  })
})

describe("signSnapshot / verifySnapshot — Roundtrip", () => {
  it("verifiziert einen echt signierten Live-Schnappschuss und liefert den tiebreak", async () => {
    const payload = payloadFor(taskItem())
    const result = await verify(await signSnapshot(payload, author))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload).toEqual(payload)
    expect(result.tiebreak).toBe(await tiebreakOf(canonicalSnapshotBytes(payload)))
  })

  it("signiert exakt die kanonischen Bytes — das Payload-Segment IST die Kanonisierung", async () => {
    const payload = payloadFor(taskItem())
    const segment = (await signSnapshot(payload, author)).split(".")[1] as string
    expect(fromBase64Url(segment)).toEqual(canonicalSnapshotBytes(payload))
  })

  it("verifiziert einen Tombstone", async () => {
    const jws = await signSnapshot(
      payloadFor(null, { version: { seq: 2, deviceId: "dev-a", ts: "2026-01-03T00:00:00.000Z" } }),
      author,
    )
    const result = await verify(jws)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.payload.item).toBeNull()
  })
})

describe("verifySnapshot — jede Ablehnungsregel einzeln", () => {
  it("lehnt eine kaputte JWS ab", async () => {
    expect(await verify("nicht.einejws")).toEqual({ ok: false, reason: "malformed-jws" })
  })

  it("lehnt einen fremden JWS-Header ab", async () => {
    const bytes = canonicalSnapshotBytes(payloadFor(taskItem()))
    const jws = await signRaw(bytes, author, { alg: "EdDSA", kid: author.kid, typ: "rls-claim+jws" })
    expect(await verify(jws)).toEqual({ ok: false, reason: "unexpected-jws-header" })
  })

  it("lehnt eine Payload mit fehlenden Feldern ab", async () => {
    const jws = await signRaw(new TextEncoder().encode(JSON.stringify({ homeSpaceId: HOME })), author)
    expect(await verify(jws)).toEqual({ ok: false, reason: "malformed-payload" })
  })

  // Invariante: „Unsignierte äußere Kopien der Felder sind unzulässig" — hier
  // die Innenseite davon: eine Payload mit Zusatzfeldern oder abweichender
  // Serialisierung ist NICHT die kanonische Payload und wird abgelehnt.
  it("lehnt eine nicht-kanonische Payload ab (kein Feldschmuggel)", async () => {
    const smuggled = { ...payloadFor(taskItem()), schmuggel: "x" }
    const jws = await signRaw(new TextEncoder().encode(JSON.stringify(smuggled)), author)
    expect(await verify(jws)).toEqual({ ok: false, reason: "non-canonical-payload" })
  })

  // Spec 09 §Ablage / Spec 12 Regel 8: ein gültig signierter Schnappschuss
  // unter fremdem Map-Schlüssel gilt als ungültiger Slot.
  it("lehnt einen fremden Map-Schlüssel ab", async () => {
    const jws = await signSnapshot(payloadFor(taskItem()), author)
    expect(await verify(jws, { mapKey: mirrorMapKey("anderes-home", "task-1") })).toEqual({
      ok: false,
      reason: "foreign-map-key",
    })
    expect(await verify(jws, { mapKey: mirrorMapKey(HOME, "task-2") })).toEqual({
      ok: false,
      reason: "foreign-map-key",
    })
  })

  // Invariante 4: die Freigabe ist an den Ziel-Space gebunden — eine Bridge
  // kann sie nicht in einen anderen Space weiterkopieren.
  it("lehnt eine Freigabe für einen anderen Ziel-Space ab", async () => {
    const jws = await signSnapshot(payloadFor(taskItem()), author)
    expect(await verify(jws, { ownSpaceId: "camp" })).toEqual({ ok: false, reason: "foreign-target-space" })
  })

  it("lehnt item.id ≠ itemId ab (Invariante 6)", async () => {
    const jws = await signCanonical(payloadFor(taskItem({ id: "task-9" }), { itemId: "task-1" }), author)
    expect(await verify(jws)).toEqual({ ok: false, reason: "item-id-mismatch" })
  })

  it("lehnt item.createdBy ≠ authorDid ab (Invariante 5 und 6)", async () => {
    const jws = await signCanonical(payloadFor(taskItem({ createdBy: stranger.did })), author)
    expect(await verify(jws)).toEqual({ ok: false, reason: "author-mismatch" })
  })

  it("lehnt eine unauflösbare Signer-DID ab", async () => {
    const unknown = await makeMirrorIdentity()
    const payload = payloadFor(taskItem({ createdBy: unknown.did }), { authorDid: unknown.did })
    expect(await verify(await signCanonical(payload, unknown))).toEqual({ ok: false, reason: "unknown-signer" })
  })

  it("lehnt eine Signatur ab, die nicht zur authorDid gehört", async () => {
    // Der Fremde signiert eine Payload, die den Autor behauptet.
    expect(await verify(await signCanonical(payloadFor(taskItem()), stranger))).toEqual({
      ok: false,
      reason: "bad-signature",
    })
  })

  it("lehnt eine nachträglich veränderte Payload ab", async () => {
    const [header, , signature] = (await signSnapshot(payloadFor(taskItem()), author)).split(".")
    const tampered = canonicalSnapshotBytes(payloadFor(taskItem({ data: { title: "manipuliert" } })))
    expect(await verify(`${header}.${toBase64Url(tampered)}.${signature}`)).toEqual({
      ok: false,
      reason: "bad-signature",
    })
  })
})

describe("verifySnapshot — Profil-Overlay (Spec 12 Regel 8)", () => {
  const verifyProfile = (jws: string, itemId: string) =>
    verifySnapshot({
      jws,
      mapKey: mirrorMapKey(HOME, itemId),
      ownSpaceId: TARGET,
      resolvePublicKey: resolve,
      crypto: protocolCrypto,
    })

  it("erkennt ein person-Item mit data.did als Profil", () => {
    expect(isProfileSnapshot(payloadFor(profileItem(), { itemId: author.did }))).toBe(true)
    expect(isProfileSnapshot(payloadFor(taskItem()))).toBe(false)
    // Platzhalter ohne data.did sind KEIN Profil (Spec 12 Regel 3).
    expect(isProfileSnapshot(payloadFor(taskItem({ type: "person", data: { displayName: "Dritte" } })))).toBe(false)
  })

  it("verifiziert das eigene Profil", async () => {
    const jws = await signSnapshot(payloadFor(profileItem(), { itemId: author.did }), author)
    expect((await verifyProfile(jws, author.did)).ok).toBe(true)
  })

  it("lehnt ein Profil unter fremder itemId ab", async () => {
    const jws = await signCanonical(payloadFor(profileItem({ id: "fremd" }), { itemId: "fremd" }), author)
    expect(await verifyProfile(jws, "fremd")).toEqual({ ok: false, reason: "profile-id-mismatch" })
  })

  it("lehnt ein Profil mit fremder data.did ab", async () => {
    const payload = payloadFor(profileItem({ data: { displayName: "Anton", did: stranger.did } }), {
      itemId: author.did,
    })
    expect(await verifyProfile(await signCanonical(payload, author), author.did)).toEqual({
      ok: false,
      reason: "profile-did-mismatch",
    })
  })

  // Ein Tombstone trägt kein Item; erkennbar bleibt der Profil-Schlüssel nur
  // an der DID-Form der itemId (Entscheidung, s. snapshot.ts).
  it("lehnt einen Tombstone auf dem DID-Schlüssel einer anderen Person ab", async () => {
    const jws = await signSnapshot(payloadFor(null, { itemId: stranger.did }), author)
    expect(await verifyProfile(jws, stranger.did)).toEqual({ ok: false, reason: "profile-id-mismatch" })
  })

  it("erlaubt den Tombstone auf dem eigenen Profil-Schlüssel", async () => {
    const jws = await signSnapshot(payloadFor(null, { itemId: author.did }), author)
    expect((await verifyProfile(jws, author.did)).ok).toBe(true)
  })
})
