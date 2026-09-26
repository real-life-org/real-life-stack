import { describe, expect, it } from "vitest"
import type { Item } from "../src/index"
import { assertMayMutateAuthoredItem, isAuthoredSystemItem } from "../src/index"
import { isAuthoredItemType, itemContentHash, verifyItemClaim, type ClaimSigner } from "../src/claims"
import {
  assertAuthoredCommitAllowed,
  assertContentUnchanged,
  authoredUpdateAuthoritative,
  isFrozen,
  withoutAuthoredClaim,
  planAuthoredUpdate,
  withAuthoredCreateClaim,
  type AuthoredIngress,
} from "../src/authored"

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

function comment(author: string, overrides: Partial<Item> = {}): Item {
  return {
    id: "c1",
    type: "comment",
    createdBy: author,
    createdAt: "2026-09-26T10:00:00.000Z",
    data: { content: "Hallo" },
    relations: [{ predicate: "commentOn", target: "item:post-a" }],
    ...overrides,
  } as Item
}

function vote(voter: string, target: string, contentHash?: string): Item {
  return {
    id: `rel-${voter}`,
    type: "relation",
    createdBy: voter,
    createdAt: "2026-09-26T11:00:00.000Z",
    data: { predicate: "votesOn", value: "green", ...(contentHash ? { contentHash } : {}) },
    relations: [
      { predicate: "from", target: `global:${voter}` },
      { predicate: "to", target: `item:${target}` },
    ],
  } as Item
}

const apply = (existing: Item, updates: Partial<Item>): Item => ({
  ...existing,
  ...(updates.data !== undefined ? { data: updates.data } : {}),
  ...(updates.relations !== undefined ? { relations: updates.relations } : {}),
  ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
}) as Item

describe("authored item types", () => {
  it("are the catalog types plus relation records", () => {
    for (const type of ["statement", "comment", "reaction", "relation"]) expect(isAuthoredItemType(type)).toBe(true)
    for (const type of ["post", "task", "event"]) expect(isAuthoredItemType(type)).toBe(false)
  })

  it("the legacy name follows the same set, statements included", () => {
    expect(isAuthoredSystemItem("statement")).toBe(true)
    expect(isAuthoredSystemItem("post")).toBe(false)
  })

  it("only the author deletes an authored item, statements included", () => {
    expect(() => assertMayMutateAuthoredItem({ type: "statement", createdBy: "a" }, "b", "delete")).toThrow()
    expect(() => assertMayMutateAuthoredItem({ type: "statement", createdBy: "a" }, "a", "delete")).not.toThrow()
  })

  it("update rights of catalog types are content-scoped, relation records stay author-only", () => {
    expect(() => assertMayMutateAuthoredItem({ type: "comment", createdBy: "a" }, "b", "update")).not.toThrow()
    expect(() => assertMayMutateAuthoredItem({ type: "relation", createdBy: "a" }, "b", "update")).toThrow()
  })
})

describe("isFrozen — foreign content-bound reference (spec 08)", () => {
  it("is frozen by another person's relation with contentHash to the item", () => {
    expect(isFrozen(comment("a"), [vote("b", "c1", "sha256:x")])).toBe(true)
  })
  it("is not frozen by the author's own content-bound reference", () => {
    expect(isFrozen(comment("a"), [vote("a", "c1", "sha256:x")])).toBe(false)
  })
  it("is not frozen by a reference without contentHash", () => {
    expect(isFrozen(comment("a"), [vote("b", "c1")])).toBe(false)
  })
  it("is not frozen by a reference to another item", () => {
    expect(isFrozen(comment("a"), [vote("b", "other", "sha256:x")])).toBe(false)
  })
})

