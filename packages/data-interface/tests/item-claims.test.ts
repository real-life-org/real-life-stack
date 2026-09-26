import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import type { Item, Relation } from "../src/index"
import {
  AUTHORIAL_ITEM_TYPES,
  isAuthorialItemType,
  itemContent,
  itemContentHash,
  itemStanding,
  jcsCanonicalize,
  signItemClaim,
  standingCounts,
  verifyItemClaim,
  type ClaimSigner,
} from "../src/claims"

const REPO_ROOT = join(__dirname, "..", "..", "..")

type VectorItem = {
  id: string
  type: string
  createdBy: string
  createdAt: string
  data: Record<string, unknown>
  relations?: Relation[]
  tags?: string[]
}

const VECTORS = JSON.parse(
  readFileSync(join(REPO_ROOT, "docs", "spec", "schemas", "claims", "vectors", "item-authorial-1.json"), "utf8"),
) as {
  catalog: Record<string, { data: string[]; relations: string[] }>
  contentHash: Array<{ name: string; type: string; data: Record<string, unknown>; relations?: Relation[]; content: unknown; jcs: string; contentHash: string }>
  itemClaims: Array<{ name: string; expect: "valid" | "invalid"; item: VectorItem; jws: string | null }>
  proofRequired: Record<string, boolean>
  standing: Array<{ name: string; standing: "belegt" | "unsigniert" | "ungueltig"; counts: boolean; item: VectorItem; jws: string | null }>
}

const asItem = (item: VectorItem, claim: string | null = null): Item => ({
  ...item,
  data: claim === null ? { ...item.data } : { ...item.data, claim },
}) as Item

describe("item-authorial — catalog (spec 08, closed)", () => {
  it("matches the catalog the canonical vectors were generated from", () => {
    const catalog = Object.fromEntries(
      [...AUTHORIAL_ITEM_TYPES].map(([type, entry]) => [type, { data: [...entry.data], relations: [...entry.relations] }]),
    )
    expect(catalog).toEqual(VECTORS.catalog)
  })

  it("knows exactly statement, comment and reaction; post stays collaborative", () => {
    expect(isAuthorialItemType("statement")).toBe(true)
    expect(isAuthorialItemType("comment")).toBe(true)
    expect(isAuthorialItemType("reaction")).toBe(true)
    expect(isAuthorialItemType("post")).toBe(false)
    expect(isAuthorialItemType("task")).toBe(false)
  })
})

describe("item-authorial — Beleg erforderlich (canonical standing vectors)", () => {
  const STANDING = { belegt: "attested", unsigniert: "unsigned", ungueltig: "invalid" } as const

  it("proofRequired matches the vectors", () => {
    const proofRequired = Object.fromEntries([...AUTHORIAL_ITEM_TYPES].map(([type, entry]) => [type, entry.proofRequired]))
    expect(proofRequired).toEqual(VECTORS.proofRequired)
  })

  for (const vector of VECTORS.standing) {
    it(`${vector.name}`, async () => {
      const item = asItem(vector.item, vector.jws)
      const standing = itemStanding(item, await verifyItemClaim(item))
      expect(standing).toBe(STANDING[vector.standing])
      expect(standingCounts(standing)).toBe(vector.counts)
    })
  }

  it("a pending or unverifiable verdict fails closed except for unsigned items", () => {
    expect(itemStanding({ type: "statement", data: { title: "T" } }, undefined)).toBe("invalid")
    expect(itemStanding({ type: "comment", data: { content: "c", claim: "x.y.z" } }, undefined)).toBe("invalid")
    expect(itemStanding({ type: "comment", data: { content: "c" } }, undefined)).toBe("unsigned")
    expect(itemStanding({ type: "statement", data: { title: "T" } }, "trusted")).toBe("attested")
    expect(itemStanding({ type: "post", data: {} }, "valid")).toBeNull()
  })
})

