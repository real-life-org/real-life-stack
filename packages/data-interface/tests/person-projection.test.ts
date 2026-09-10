import { describe, expect, it, vi } from "vitest"
import {
  PersonProjectionStore,
  assertNotPersonProjection,
  isPersonProjection,
  mergePersonProjections,
  projectPersonItem,
  VOCAB_BASE,
  VOCAB_PERSON,
  VOCAB_PLACE,
  createObservable,
} from "../src/index.js"
import type { Group, Item, User } from "../src/index.js"

const point = { type: "Point", coordinates: [13.4, 52.5] }

describe("projectPersonItem", () => {
  it("macht aus Nutzer + Profil ein person-Item mit did und Autor = Person", () => {
    const item = projectPersonItem(
      { id: "did:key:alice", displayName: "Fallback" },
      { did: "did:key:alice", displayName: "Alice", bio: "Gärtnerin", avatarUrl: "a.png", createdAt: "2026-01-01T00:00:00.000Z" },
    )
    expect(item.id).toBe("did:key:alice")
    expect(item.type).toBe("person")
    expect(item.createdBy).toBe("did:key:alice")
    expect(item.createdAt).toBe("2026-01-01T00:00:00.000Z")
    expect(item.data).toMatchObject({ did: "did:key:alice", displayName: "Alice", bio: "Gärtnerin", avatarUrl: "a.png" })
    expect(item["@context"]).toEqual([VOCAB_BASE, VOCAB_PERSON])
  })

  it("fällt ohne Profil auf den displayName des Nutzers zurück, ohne zu blockieren", () => {
    const item = projectPersonItem({ id: "user-2", displayName: "Timo", avatarUrl: "t.png" }, null)
    expect(item.data.displayName).toBe("Timo")
    expect(item.data.avatarUrl).toBe("t.png")
    // Ohne eigene DID bindet die Nutzer-Id die Projektion — sonst wäre das
    // Item nach Regel 5 (Spec 04 §Profile) ein Platzhalter.
    expect(item.data.did).toBe("user-2")
  })

  it("nimmt die Nutzer-Id als letzten Namensfallback", () => {
    expect(projectPersonItem({ id: "user-9" }).data.displayName).toBe("user-9")
  })

  it("reicht eine Position durch und aktiviert place/v1", () => {
    const item = projectPersonItem({ id: "user-3" }, { position: point, locationName: "Berlin" })
    expect(item.data.position).toEqual(point)
    expect(item.data.locationName).toBe("Berlin")
    expect(item["@context"]).toContain(VOCAB_PLACE)
  })

  it("lässt eine fehlende Position weg, statt undefined zu schreiben", () => {
    const item = projectPersonItem({ id: "user-4" }, { displayName: "Ohne Ort" })
    expect("position" in item.data).toBe(false)
    expect(item["@context"]).not.toContain(VOCAB_PLACE)
  })
})

describe("isPersonProjection / assertNotPersonProjection", () => {
  const projection = projectPersonItem({ id: "user-1", displayName: "Anton" })
  const placeholder: Item = {
    id: "item-1",
    type: "person",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "user-1",
    data: { displayName: "Oma Erna" },
  }

  it("erkennt die Projektion am did", () => {
    expect(isPersonProjection(projection)).toBe(true)
  })

  it("hält einen Platzhalter ohne did für ein gewöhnliches Item", () => {
    expect(isPersonProjection(placeholder)).toBe(false)
    expect(isPersonProjection({ ...placeholder, type: "post" })).toBe(false)
  })

  it("lehnt Schreibzugriffe auf Projektionen mit klarer Meldung ab", () => {
    expect(() => assertNotPersonProjection(projection, "update")).toThrow(/Projektion/)
    expect(() => assertNotPersonProjection(projection, "delete")).toThrow(/Profil/)
    expect(() => assertNotPersonProjection(placeholder, "update")).not.toThrow()
    expect(() => assertNotPersonProjection(null, "delete")).not.toThrow()
  })
})

