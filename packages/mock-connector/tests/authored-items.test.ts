import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector, type MockConnectorSeed } from "../src/index"

const USER = "did:example:user"
const OTHER = "did:example:other"

// Regular (non-fixture) mode: the authoritative ingress under test.
const foreignVote: Item = {
  id: "vote-other",
  type: "relation",
  createdBy: OTHER,
  createdAt: "2026-09-26T10:00:00.000Z",
  data: { predicate: "votesOn", value: "green", contentHash: "sha256:0" },
  relations: [
    { predicate: "from", target: `global:${OTHER}` },
    { predicate: "to", target: "item:statement-1" },
  ],
}

const seed: MockConnectorSeed = {
  items: [foreignVote],
  groups: [{ id: "group-a", name: "A" }],
  users: [{ id: USER, displayName: "User" }],
  groupMembers: { "group-a": [USER] },
  groupItems: { "group-a": ["vote-other"] },
}

function connector(): MockConnector {
  const mock = new MockConnector(seed)
  mock.setCurrentGroup("group-a")
  return mock
}

describe("MockConnector — authorial items (spec 08, authoritative)", () => {
  it("answers trusted and writes no claim, dropping a caller-supplied one", async () => {
    const mock = connector()
    const created = await mock.createItem({ type: "comment", createdBy: USER, data: { content: "x", claim: "forged" } })
    expect("claim" in created.data).toBe(false)
    expect(await mock.verifyItemClaim!(created)).toBe("trusted")
  })

  it("lets the author change the content until someone else binds a reference to it", async () => {
    const mock = connector()
    const free = await mock.createItem({ type: "statement", createdBy: USER, data: { title: "a" } })
    await mock.updateItem(free.id, { data: { title: "b" } })
    expect((await mock.getItem(free.id))!.data.title).toBe("b")

    await mock.createItem({ id: "statement-1", type: "statement", createdBy: USER, data: { title: "gesagt" } })
    await expect(mock.updateItem("statement-1", { data: { title: "anders" } })).rejects.toThrow(/frozen/)
    await mock.updateItem("statement-1", { tags: ["modul:x"] })
    const frozen = (await mock.getItem("statement-1"))!
    expect(frozen.data.title).toBe("gesagt")
    expect(frozen.tags).toEqual(["modul:x"])
  })
})