describe("item-authorial — content and content hash (canonical vectors)", () => {
  for (const vector of VECTORS.contentHash) {
    it(`${vector.name}`, async () => {
      const item = { type: vector.type, data: vector.data, relations: vector.relations }
      const content = itemContent(item)
      expect(content).toEqual(vector.content)
      expect(jcsCanonicalize(content)).toBe(vector.jcs)
      expect(await itemContentHash(item)).toBe(vector.contentHash)
    })
  }

  it("data.claim is a contract field and never part of the content", () => {
    const item = { type: "statement", data: { title: "A", claim: "x.y.z" } }
    expect(itemContent(item)).toEqual({ data: { title: "A", description: null, variantOf: null }, relations: {} })
  })

  it("a type outside the catalog has no content", () => {
    expect(itemContent({ type: "post", data: { content: "x" } })).toBeNull()
  })
})

describe("item-authorial — canonical claim vectors (binding, spec 08)", () => {
  for (const vector of VECTORS.itemClaims) {
    it(`${vector.name} → ${vector.expect}`, async () => {
      expect(await verifyItemClaim(asItem(vector.item, vector.jws))).toBe(vector.expect)
    })
  }
})

describe("item-authorial — sign/verify roundtrip", () => {
  async function testSigner(): Promise<{ signer: ClaimSigner; did: string }> {
    const keyPair = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey))
    const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    const bytes = new Uint8Array([0xed, 0x01, ...raw])
    let n = 0n
    for (const byte of bytes) n = (n << 8n) | BigInt(byte)
    let encoded = ""
    while (n > 0n) { encoded = B58[Number(n % 58n)] + encoded; n /= 58n }
    const did = `did:key:z${encoded}`
    return {
      did,
      signer: {
        kid: `${did}#sig-0`,
        signEd25519: async (message: Uint8Array) =>
          new Uint8Array(await crypto.subtle.sign("Ed25519", keyPair.privateKey, message as BufferSource)),
      },
    }
  }

  function comment(did: string, target = "item:post-a"): Item {
    return {
      id: "comment-rt",
      type: "comment",
      createdBy: did,
      createdAt: "2026-09-26T10:00:00.000Z",
      data: { content: "Hallo" },
      relations: [{ predicate: "commentOn", target }],
    } as Item
  }

  it("signs so that verification yields valid, and detects content and target changes", async () => {
    const { signer, did } = await testSigner()
    const item = comment(did)
    const claim = await signItemClaim(item, signer)
    const signed = { ...item, data: { ...item.data, claim } } as Item
    expect(await verifyItemClaim(signed)).toBe("valid")

    const edited = { ...signed, data: { ...signed.data, content: "Tschüss" } } as Item
    expect(await verifyItemClaim(edited)).toBe("invalid")

    const moved = { ...signed, relations: [{ predicate: "commentOn", target: "item:post-b" }] } as Item
    expect(await verifyItemClaim(moved)).toBe("invalid")
  })

  it("stays valid when fields outside the content change", async () => {
    const { signer, did } = await testSigner()
    const item = comment(did)
    const claim = await signItemClaim(item, signer)
    const aggregated = {
      ...item,
      data: { ...item.data, claim, reactions: { "👍": 1 }, commentCount: 3 },
      relations: [...(item.relations ?? []), { predicate: "relatedTo", target: "item:x" }],
      tags: ["neu"],
    } as Item
    expect(await verifyItemClaim(aggregated)).toBe("valid")
  })

  it("refuses to sign in someone else's name", async () => {
    const { signer } = await testSigner()
    await expect(signItemClaim(comment("did:key:z6MkSomeoneElse"), signer)).rejects.toThrow(/createdBy/)
  })

  it("refuses to sign a type outside the catalog", async () => {
    const { signer, did } = await testSigner()
    const post = { ...comment(did), type: "post" } as Item
    await expect(signItemClaim(post, signer)).rejects.toThrow(/catalog/)
  })
})