describe("withAuthoredCreateClaim — create path", () => {
  it("signed mode: the connector signs with the identity; the claim verifies", async () => {
    const { signer, did } = await testSigner()
    const stored = await withAuthoredCreateClaim(comment(did), { actorId: did, mode: "signed", signer })
    expect(await verifyItemClaim(stored)).toBe("valid")
  })

  it("ignores a caller-supplied claim", async () => {
    const { signer, did } = await testSigner()
    const stored = await withAuthoredCreateClaim(
      comment(did, { data: { content: "Hallo", claim: "forged.claim.value" } }),
      { actorId: did, mode: "signed", signer },
    )
    expect(stored.data.claim).not.toBe("forged.claim.value")
    expect(await verifyItemClaim(stored)).toBe("valid")
  })

  it("signed mode without identity refuses instead of writing unsigned", async () => {
    await expect(withAuthoredCreateClaim(comment("a"), { actorId: "a", mode: "signed", signer: null })).rejects.toThrow()
  })

  it("authoritative mode writes no claim and strips a caller-supplied one", async () => {
    const stored = await withAuthoredCreateClaim(
      comment("a", { data: { content: "Hallo", claim: "x" } }),
      { actorId: "a", mode: "authoritative", signer: null },
    )
    expect("claim" in stored.data).toBe(false)
  })

  it("leaves other types untouched, including a relation record's own claim", async () => {
    const relation = { ...vote("a", "c1"), data: { predicate: "votesOn", value: "green", claim: "relation.claim.jws" } } as Item
    const stored = await withAuthoredCreateClaim(relation, { actorId: "a", mode: "signed", signer: null })
    expect(stored).toEqual(relation)
    const post = { id: "p", type: "post", createdBy: "a", createdAt: "x", data: { content: "x" } } as Item
    expect(await withAuthoredCreateClaim(post, { actorId: "a", mode: "signed", signer: null })).toEqual(post)
  })
})

describe("planAuthoredUpdate — update path", () => {
  async function signedComment() {
    const { signer, did } = await testSigner()
    const ingress: AuthoredIngress = { actorId: did, mode: "signed", signer }
    const existing = await withAuthoredCreateClaim(comment(did), ingress)
    return { signer, did, ingress, existing }
  }

  it("a change outside the content keeps the existing claim, even when data is replaced", async () => {
    const { existing } = await signedComment()
    const other: AuthoredIngress = { actorId: "did:key:zSomeoneElse", mode: "signed", signer: null }
    const plan = await planAuthoredUpdate(existing, { data: { content: "Hallo", reactions: { "👍": 1 } }, tags: ["x"] }, other, false)
    const next = apply(existing, plan.updates)
    expect(next.data.claim).toBe(existing.data.claim)
    expect(await verifyItemClaim(next)).toBe("valid")
  })

  it("the author changes the content: the connector re-signs", async () => {
    const { existing, ingress } = await signedComment()
    const plan = await planAuthoredUpdate(existing, { data: { content: "Neu" } }, ingress, false)
    const next = apply(existing, plan.updates)
    expect(next.data.claim).not.toBe(existing.data.claim)
    expect(await verifyItemClaim(next)).toBe("valid")
  })

  it("a changed target is a content change", async () => {
    const { existing, ingress } = await signedComment()
    const plan = await planAuthoredUpdate(existing, { relations: [{ predicate: "commentOn", target: "item:post-b" }] }, ingress, false)
    const next = apply(existing, plan.updates)
    expect(await verifyItemClaim(next)).toBe("valid")
    expect(await itemContentHash(next)).not.toBe(await itemContentHash(existing))
  })

  it("someone else may not change the content", async () => {
    const { existing } = await signedComment()
    const other: AuthoredIngress = { actorId: "did:key:zSomeoneElse", mode: "signed", signer: null }
    await expect(planAuthoredUpdate(existing, { data: { content: "Fremd" } }, other, false)).rejects.toThrow(/author/)
  })

  it("a frozen item's content may not change, not even by the author", async () => {
    const { existing, ingress } = await signedComment()
    await expect(planAuthoredUpdate(existing, { data: { content: "Neu" } }, ingress, true)).rejects.toThrow(/frozen/)
  })

  it("a frozen item still accepts changes outside the content", async () => {
    const { existing, ingress } = await signedComment()
    const plan = await planAuthoredUpdate(existing, { tags: ["später"] }, ingress, true)
    expect(plan.updates.tags).toEqual(["später"])
  })

  it("ignores a caller-supplied claim", async () => {
    const { existing, ingress } = await signedComment()
    const plan = await planAuthoredUpdate(existing, { data: { content: "Hallo", claim: "forged" } }, ingress, false)
    expect(apply(existing, plan.updates).data.claim).toBe(existing.data.claim)
  })

  it("authoritative mode: a content change by the author carries no claim", async () => {
    const existing = comment("a")
    const plan = await planAuthoredUpdate(existing, { data: { content: "Neu", claim: "x" } }, { actorId: "a", mode: "authoritative", signer: null }, false)
    expect("claim" in (plan.updates.data ?? {})).toBe(false)
  })

  it("other types pass through unchanged", async () => {
    const post = { id: "p", type: "post", createdBy: "a", createdAt: "x", data: { content: "x" } } as Item
    const plan = await planAuthoredUpdate(post, { data: { content: "y" } }, { actorId: "b", mode: "signed", signer: null }, false)
    expect(plan).toEqual({ updates: { data: { content: "y" } }, contentGuard: null, changesContent: false })
  })
})

