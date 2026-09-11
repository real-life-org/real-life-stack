import { describe, expect, it } from "vitest"

import {
  MIRROR_OF_PREDICATE,
  getMirrorOrigin,
  hasMirrors,
  isMirrorItem,
  itemInstanceKey,
  parseQualifiedItemTarget,
  qualifiedItemTarget,
  BaseConnector,
  createObservable,
} from "../src/index.js"
import type { CreateItemInput, DataInterface, Item, ItemFilter } from "../src/index.js"

/**
 * Spec 09 (Mirror und Bridge) → Invariante 1, 10, §Lesemodell und
 * §Capability-Vertrag. Each test pins one normative rule.
 */

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "task-1",
    type: "task",
    createdAt: "2026-09-11T08:00:00.000Z",
    createdBy: "did:key:zAuthor",
    data: {},
    ...overrides,
  }
}

function mirrored(homeSpaceId: string, itemId: string): Item {
  return item({
    id: itemId,
    relations: [
      { predicate: MIRROR_OF_PREDICATE, target: qualifiedItemTarget(homeSpaceId, itemId), meta: { ts: "2026-09-11T09:00:00.000Z" } },
    ],
  })
}

describe("qualified item targets (spec 09 §Lesemodell, target convention from 04)", () => {
  it("builds the `space:{home}/item:{id}` form", () => {
    expect(qualifiedItemTarget("space-a", "task-1")).toBe("space:space-a/item:task-1")
  })

  it("round-trips home space id and item id", () => {
    const vectors: Array<[string, string]> = [
      ["space-a", "task-1"],
      ["did:key:z6MkHome", "did:key:z6MkPerson"],
      ["3f0c-9a", "rel-abc123"],
    ]
    for (const [home, id] of vectors) {
      expect(parseQualifiedItemTarget(qualifiedItemTarget(home, id))).toEqual({
        homeSpaceId: home,
        itemId: id,
      })
    }
  })

  it("splits at the FIRST `/item:` so a nested-looking item id stays intact", () => {
    expect(parseQualifiedItemTarget("space:home/item:a/item:b")).toEqual({
      homeSpaceId: "home",
      itemId: "a/item:b",
    })
  })

  it("rejects every target that is not the qualified form", () => {
    const invalid = [
      "item:task-1",
      "global:did:key:z6Mk",
      "space:home",
      "space:/item:task-1",
      "space:home/item:",
      "space:home/task-1",
      "",
      "SPACE:home/item:task-1",
      " space:home/item:task-1",
    ]
    for (const target of invalid) {
      expect(parseQualifiedItemTarget(target), target).toBeNull()
    }
  })
})

describe("mirrorOf annotation (spec 09 §Lesemodell, 12 Regel 10)", () => {
  it("names the predicate exactly once", () => {
    expect(MIRROR_OF_PREDICATE).toBe("mirrorOf")
  })

  it("recognises a mirror instance", () => {
    expect(isMirrorItem(mirrored("space-a", "task-1"))).toBe(true)
  })

  it("does not treat a local item or another predicate as a mirror", () => {
    expect(isMirrorItem(item())).toBe(false)
    expect(isMirrorItem(item({ relations: [{ predicate: "assignedTo", target: "global:did:key:z6Mk" }] }))).toBe(false)
  })

  it("reads the origin (homeSpaceId, itemId) from the annotation", () => {
    expect(getMirrorOrigin(mirrored("space-a", "task-1"))).toEqual({
      homeSpaceId: "space-a",
      itemId: "task-1",
    })
  })

  it("returns null for a local item and for a malformed mirrorOf target", () => {
    expect(getMirrorOrigin(item())).toBeNull()
    expect(getMirrorOrigin(item({ relations: [{ predicate: MIRROR_OF_PREDICATE, target: "item:task-1" }] }))).toBeNull()
  })
})

describe("list keys (spec 09 §Lesemodell: `mirrorOf.target ?? id`, never `id` alone)", () => {
  it("keys a local item by its bare id", () => {
    expect(itemInstanceKey(item())).toBe("task-1")
  })

  it("keys mirrors of the same id from two homes distinctly (Invariante 1)", () => {
    const fromA = itemInstanceKey(mirrored("home-a", "task-1"))
    const fromB = itemInstanceKey(mirrored("home-b", "task-1"))
    expect(fromA).not.toBe(fromB)
    expect(fromA).not.toBe(itemInstanceKey(item()))
  })
})

// --- Capability guard ---

function createStub(extra: Record<string, unknown> = {}): DataInterface {
  return {
    init: async () => {},
    dispose: async () => {},
    getItems: async () => [],
    getItem: async () => null,
    observe: () => createObservable<Item[]>([]),
    observeItem: () => createObservable<Item | null>(null),
    ...extra,
  }
}

const mirrorMethods = {
  observeItemShares: () => createObservable({}),
  shareItem: async () => {},
  revokeItemShare: async () => {},
  observeMirrorConflicts: () => createObservable([]),
}

class MinimalConnector extends BaseConnector {
  async getItems(_filter?: ItemFilter): Promise<Item[]> {
    return []
  }
  async getItem(_id: string): Promise<Item | null> {
    return null
  }
  async createItem(_input: CreateItemInput): Promise<Item> {
    throw new Error("not supported")
  }
  async updateItem(_id: string, _updates: Partial<Item>): Promise<Item> {
    throw new Error("not supported")
  }
  async deleteItem(_id: string): Promise<void> {}
}

describe("hasMirrors (spec 09 §Capability-Vertrag, 03 BaseConnector rule)", () => {
  it("is false for a plain DataInterface", () => {
    expect(hasMirrors(createStub())).toBe(false)
  })

  it("is false when only some of the four operations exist", () => {
    for (const key of Object.keys(mirrorMethods)) {
      const partial = { ...mirrorMethods } as Record<string, unknown>
      delete partial[key]
      expect(hasMirrors(createStub(partial)), key).toBe(false)
    }
  })

  it("is true for a connector implementing all four operations", () => {
    expect(hasMirrors(createStub(mirrorMethods))).toBe(true)
  })

  it("is false for BaseConnector — mirrors get no defaults (03: a default must not imply support)", () => {
    expect(hasMirrors(new MinimalConnector())).toBe(false)
  })
})
