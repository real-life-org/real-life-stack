import { describe, expect, it } from "vitest"

import { mirrorMapKey, mirrorRegistryKey, parseMirrorMapKey, parseMirrorRegistryKey } from "../src/mirror/keys.js"

/** Spec 09 §Ablage und Registry — die Schlüssel sind normativ. */
describe("mirrorMapKey", () => {
  it("ist JSON.stringify([homeSpaceId, itemId])", () => {
    expect(mirrorMapKey("home", "task-1")).toBe('["home","task-1"]')
  })

  it("ist umkehrbar", () => {
    expect(parseMirrorMapKey(mirrorMapKey("home", "task-1"))).toEqual({ homeSpaceId: "home", itemId: "task-1" })
    expect(parseMirrorMapKey('["home"]')).toBeNull()
    expect(parseMirrorMapKey("kein json")).toBeNull()
  })

  it("trennt Schlüssel, die als nackte Verkettung kollidierten", () => {
    expect(mirrorMapKey("a", "bc")).not.toBe(mirrorMapKey("ab", "c"))
  })
})

describe("mirrorRegistryKey", () => {
  it("ist JSON.stringify([itemId, targetSpaceId])", () => {
    expect(mirrorRegistryKey("task-1", "garden")).toBe('["task-1","garden"]')
    expect(parseMirrorRegistryKey(mirrorRegistryKey("task-1", "garden"))).toEqual({
      itemId: "task-1",
      targetSpaceId: "garden",
    })
  })
})