describe("assertContentUnchanged — concurrency guard inside the write transaction", () => {
  it("passes when the content still matches the planned base", async () => {
    const { signer, did } = await testSigner()
    const existing = await withAuthoredCreateClaim(comment(did), { actorId: did, mode: "signed", signer })
    const plan = await planAuthoredUpdate(existing, { tags: ["x"] }, { actorId: did, mode: "signed", signer }, false)
    expect(() => assertContentUnchanged(existing, plan.contentGuard)).not.toThrow()
  })

  it("throws when the content changed in between", async () => {
    const { signer, did } = await testSigner()
    const existing = await withAuthoredCreateClaim(comment(did), { actorId: did, mode: "signed", signer })
    const plan = await planAuthoredUpdate(existing, { tags: ["x"] }, { actorId: did, mode: "signed", signer }, false)
    const changed = { ...existing, data: { ...existing.data, content: "dazwischen" } } as Item
    expect(() => assertContentUnchanged(changed, plan.contentGuard)).toThrow()
  })

  it("a null guard never throws", () => {
    expect(() => assertContentUnchanged(comment("a"), null)).not.toThrow()
  })
})

describe("authoritative, synchronous variants", () => {
  it("withoutAuthoredClaim drops a claim only for catalog types", () => {
    expect("claim" in withoutAuthoredClaim(comment("a", { data: { content: "x", claim: "y" } })).data).toBe(false)
    const relation = { ...vote("a", "c1"), data: { predicate: "votesOn", value: "green", claim: "keep" } } as Item
    expect(withoutAuthoredClaim(relation).data.claim).toBe("keep")
  })

  it("authoredUpdateAuthoritative applies the same content rules", () => {
    expect(() => authoredUpdateAuthoritative(comment("a"), { data: { content: "Fremd" } }, "b", false)).toThrow(/author/)
    expect(() => authoredUpdateAuthoritative(comment("a"), { data: { content: "Neu" } }, "a", true)).toThrow(/frozen/)
    expect(authoredUpdateAuthoritative(comment("a"), { tags: ["x"] }, "b", true)).toEqual({ tags: ["x"] })
    const updated = authoredUpdateAuthoritative(comment("a"), { data: { content: "Neu", claim: "z" } }, "a", false)
    expect("claim" in (updated.data ?? {})).toBe(false)
  })
})

describe("assertAuthoredCommitAllowed — freeze re-check at commit (#497)", () => {
  it("refuses a planned content change when a foreign content-bound vote arrived meanwhile", async () => {
    const { signer, did } = await testSigner()
    const ingress: AuthoredIngress = { actorId: did, mode: "signed", signer }
    const existing = await withAuthoredCreateClaim(comment(did), ingress)
    const plan = await planAuthoredUpdate(existing, { data: { content: "Neu" } }, ingress, false)
    expect(plan.changesContent).toBe(true)
    expect(() => assertAuthoredCommitAllowed(existing, plan, [vote("did:key:zOther", "c1", "sha256:x")])).toThrow(/frozen/)
  })

  it("lets a change outside the content commit even after a freeze", async () => {
    const { signer, did } = await testSigner()
    const ingress: AuthoredIngress = { actorId: did, mode: "signed", signer }
    const existing = await withAuthoredCreateClaim(comment(did), ingress)
    const plan = await planAuthoredUpdate(existing, { tags: ["x"] }, ingress, false)
    expect(plan.changesContent).toBe(false)
    expect(() => assertAuthoredCommitAllowed(existing, plan, [vote("did:key:zOther", "c1", "sha256:x")])).not.toThrow()
  })
})
