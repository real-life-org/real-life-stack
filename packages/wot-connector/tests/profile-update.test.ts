import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { IdentityWorkflow } from "@real-life/wot-core/application"
import { InMemoryMessagingAdapter } from "@real-life/wot-core/adapters"
import { WebCryptoProtocolCryptoAdapter } from "@real-life/wot-core"
import { INBOX_MESSAGE_TYPE, isDidcommMessage } from "@real-life/wot-core/protocol"
import type { WireMessage } from "@real-life/wot-core/ports"
import type { Contact, PublicIdentitySession } from "@real-life/wot-core/types"

import { InboxReceptionHost } from "../src/inbox-reception-host.js"
import { sendProfileUpdateInbox } from "../src/profile-update-wire.js"
import { applyContactNameSummary, applyContactProfile } from "../src/contact-profile-writer.js"

/**
 * wot#386: Profiländerungen reisen verschlüsselt als inbox/1.0-Body
 * { kind:'profile-update', profile } an die Kontakte — der frühere
 * Old-World-`profile-update` kam nie an (Relay-Whitelist). Alle Schreiber
 * eines Kontaktprofils (Inbox, Discovery) laufen über eine je Kontakt
 * serialisierte Schreibstelle mit der Regel „nur Neueres“.
 */

const protocolCrypto = new WebCryptoProtocolCryptoAdapter()

async function identity(passphrase: string): Promise<PublicIdentitySession> {
  return (await new IdentityWorkflow({ crypto: protocolCrypto }).createIdentity({
    passphrase,
    storeSeed: false,
  })).identity
}

function contactStore(contact: Contact) {
  const contacts = new Map<string, Contact>([[contact.did, contact]])
  return {
    contacts,
    getContact: async (did: string) => contacts.get(did) ?? null,
    updateContact: async (next: Contact) => { contacts.set(next.did, next) },
  }
}

