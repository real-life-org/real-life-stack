import { describe, expect, it } from "vitest"

import {
  mirrorMapKey,
  mirrorRegistryEntryKey,
  mirrorRegistryKey,
  parseMirrorMapKey,
  parseMirrorRegistryEntryKey,
  parseMirrorRegistryKey,
} from "../src/mirror/keys.js"

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
  // Physisch flach je Gerät: nur so legen zwei Geräte nie dieselbe Map an.
  it("ist JSON.stringify([itemId, targetSpaceId, deviceId])", () => {
    expect(mirrorRegistryKey("task-1", "garden", "device-A")).toBe('["task-1","garden","device-A"]')
    expect(parseMirrorRegistryKey(mirrorRegistryKey("task-1", "garden", "device-A"))).toEqual({
      itemId: "task-1",
      targetSpaceId: "garden",
      deviceId: "device-A",
    })
  })

  it("nimmt den Eintrags-Schlüssel nicht als Beitrags-Schlüssel an", () => {
    expect(parseMirrorRegistryKey(mirrorRegistryEntryKey("task-1", "garden"))).toBeNull()
    expect(parseMirrorRegistryKey("kein json")).toBeNull()
  })

  it("trennt Geräte, die als nackte Verkettung kollidierten", () => {
    expect(mirrorRegistryKey("a", "bc", "d")).not.toBe(mirrorRegistryKey("ab", "c", "d"))
  })
})

describe("mirrorRegistryEntryKey", () => {
  it("ist der logische Schlüssel des Eintrags und umkehrbar", () => {
    expect(mirrorRegistryEntryKey("task-1", "garden")).toBe('["task-1","garden"]')
    expect(parseMirrorRegistryEntryKey(mirrorRegistryEntryKey("task-1", "garden"))).toEqual({
      itemId: "task-1",
      targetSpaceId: "garden",
    })
    expect(parseMirrorRegistryEntryKey(mirrorRegistryKey("task-1", "garden", "device-A"))).toBeNull()
  })
})
