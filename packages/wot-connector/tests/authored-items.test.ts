import { beforeAll, describe, expect, it, vi } from "vitest"
import { createObservable, itemContentHash, verifyItemClaim } from "@real-life-stack/data-interface"
import { WotConnector } from "../src/wot-connector.js"
import type { RlsSpaceDoc } from "../src/types.js"

// Signed mode (spec 08 → Aussagen einer Person): real did:key identities, so
// claims are produced and verified for real.
interface TestIdentity { did: string; signEd25519(bytes: Uint8Array): Promise<Uint8Array> }
let alice: TestIdentity
let bob: TestIdentity

async function makeIdentity(): Promise<TestIdentity> {
  const keyPair = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey))
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  const bytes = new Uint8Array([0xed, 0x01, ...raw])
  let n = 0n
  for (const byte of bytes) n = (n << 8n) | BigInt(byte)
  let encoded = ""
  while (n > 0n) { encoded = B58[Number(n % 58n)] + encoded; n /= 58n }
  return {
    did: `did:key:z${encoded}`,
    signEd25519: async (input: Uint8Array) =>
      new Uint8Array(await crypto.subtle.sign("Ed25519", keyPair.privateKey, input as BufferSource)),
  }
}

beforeAll(async () => {
  alice = await makeIdentity()
  bob = await makeIdentity()
})

function space() {
  const value: RlsSpaceDoc = { _type: "rls", items: {}, metadata: { name: "test", modules: [] } }
  return {
    value,
    getDoc: () => value,
    transact: vi.fn((fn: (next: RlsSpaceDoc) => void) => { fn(value) }),
    transactDurable: vi.fn(async (fn: (next: RlsSpaceDoc) => void) => { fn(value) }),
    onRemoteUpdate: () => () => {},
    close: vi.fn(),
  }
}

/** Production methods, faked only at the adapter boundary. Two connectors on
    the same space handle stand for two members of the space. */
function connectorFor(identity: TestIdentity, handle: ReturnType<typeof space>): WotConnector {
  const value = Object.create(WotConnector.prototype) as any
  value.handleReady = Promise.resolve()
  value.currentHandle = handle
  value.currentGroupId = "space"
  value.currentUserObs = createObservable({ id: identity.did, displayName: identity.did })
  value.identity = { getDid: () => identity.did, signEd25519: identity.signEd25519 }
  value.activityObservables = new Map()
  value.activityDirty = false
  value.activityReconciliations = new Map()
  value.handleOpenGeneration = 0
  value.crossGroupIndex = null
  value.notifyAllObservers = vi.fn(() => { value.itemCache = null })
  value.replication = { openSpace: vi.fn(async () => handle) }
  return value as WotConnector
}

describe("WotConnector — authorial items (spec 08, signed)", () => {
  it("signs a comment on create, bound to its target; the verdict is valid", async () => {
    const handle = space()
    const aliceSide = connectorFor(alice, handle)
    const created = await aliceSide.createItem({
      type: "comment",
      createdBy: alice.did,
      data: { content: "Hallo", claim: "forged.claim.jws" },
      relations: [{ predicate: "commentOn", target: "item:post-a" }],
    })
    expect(created.data.claim).not.toBe("forged.claim.jws")
    expect(await aliceSide.verifyItemClaim(created)).toBe("valid")

    // Moving the stored comment to another target breaks the claim.
    const stored = (await aliceSide.getItem(created.id))!
    const moved = { ...stored, relations: [{ predicate: "commentOn", target: "item:post-b" }] }
    expect(await verifyItemClaim(moved)).toBe("invalid")
  })

  it("another member may change fields outside the content; the claim stays valid", async () => {
    const handle = space()
    const created = await connectorFor(alice, handle).createItem({
      type: "statement", createdBy: alice.did, data: { title: "gesagt" },
    })
    const bobSide = connectorFor(bob, handle)
    await bobSide.updateItem(created.id, { tags: ["modul:grundsaetze"] })
    const after = (await bobSide.getItem(created.id))!
    expect(after.tags).toEqual(["modul:grundsaetze"])
    expect(await bobSide.verifyItemClaim(after)).toBe("valid")

    await expect(bobSide.updateItem(created.id, { data: { title: "untergeschoben" } })).rejects.toThrow(/author/)
    expect((await bobSide.getItem(created.id))!.data.title).toBe("gesagt")
  })

  it("the author's content change is re-signed, until another member's vote freezes it", async () => {
    const handle = space()
    const aliceSide = connectorFor(alice, handle)
    const created = await aliceSide.createItem({ type: "statement", createdBy: alice.did, data: { title: "erste Fassung" } })
    const edited = await aliceSide.updateItem(created.id, { data: { title: "zweite Fassung" } })
    expect(await aliceSide.verifyItemClaim(edited)).toBe("valid")

    const bobSide = connectorFor(bob, handle)
    await bobSide.createRelationRecord({
      predicate: "votesOn",
      from: `global:${bob.did}`,
      to: `item:${created.id}`,
      fields: { value: "green", contentHash: (await itemContentHash(edited))! },
    })
    await expect(aliceSide.updateItem(created.id, { data: { title: "dritte Fassung" } })).rejects.toThrow(/frozen/)
    const frozen = (await aliceSide.getItem(created.id))!
    expect(frozen.data.title).toBe("zweite Fassung")
    expect(await aliceSide.verifyItemClaim(frozen)).toBe("valid")
  })
})
