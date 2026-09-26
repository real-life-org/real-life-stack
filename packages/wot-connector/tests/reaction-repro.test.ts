import { beforeAll, describe, expect, it, vi } from "vitest"
import { createObservable } from "@real-life-stack/data-interface"
import { WotConnector } from "../src/wot-connector.js"
import type { RlsSpaceDoc } from "../src/types.js"

// Reactions are authorial items (spec 08): the signed connector signs them,
// so the harness needs a real did:key identity with a working signer.
let ALICE = ""
let signEd25519: (bytes: Uint8Array) => Promise<Uint8Array>
beforeAll(async () => {
  const keyPair = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey))
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  const bytes = new Uint8Array([0xed, 0x01, ...raw])
  let n = 0n
  for (const byte of bytes) n = (n << 8n) | BigInt(byte)
  let encoded = ""
  while (n > 0n) { encoded = B58[Number(n % 58n)] + encoded; n /= 58n }
  ALICE = `did:key:z${encoded}`
  signEd25519 = async (input) => new Uint8Array(await crypto.subtle.sign("Ed25519", keyPair.privateKey, input as BufferSource))
})

function doc(): RlsSpaceDoc {
  return { _type: "rls", items: {}, metadata: { name: "test", modules: [] } }
}

function handle(value = doc()) {
  return {
    value,
    getDoc: () => value,
    transact: vi.fn((fn: (next: RlsSpaceDoc) => void) => { fn(value) }),
    onRemoteUpdate: () => () => {},
    close: vi.fn(),
  }
}

function connector(current: ReturnType<typeof handle>) {
  const value = Object.create(WotConnector.prototype) as any
  value.handleReady = Promise.resolve()
  value.currentHandle = current
  value.currentGroupId = "source"
  value.currentUserObs = createObservable({ id: ALICE, displayName: "Alice" })
  value.identity = { getDid: () => ALICE, signEd25519 }
  value.activityObservables = new Map()
  value.activityDirty = false
  value.activityReconciliations = new Map()
  value.crossGroupIndex = null
  value.notifyAllObservers = vi.fn()
  value.replication = { openSpace: vi.fn(async () => current) }
  return value as WotConnector
}

describe("reaction flow repro (WoT)", () => {
  it("create reaction with relations → related items → delete", async () => {
    const space = handle()
    const c = connector(space) as any

    await c.createItem({ id: "p1", type: "post", createdBy: ALICE, data: { text: "hi" } })
    const reaction = await c.createItem({
      type: "reaction", createdBy: ALICE, data: { emoji: "👍" },
      relations: [{ predicate: "reactsTo", target: "item:p1" }],
    })
    expect(reaction.id).toBeTruthy()

    const related = await c.getRelatedItems("p1", "reactsTo", { direction: "to" })
    expect(related.map((r: { id: string }) => r.id)).toContain(reaction.id)

    await c.deleteItem(reaction.id)
    expect(space.value.items[reaction.id]).toBeUndefined()
  })
})