function baseContact(did: string, overrides: Partial<Contact> = {}): Contact {
  return {
    did, publicKey: "z6Mk", name: "Anna alt", bio: "alt", avatar: "data:image/png;base64,ALT",
    status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("profile-update over inbox/1.0", () => {
  let alice: PublicIdentitySession
  let bob: PublicIdentitySession
  let aliceMessaging: InMemoryMessagingAdapter
  let bobMessaging: InMemoryMessagingAdapter

  beforeEach(async () => {
    InMemoryMessagingAdapter.resetAll()
    alice = await identity("alice-profile")
    bob = await identity("bob-profile")
    aliceMessaging = new InMemoryMessagingAdapter()
    bobMessaging = new InMemoryMessagingAdapter()
    await aliceMessaging.connect(alice.getDid())
    await bobMessaging.connect(bob.getDid())
  })

  afterEach(async () => {
    await aliceMessaging.disconnect()
    await bobMessaging.disconnect()
    InMemoryMessagingAdapter.resetAll()
  })

  it("sends the profile encrypted and the contact takes it over (end to end)", async () => {
    const store = contactStore(baseContact(alice.getDid()))
    const host = new InboxReceptionHost({ messaging: bobMessaging, identity: bob, crypto: protocolCrypto })
    host.onProfileUpdate(({ profile, senderDid }) => applyContactProfile(store, senderDid, profile).then(() => {}))
    host.start()

    const sent: WireMessage[] = []
    const baseSend = aliceMessaging.send.bind(aliceMessaging)
    aliceMessaging.send = async (message) => { sent.push(message); return baseSend(message) }

    await sendProfileUpdateInbox({
      identity: alice,
      contactDid: bob.getDid(),
      profile: { name: "Anna", bio: "Gärtnerin", updatedAt: "2026-10-01T12:00:00.000Z" },
      recipientEncryptionPublicKey: await bob.getEncryptionPublicKeyBytes(),
      messaging: aliceMessaging,
      crypto: protocolCrypto,
    })

    await vi.waitFor(() => expect(store.contacts.get(alice.getDid())).toMatchObject({
      name: "Anna", bio: "Gärtnerin", profileUpdatedAt: "2026-10-01T12:00:00.000Z",
    }))
    expect(store.contacts.get(alice.getDid())!.avatar).toBeUndefined()
    expect(sent).toHaveLength(1)
    expect(isDidcommMessage(sent[0]) && sent[0].type).toBe(INBOX_MESSAGE_TYPE)
    expect(JSON.stringify(sent[0])).not.toContain("Gärtnerin")
    host.stop()
  })

  it("does not ack a buffered update after its listener unsubscribed; the next subscriber gets it", async () => {
    const host = new InboxReceptionHost({ messaging: bobMessaging, identity: bob, crypto: protocolCrypto })
    host.start()
    const acks: WireMessage[] = []
    const baseSend = bobMessaging.send.bind(bobMessaging)
    bobMessaging.send = async (message) => {
      if (isDidcommMessage(message) && message.type.endsWith("/ack/1.0")) acks.push(message)
      return baseSend(message)
    }
    const send = async (updatedAt: string) => sendProfileUpdateInbox({
      identity: alice,
      contactDid: bob.getDid(),
      profile: { name: "Anna", updatedAt },
      recipientEncryptionPublicKey: await bob.getEncryptionPublicKeyBytes(),
      messaging: aliceMessaging,
      crypto: protocolCrypto,
    })
    await send("2026-10-01T12:00:00.000Z")
    await send("2026-10-02T12:00:00.000Z")

    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const first = vi.fn(async () => { await gate })
    const unsubscribe = host.onProfileUpdate(first)
    await vi.waitFor(() => expect(first).toHaveBeenCalledTimes(1))
    unsubscribe()
    release()
    await vi.waitFor(() => expect(acks).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(acks).toHaveLength(1)

    const next = vi.fn(async () => {})
    host.onProfileUpdate(next)
    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledTimes(1)
      expect(acks).toHaveLength(2)
    })
    host.stop()
  })
})

describe("contact profile writer", () => {
  const ANNA = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"

  it("takes over a newer profile with full-profile semantics", async () => {
    const store = contactStore(baseContact(ANNA, { profileUpdatedAt: "2026-10-01T12:00:00Z" }))
    expect(await applyContactProfile(store, ANNA, { name: "Anna neu", updatedAt: "2026-10-02T12:00:00Z" })).toBe(true)
    const stored = store.contacts.get(ANNA)!
    expect(stored).toMatchObject({ name: "Anna neu", profileUpdatedAt: "2026-10-02T12:00:00Z" })
    expect(stored.bio).toBeUndefined()
  })

  it("never lets an older or untimed profile replace a timestamped one", async () => {
    const store = contactStore(baseContact(ANNA, { name: "Anna neu", profileUpdatedAt: "2026-10-01T12:00:00Z" }))
    expect(await applyContactProfile(store, ANNA, { name: "alt", updatedAt: "2026-09-01T12:00:00Z" })).toBe(false)
    expect(await applyContactProfile(store, ANNA, { name: "ohne Zeit" })).toBe(false)
    expect(await applyContactProfile(store, ANNA, { name: "lokale Zeit", updatedAt: "2026-10-05T12:00:00" })).toBe(false)
    expect(store.contacts.get(ANNA)!.name).toBe("Anna neu")
  })

  it("a late, older discovery answer cannot overwrite a newer inbox profile (overlapping writes)", async () => {
    const store = contactStore(baseContact(ANNA))
    const realUpdate = store.updateContact
    store.updateContact = async (next: Contact) => {
      if (next.name === "old discovery") await new Promise((r) => setTimeout(r, 20))
      await realUpdate(next)
    }
    await Promise.all([
      applyContactProfile(store, ANNA, { name: "old discovery", updatedAt: "2026-09-01T12:00:00Z" }),
      applyContactProfile(store, ANNA, { name: "new inbox", updatedAt: "2026-10-01T12:00:00Z" }),
    ])
    expect(store.contacts.get(ANNA)).toMatchObject({ name: "new inbox", profileUpdatedAt: "2026-10-01T12:00:00Z" })
  })

  it("a name-only summary updates the name but keeps avatar and bio, and never beats a timestamped profile", async () => {
    const store = contactStore(baseContact(ANNA))
    expect(await applyContactNameSummary(store, ANNA, "Anna aus Zusammenfassung")).toBe(true)
    expect(store.contacts.get(ANNA)).toMatchObject({ name: "Anna aus Zusammenfassung", bio: "alt", avatar: "data:image/png;base64,ALT" })

    store.contacts.set(ANNA, { ...store.contacts.get(ANNA)!, profileUpdatedAt: "2026-10-01T12:00:00Z" })
    expect(await applyContactNameSummary(store, ANNA, "veraltet")).toBe(false)
    expect(store.contacts.get(ANNA)!.name).toBe("Anna aus Zusammenfassung")
  })
})
