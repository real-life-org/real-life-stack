import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  InMemoryGraphCacheStore,
  InMemoryPublishStateStore,
  OfflineFirstDiscoveryAdapter,
  type PublicProfile,
} from "@real-life/wot-core"

/**
 * Tests for the profile sync logic that the WoT Connector must implement:
 *
 * - Offline-first profile publish
 * - On init → sync all contact profiles from discovery server
 *
 * Profile changes to contacts travel as inbox/1.0 profile-update (wot#386);
 * see profile-update.test.ts.
 *
 * These tests validate the logic in isolation, using the same patterns as useProfileSync.ts
 * in the Demo App.
 */

// --- Types ---

interface Contact {
  did: string
  name: string | null
  avatar?: string | null
  bio?: string | null
  status: string
}

// --- Fake implementations ---

function createFakeStorage(contacts: Contact[] = []) {
  const store = new Map<string, Contact>(contacts.map((c) => [c.did, { ...c }]))

  return {
    getContacts: vi.fn(async () => [...store.values()]),
    getContact: vi.fn(async (did: string) => store.get(did) ?? null),
    updateContact: vi.fn(async (contact: Contact) => {
      store.set(contact.did, { ...contact })
    }),
    _store: store,
  }
}

function createFakeDiscovery(profiles: Map<string, PublicProfile> = new Map()) {
  return {
    resolveProfile: vi.fn(async (did: string) => {
      const profile = profiles.get(did) ?? null
      return { profile }
    }),
    publishProfile: vi.fn(async () => {}),
  }
}

/**
 * Sync all contact profiles from discovery on init.
 * Fetch each contact's profile and update name/avatar/bio if changed.
 */
async function syncContactProfiles(
  storage: ReturnType<typeof createFakeStorage>,
  discovery: ReturnType<typeof createFakeDiscovery>,
) {
  const contacts = await storage.getContacts()
  for (const contact of contacts) {
    const result = await discovery.resolveProfile(contact.did)
    const profile = result.profile
    if (!profile?.name) continue

    const needsUpdate =
      (contact.name || null) !== (profile.name || null) ||
      (contact.avatar || null) !== (profile.avatar || null) ||
      (contact.bio || null) !== (profile.bio || null)

    if (needsUpdate) {
      await storage.updateContact({
        ...contact,
        name: profile.name,
        ...(profile.avatar ? { avatar: profile.avatar } : {}),
        ...(profile.bio ? { bio: profile.bio } : {}),
      })
    }
  }
}

// --- Tests ---

describe("Offline-first profile publish", () => {
  it("does not throw offline and retries the latest dirty profile", async () => {
    const did = "did:key:alice"
    const firstProfile: PublicProfile = {
      did,
      name: "Alice Offline",
      avatar: "avatar-v1",
      updatedAt: "2026-07-16T09:00:00.000Z",
    }
    const retryProfile: PublicProfile = {
      ...firstProfile,
      avatar: "avatar-v2",
      updatedAt: "2026-07-16T09:01:00.000Z",
    }
    const publishProfile = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined)
    const inner = { publishProfile } as any
    const publishState = new InMemoryPublishStateStore()
    const discovery = new OfflineFirstDiscoveryAdapter(
      inner,
      publishState,
      new InMemoryGraphCacheStore(),
    )
    const identity = {} as any

    await expect(discovery.publishProfile(firstProfile, identity)).resolves.toBeUndefined()
    expect(await publishState.getDirtyFields(did)).toContain("profile")

    await discovery.syncPending(did, identity, async () => ({ profile: retryProfile }))

    expect(publishProfile).toHaveBeenNthCalledWith(1, firstProfile, identity)
    expect(publishProfile).toHaveBeenNthCalledWith(2, retryProfile, identity)
    expect(await publishState.getDirtyFields(did)).not.toContain("profile")
  })
})

describe("Contact Profile Sync on Init", () => {
  it("updates outdated contact names from discovery", async () => {
    const storage = createFakeStorage([
      { did: "did:key:bob", name: "Old Name", status: "active" },
      { did: "did:key:carla", name: "Carla", status: "active" },
    ])
    const discovery = createFakeDiscovery(
      new Map([
        ["did:key:bob", { did: "did:key:bob", name: "Bob Updated", encryptionPublicKey: "k", updatedAt: new Date().toISOString() }],
        ["did:key:carla", { did: "did:key:carla", name: "Carla", encryptionPublicKey: "k", updatedAt: new Date().toISOString() }],
      ])
    )

    await syncContactProfiles(storage, discovery)

    // Bob was updated
    expect(storage.updateContact).toHaveBeenCalledTimes(1)
    expect(storage.updateContact).toHaveBeenCalledWith(
      expect.objectContaining({ did: "did:key:bob", name: "Bob Updated" })
    )
  })

  it("skips contacts when discovery has no profile", async () => {
    const storage = createFakeStorage([
      { did: "did:key:bob", name: "Bob", status: "active" },
    ])
    const discovery = createFakeDiscovery(new Map()) // Empty server

    await syncContactProfiles(storage, discovery)

    expect(storage.updateContact).not.toHaveBeenCalled()
  })

  it("updates avatar and bio from discovery", async () => {
    const storage = createFakeStorage([
      { did: "did:key:bob", name: "Bob", avatar: null, bio: null, status: "active" },
    ])
    const discovery = createFakeDiscovery(
      new Map([["did:key:bob", {
        did: "did:key:bob", name: "Bob",
        avatar: "new-avatar.jpg", bio: "New bio",
        encryptionPublicKey: "k", updatedAt: new Date().toISOString(),
      }]])
    )

    await syncContactProfiles(storage, discovery)

    expect(storage.updateContact).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: "new-avatar.jpg", bio: "New bio" })
    )
  })

  it("handles empty contact list", async () => {
    const storage = createFakeStorage([])
    const discovery = createFakeDiscovery()

    await syncContactProfiles(storage, discovery)

    expect(discovery.resolveProfile).not.toHaveBeenCalled()
    expect(storage.updateContact).not.toHaveBeenCalled()
  })

  it("continues when one contact's profile fetch fails", async () => {
    const storage = createFakeStorage([
      { did: "did:key:bob", name: "Bob", status: "active" },
      { did: "did:key:carla", name: "Old Carla", status: "active" },
    ])
    const discovery = createFakeDiscovery(
      new Map([["did:key:carla", {
        did: "did:key:carla", name: "New Carla",
        encryptionPublicKey: "k", updatedAt: new Date().toISOString(),
      }]])
    )
    // Bob's profile fetch returns null (not on server)
    // Carla's profile fetch returns updated name

    await syncContactProfiles(storage, discovery)

    // Only Carla should be updated
    expect(storage.updateContact).toHaveBeenCalledTimes(1)
    expect(storage.updateContact).toHaveBeenCalledWith(
      expect.objectContaining({ did: "did:key:carla", name: "New Carla" })
    )
  })
})