describe("mergePersonProjections", () => {
  it("hängt Projektionen an den gespeicherten Strom an", () => {
    const stored: Item[] = [{ id: "i1", type: "post", createdAt: "x", createdBy: "u", data: {} }]
    const merged = mergePersonProjections(stored, [projectPersonItem({ id: "u1" })])
    expect(merged.map((i) => i.id)).toEqual(["i1", "u1"])
  })

  it("lässt einem gespeicherten Item mit gleicher Id den Vortritt", () => {
    const stored: Item[] = [{ id: "u1", type: "person", createdAt: "x", createdBy: "u", data: { displayName: "gespeichert" } }]
    const merged = mergePersonProjections(stored, [projectPersonItem({ id: "u1", displayName: "projiziert" })])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.data.displayName).toBe("gespeichert")
  })
})

// --- Reaktiver Baustein ---

function harness(options: {
  members?: Record<string, User[]>
  loadProfile?: (id: string) => Promise<Parameters<typeof projectPersonItem>[1]>
} = {}) {
  const group = createObservable<Group | null>({ id: "g1", name: "Space" })
  const memberObs = new Map<string | null, ReturnType<typeof createObservable<User[]>>>()
  const members = options.members ?? { g1: [{ id: "user-1", displayName: "Anton" }] }
  const onChange = vi.fn()
  const store = new PersonProjectionStore({
    observeCurrentGroup: () => group,
    observeMembers: (groupId) => {
      const key = groupId
      if (!memberObs.has(key)) memberObs.set(key, createObservable<User[]>(members[key ?? ""] ?? []))
      return memberObs.get(key)!
    },
    loadProfile: options.loadProfile,
    onChange,
  })
  return { store, group, memberObs, onChange }
}

describe("PersonProjectionStore", () => {
  it("projiziert die Mitglieder des aktiven Space", () => {
    const { store } = harness()
    expect(store.current.map((i) => i.id)).toEqual(["user-1"])
    expect(store.current[0]!.data.displayName).toBe("Anton")
  })

  it("folgt einer Mitgliedsänderung und meldet sie dem Connector", () => {
    const { store, memberObs, onChange } = harness()
    memberObs.get("g1")!.set([{ id: "user-1", displayName: "Anton" }, { id: "user-2", displayName: "Timo" }])
    expect(store.current.map((i) => i.id)).toEqual(["user-1", "user-2"])
    expect(onChange).toHaveBeenCalled()
  })

  it("wechselt mit dem aktiven Space", () => {
    const { store, group } = harness({
      members: { g1: [{ id: "user-1" }], g2: [{ id: "user-2" }] },
    })
    group.set({ id: "g2", name: "Zweiter" })
    expect(store.current.map((i) => i.id)).toEqual(["user-2"])
  })

  it("blockiert den Item-Strom nicht auf das Netz und trägt das Profil nach", async () => {
    let resolveProfile: (value: { bio: string }) => void = () => {}
    const { store, onChange } = harness({
      loadProfile: () => new Promise((resolve) => { resolveProfile = resolve as never }),
    })
    // Sofort da — nur aus `User`, ohne auf das Profil zu warten.
    expect(store.current[0]!.data.bio).toBeUndefined()
    resolveProfile({ bio: "Gärtner" })
    await vi.waitFor(() => expect(store.current[0]!.data.bio).toBe("Gärtner"))
    expect(onChange).toHaveBeenCalled()
  })

  it("lädt ein Profil nach invalidateProfile neu", async () => {
    let bio = "alt"
    const { store } = harness({ loadProfile: async () => ({ bio }) })
    await vi.waitFor(() => expect(store.current[0]!.data.bio).toBe("alt"))
    bio = "neu"
    store.invalidateProfile("user-1")
    await vi.waitFor(() => expect(store.current[0]!.data.bio).toBe("neu"))
  })

  it("überlebt ein fehlschlagendes Profil (nur displayName aus User)", async () => {
    const { store } = harness({ loadProfile: async () => { throw new Error("offline") } })
    await Promise.resolve()
    expect(store.current.map((i) => i.id)).toEqual(["user-1"])
    expect(store.current[0]!.data.displayName).toBe("Anton")
  })

  it("hört nach dispose auf zu melden", () => {
    const { store, memberObs, onChange } = harness()
    store.dispose()
    onChange.mockClear()
    memberObs.get("g1")!.set([{ id: "user-9" }])
    expect(onChange).not.toHaveBeenCalled()
    expect(store.current).toEqual([])
  })
})
