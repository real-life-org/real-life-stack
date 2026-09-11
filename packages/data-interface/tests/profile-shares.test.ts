import { describe, expect, it } from "vitest"

import { BaseConnector, createObservable, hasProfile } from "../src/index.js"
import type {
  CreateItemInput,
  DataInterface,
  Group,
  Item,
  ItemFilter,
  ProfileShareStatus,
} from "../src/index.js"

/**
 * Spec 12 (Profile) → Regel 13 und 14: `ProfileCapable` trägt die Freigaben,
 * der Type Guard bleibt `hasProfile()`, und Connectoren ohne Freigaben
 * liefern `accepted` für jede Mitgliedschaft.
 */

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

  setGroups(groups: Group[]): void {
    this.groupsObservable.set(groups)
  }
}

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

describe("hasProfile stays the guard (spec 12 Regel 14)", () => {
  it("is false for a plain DataInterface", () => {
    expect(hasProfile(createStub())).toBe(false)
  })

  it("is true on the unchanged read/write/sync triple — shares are additive, not gating", () => {
    const connector = createStub({
      getMyProfile: async () => null,
      observeMyProfile: () => createObservable<Item | null>(null),
      syncProfile: async () => {},
    })
    expect(hasProfile(connector)).toBe(true)
  })
})

describe("BaseConnector profile-share defaults (spec 12 Regel 13)", () => {
  it("reports `accepted` for every membership", () => {
    const connector = new MinimalConnector()
    const shares = connector.observeProfileShares()
    expect(shares.current).toEqual({ default: "accepted" satisfies ProfileShareStatus })
  })

  it("follows the membership list reactively", () => {
    const connector = new MinimalConnector()
    const seen: Array<Record<string, ProfileShareStatus>> = []
    const unsubscribe = connector.observeProfileShares().subscribe((value) => seen.push(value))
    connector.setGroups([
      { id: "garden", name: "Garten" },
      { id: "market", name: "Markt" },
    ])
    unsubscribe()
    connector.setGroups([])
    expect(seen).toEqual([{ garden: "accepted", market: "accepted" }])
  })

  it("mirrors the membership list on `current` after a change", () => {
    const connector = new MinimalConnector()
    const shares = connector.observeProfileShares()
    connector.setGroups([{ id: "garden", name: "Garten" }])
    expect(shares.current).toEqual({ garden: "accepted" })
  })

  it("refuses the four share mutations — a default must not imply support (03)", async () => {
    const connector = new MinimalConnector()
    await expect(connector.acceptSpace("garden")).rejects.toThrow(/acceptSpace not supported/)
    await expect(connector.declineSpace("garden")).rejects.toThrow(/declineSpace not supported/)
    await expect(connector.shareProfile("garden")).rejects.toThrow(/shareProfile not supported/)
    await expect(connector.revokeProfileShare("garden")).rejects.toThrow(/revokeProfileShare not supported/)
  })
})
