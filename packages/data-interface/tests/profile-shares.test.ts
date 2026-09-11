import { describe, expect, it } from "vitest"

import { BaseConnector, createObservable, hasProfile } from "../src/index.js"
import type {
  CreateItemInput,
  DataInterface,
  Group,
  Item,
  ItemFilter,
  Observable,
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

/** The full ProfileCapable surface — old triple plus the shares from Regel 14. */
const profileMethods = {
  getMyProfile: async () => null,
  observeMyProfile: () => createObservable<Item | null>(null),
  updateMyProfile: async () => ({}) as Item,
  setFieldVisibility: async () => {},
  getPublicProfile: async () => null,
  syncProfile: async () => {},
  isProfileSyncPending: () => createObservable(false),
  observeProfileShares: () => createObservable<Record<string, ProfileShareStatus>>({}),
  acceptSpace: async () => {},
  declineSpace: async () => {},
  shareProfile: async () => {},
  revokeProfileShare: async () => {},
}

describe("hasProfile stays the guard (spec 12 Regel 14)", () => {
  it("is false for a plain DataInterface", () => {
    expect(hasProfile(createStub())).toBe(false)
  })

  it("is false on the old read/write/sync triple alone — the contract now includes the shares", () => {
    const connector = createStub({
      getMyProfile: async () => null,
      observeMyProfile: () => createObservable<Item | null>(null),
      syncProfile: async () => {},
    })
    expect(hasProfile(connector)).toBe(false)
  })

  it("is false when a single share operation is missing", () => {
    for (const key of Object.keys(profileMethods)) {
      const partial = { ...profileMethods } as Record<string, unknown>
      delete partial[key]
      expect(hasProfile(createStub(partial)), key).toBe(false)
    }
  })

  it("is false when an operation is present but not callable", () => {
    expect(hasProfile(createStub({ ...profileMethods, acceptSpace: 1 }))).toBe(false)
  })

  it("is true for the full contract — and everything it promises is actually callable", async () => {
    const connector = createStub(profileMethods)
    expect(hasProfile(connector)).toBe(true)
    if (!hasProfile(connector)) throw new Error("unreachable")
    // The guard is a PROMISE about the surface: call every method it asserts,
    // so a connector that passes it can never blow up with a TypeError.
    expect(connector.observeProfileShares().current).toEqual({})
    await connector.acceptSpace("garden")
    await connector.declineSpace("garden")
    await connector.shareProfile("garden")
    await connector.revokeProfileShare("garden")
    expect(await connector.getMyProfile()).toBeNull()
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

  it("follows a SUBCLASS override of the group source, not the base field", () => {
    const overridden = createObservable<Group[]>([{ id: "own", name: "Eigene Quelle" }], false)
    class OverridingConnector extends MinimalConnector {
      override observeGroups(): Observable<Group[]> {
        return overridden
      }
    }
    const connector = new OverridingConnector()
    const shares = connector.observeProfileShares()
    expect(shares.current).toEqual({ own: "accepted" })
    // `loaded` is mirrored from the source, so "no memberships yet" stays
    // distinguishable from "loaded, genuinely none" (Observable contract, 02).
    expect(shares.loaded).toBe(false)
    overridden.markLoaded()
    expect(shares.loaded).toBe(true)
    overridden.set([])
    expect(shares.current).toEqual({})
  })

  it("refuses the four share mutations — a default must not imply support (03)", async () => {
    const connector = new MinimalConnector()
    await expect(connector.acceptSpace("garden")).rejects.toThrow(/acceptSpace not supported/)
    await expect(connector.declineSpace("garden")).rejects.toThrow(/declineSpace not supported/)
    await expect(connector.shareProfile("garden")).rejects.toThrow(/shareProfile not supported/)
    await expect(connector.revokeProfileShare("garden")).rejects.toThrow(/revokeProfileShare not supported/)
  })
})
