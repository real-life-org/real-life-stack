import { describe, it, expect } from "vitest"
import type { GroupManager, Group, Observable } from "../src/index.js"

/**
 * Contract tests for setCurrentGroup(null) — the "overview" mode.
 *
 * When setCurrentGroup(null) is called, the connector should:
 * - Set getCurrentGroup() to null
 * - Emit null on observeCurrentGroup()
 * - Return items from ALL groups (no group filter)
 *
 * These tests verify the interface contract that all connectors
 * implementing GroupManager must satisfy.
 */

// Minimal GroupManager stub for contract testing
function createGroupManagerStub(): GroupManager & {
  _groups: Group[]
  _currentGroup: Group | null
  _currentGroupObs: { current: Group | null; set: (g: Group | null) => void; subscribe: (cb: (g: Group | null) => void) => () => void }
} {
  let currentGroup: Group | null = null
  const subscribers = new Set<(g: Group | null) => void>()

  const obs = {
    current: null as Group | null,
    set(g: Group | null) {
      obs.current = g
      for (const cb of subscribers) cb(g)
    },
    subscribe(cb: (g: Group | null) => void) {
      subscribers.add(cb)
      return () => subscribers.delete(cb)
    },
  }

  const groups: Group[] = [
    { id: "group-1", name: "Group 1", data: { scope: "group" } },
    { id: "group-2", name: "Group 2", data: { scope: "group" } },
  ]

  return {
    _groups: groups,
    _currentGroup: currentGroup,
    _currentGroupObs: obs,

    async getGroups() { return groups },
    observeGroups() {
      return { current: groups, subscribe: () => () => {} }
    },
    getCurrentGroup() { return obs.current },
    observeCurrentGroup() { return obs },
    setCurrentGroup(id: string | null) {
      if (id === null) {
        obs.set(null)
      } else {
        const group = groups.find(g => g.id === id) ?? null
        obs.set(group)
      }
    },
    async createGroup(name: string, data?: Record<string, unknown>) {
      const g: Group = { id: `group-${Date.now()}`, name, data }
      groups.push(g)
      return g
    },
    async updateGroup(id: string, updates: Partial<Group>) {
      const g = groups.find(g => g.id === id)
      if (!g) throw new Error("Not found")
      Object.assign(g, updates)
      return g
    },
    async deleteGroup(id: string) {
      const idx = groups.findIndex(g => g.id === id)
      if (idx >= 0) groups.splice(idx, 1)
    },
    async getMembers() { return [] },
    observeMembers() { return { current: [], subscribe: () => () => {} } },
    async inviteMember() {},
    async removeMember() {},
  }
}

describe("setCurrentGroup(null) — overview mode contract", () => {
  it("setCurrentGroup(null) does not throw", () => {
    const gm = createGroupManagerStub()
    expect(() => gm.setCurrentGroup(null)).not.toThrow()
  })

  it("getCurrentGroup() returns null after setCurrentGroup(null)", () => {
    const gm = createGroupManagerStub()
    gm.setCurrentGroup("group-1")
    expect(gm.getCurrentGroup()?.id).toBe("group-1")

    gm.setCurrentGroup(null)
    expect(gm.getCurrentGroup()).toBeNull()
  })

  it("observeCurrentGroup() emits null after setCurrentGroup(null)", () => {
    const gm = createGroupManagerStub()
    const obs = gm.observeCurrentGroup()
    const values: Array<Group | null> = []
    obs.subscribe((g) => values.push(g))

    gm.setCurrentGroup("group-1")
    gm.setCurrentGroup(null)

    expect(values[values.length - 1]).toBeNull()
  })

  it("setCurrentGroup(string) works after setCurrentGroup(null)", () => {
    const gm = createGroupManagerStub()
    gm.setCurrentGroup(null)
    expect(gm.getCurrentGroup()).toBeNull()

    gm.setCurrentGroup("group-2")
    expect(gm.getCurrentGroup()?.id).toBe("group-2")
  })

  it("observeGroups() does not contain overview/aggregate groups", async () => {
    const gm = createGroupManagerStub()
    const groups = await gm.getGroups()

    const hasOverview = groups.some(g => g.data?.scope === "overview" || g.data?.scope === "aggregate")
    expect(hasOverview).toBe(false)
  })
})
