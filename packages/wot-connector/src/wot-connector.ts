import type {
  Item,
  ItemFilter,
  Group,
  User,
  Observable,
  AuthState,
  AuthMethod,
  RelatedItemsOptions,
  Source,
  ContactInfo,
  RelayState,
  SignedClaim,
  ClaimDeliveryStatus,
  VerificationDirection,
} from "@real-life-stack/data-interface"
import {
  BaseConnector,
  createObservable,
  matchesFilter,
  type ReactiveObservable,
} from "@real-life-stack/data-interface"

import {
  WotIdentity,
  WebSocketMessagingAdapter,
  OutboxMessagingAdapter,
  AutomergeOutboxStore,
  AutomergeSpaceMetadataStorage,
  GroupKeyService,
  AutomergeReplicationAdapter,
  HttpDiscoveryAdapter,
  VerificationHelper,
  initPersonalDoc,
  getPersonalDoc,
  resetPersonalDoc,
  deletePersonalDocDB,
  onPersonalDocChange,
  getDefaultDisplayName,
  changePersonalDoc,
  encodeBase64Url,
} from "@real-life/wot-core"
import type {
  SpaceInfo,
  SpaceHandle,
  Subscribable,
  MessagingAdapter,
  PersonalDoc,
  PublicProfile,
  VerificationDoc,
  AttestationDoc,
  AttestationMetadataDoc,
} from "@real-life/wot-core"

import type { WotConnectorConfig, RlsSpaceDoc, SerializedItem } from "./types.js"
import { serializeItem, deserializeItem } from "./serialization.js"

// --- Constants ---

const RLS_SPACE_TYPE = "rls"
const DEFAULT_MODULES = ["feed", "kanban", "calendar", "map"]

// --- WotConnector ---

export class WotConnector extends BaseConnector {
  private config: WotConnectorConfig
  private identity: WotIdentity
  private discovery: HttpDiscoveryAdapter

  // Adapters (initialized after auth)
  private wsAdapter: WebSocketMessagingAdapter | null = null
  private outboxAdapter: OutboxMessagingAdapter | null = null
  private replication: AutomergeReplicationAdapter | null = null
  private groupKeyService: GroupKeyService | null = null

  // State
  private currentGroupId: string | null = null
  private currentHandle: SpaceHandle<RlsSpaceDoc> | null = null
  private handleReady: Promise<void> = Promise.resolve()
  private handleRemoteUnsub: (() => void) | null = null
  private spacesSubscriptionUnsub: (() => void) | null = null
  private personalDocUnsub: (() => void) | null = null

  // Observables (stable references — backing changes on group switch)
  private authStateObs: ReactiveObservable<AuthState>
  private contactsObs: ReactiveObservable<ContactInfo[]>
  private claimsObs: ReactiveObservable<SignedClaim[]>
  private deliveryStatusObs: ReactiveObservable<Map<string, ClaimDeliveryStatus>>
  private relayStateObs: ReactiveObservable<RelayState>
  private outboxCountObs: ReactiveObservable<number>
  private groupsCache: Group[] = []

  // Verification challenge state (in-progress challenges)
  private pendingChallenge: { code: string; nonce: string } | null = null

  // Item observables keyed by JSON.stringify(filter)
  private itemObservables = new Map<string, ReactiveObservable<Item[]>>()
  private itemByIdObservables = new Map<string, ReactiveObservable<Item | null>>()

  constructor(config: WotConnectorConfig) {
    super()
    this.config = config
    this.identity = new WotIdentity()
    this.discovery = new HttpDiscoveryAdapter(config.profilesUrl)
    this.authStateObs = createObservable<AuthState>({ status: "loading" })
    this.contactsObs = createObservable<ContactInfo[]>([])
    this.claimsObs = createObservable<SignedClaim[]>([])
    this.deliveryStatusObs = createObservable<Map<string, ClaimDeliveryStatus>>(new Map())
    this.relayStateObs = createObservable<RelayState>("disconnected")
    this.outboxCountObs = createObservable<number>(0)
  }

  // ==================== Lifecycle ====================

  async init(): Promise<void> {
    const hasStored = await this.identity.hasStoredIdentity()
    if (hasStored) {
      const hasSession = await this.identity.hasActiveSession()
      if (hasSession) {
        try {
          await this.identity.unlockFromStorage()
          await this.bootstrapAdapters()
          await this.setAuthAuthenticated()
          return
        } catch {
          // Session expired or corrupt — need manual unlock
        }
      }
      this.authStateObs.set({ status: "unauthenticated" })
    } else {
      this.authStateObs.set({ status: "unauthenticated" })
    }
  }

  async dispose(): Promise<void> {
    this.closeCurrentHandle()
    this.spacesSubscriptionUnsub?.()
    this.personalDocUnsub?.()
    await this.replication?.stop()
    await this.outboxAdapter?.disconnect()
    await this.wsAdapter?.disconnect()
    await resetPersonalDoc()

    for (const obs of this.itemObservables.values()) obs.destroy()
    for (const obs of this.itemByIdObservables.values()) obs.destroy()
    this.itemObservables.clear()
    this.itemByIdObservables.clear()
    this.authStateObs.destroy()
    this.contactsObs.destroy()
    this.relayStateObs.destroy()
    this.outboxCountObs.destroy()
  }

  // ==================== Auth ====================

  override getAuthState(): Observable<AuthState> {
    return this.authStateObs
  }

  override getAuthMethods(): AuthMethod[] {
    return [{ method: "did", label: "Web of Trust (DID)" }]
  }

  override async authenticate(method: string, credentials: unknown): Promise<User> {
    const creds = credentials as Record<string, string>

    // Generate mnemonic without saving — used by OnboardingFlow step 1
    if (method === "generate") {
      const { mnemonic, did } = await this.identity.create("", false)
      const user: User & { _mnemonic: string } = {
        id: did,
        displayName: did.slice(-8),
        _mnemonic: mnemonic,
      }
      return user
    }

    // Finalize identity creation with mnemonic + passphrase
    if (method === "create") {
      if (creds.mnemonic) {
        // New flow: mnemonic was pre-generated via "generate"
        await this.identity.unlock(creds.mnemonic, creds.passphrase, true)
      } else {
        // Legacy flow: generate + save in one step
        await this.identity.create(creds.passphrase, true)
      }
      await this.bootstrapAdapters()
      // Write initial profile if provided
      if (creds.displayName || creds.bio) {
        const did = this.identity.getDid()
        const now = new Date().toISOString()
        changePersonalDoc((doc) => {
          doc.profile = {
            did,
            name: creds.displayName || null,
            bio: creds.bio || null,
            avatar: null,
            offersJson: null,
            needsJson: null,
            createdAt: now,
            updatedAt: now,
          }
        })
      }
      await this.setAuthAuthenticated()
      const user = await this.getCurrentUser()
      return user!
    }

    if (method === "mnemonic") {
      await this.identity.unlock(creds.mnemonic, creds.passphrase, true)
      await this.bootstrapAdapters()
      await this.setAuthAuthenticated()
      return (await this.getCurrentUser())!
    }

    if (method === "unlock") {
      await this.identity.unlockFromStorage(creds.passphrase)
      await this.bootstrapAdapters()
      await this.setAuthAuthenticated()
      return (await this.getCurrentUser())!
    }

    throw new Error(`Unknown auth method: ${method}`)
  }

  override async logout(): Promise<void> {
    this.closeCurrentHandle()
    this.spacesSubscriptionUnsub?.()
    this.personalDocUnsub?.()
    await this.replication?.stop()
    await this.outboxAdapter?.disconnect()
    await this.wsAdapter?.disconnect()

    this.wsAdapter = null
    this.outboxAdapter = null
    this.replication = null
    this.groupKeyService = null
    this.currentGroupId = null
    this.groupsCache = []
    this.groupsObservable.set([])

    await deletePersonalDocDB()
    await this.identity.deleteStoredIdentity()

    // Clear identity switch marker
    try { localStorage.removeItem("rls-wot-active-did") } catch { /* ignore */ }

    this.authStateObs.set({ status: "unauthenticated" })
    this.notifyAllObservers()
  }

  /** Update the local profile in PersonalDoc */
  async updateProfile(updates: { name?: string; bio?: string; avatar?: string }): Promise<User> {
    const did = this.identity.getDid()
    const now = new Date().toISOString()
    changePersonalDoc((doc) => {
      if (!doc.profile) {
        doc.profile = {
          did,
          name: null,
          bio: null,
          avatar: null,
          offersJson: null,
          needsJson: null,
          createdAt: now,
          updatedAt: now,
        }
      }
      if (updates.name !== undefined) doc.profile.name = updates.name || null
      if (updates.bio !== undefined) doc.profile.bio = updates.bio || null
      if (updates.avatar !== undefined) doc.profile.avatar = updates.avatar || null
      doc.profile.updatedAt = now
    })
    // Re-publish to discovery server
    this.publishProfile().catch(() => {})
    return (await this.getCurrentUser())!
  }

  /** Get the current user's DID */
  getDid(): string {
    return this.identity.getDid()
  }

  override async getCurrentUser(): Promise<User | null> {
    try {
      const did = this.identity.getDid()
      const doc = getPersonalDoc()
      const profile = doc.profile
      return {
        id: did,
        displayName: profile?.name ?? getDefaultDisplayName(did),
        avatarUrl: profile?.avatar ?? undefined,
      }
    } catch {
      return null
    }
  }

  override async getUser(id: string): Promise<User | null> {
    // Lookup cascade: cachedGraph -> contacts -> HttpDiscovery -> fallback
    try {
      const doc = getPersonalDoc()

      // 1. cachedGraph
      const cached = doc.cachedGraph?.entries?.[id]
      if (cached) {
        return {
          id,
          displayName: cached.name ?? getDefaultDisplayName(id),
          avatarUrl: cached.avatar ?? undefined,
        }
      }

      // 2. contacts
      const contact = doc.contacts?.[id]
      if (contact) {
        return {
          id,
          displayName: contact.name ?? getDefaultDisplayName(id),
          avatarUrl: contact.avatar ?? undefined,
        }
      }
    } catch {
      // PersonalDoc not initialized — try network
    }

    // 3. HttpDiscovery
    try {
      const result = await this.discovery.resolveProfile(id)
      return {
        id,
        displayName: result.profile?.name ?? getDefaultDisplayName(id),
        avatarUrl: result.profile?.avatar ?? undefined,
      }
    } catch {
      // Network error — fallback
    }

    // 4. Fallback
    return { id, displayName: getDefaultDisplayName(id) }
  }

  // ==================== Groups ====================

  override async getGroups(): Promise<Group[]> {
    return this.groupsCache
  }

  override getCurrentGroup(): Group | null {
    if (!this.currentGroupId) return null
    return this.groupsCache.find((g) => g.id === this.currentGroupId) ?? null
  }

  override setCurrentGroup(id: string): void {
    if (this.currentGroupId === id) return
    this.currentGroupId = id

    // Close old handle, open new one
    this.closeCurrentHandle()

    if (this.replication) {
      this.handleReady = this.openCurrentHandle().then(() => this.notifyAllObservers())
    }
  }

  override async createGroup(name: string, data?: Record<string, unknown>): Promise<Group> {
    if (!this.replication) throw new Error("Not authenticated")

    const modules = (data?.modules as string[]) ?? DEFAULT_MODULES
    const initialDoc: RlsSpaceDoc = {
      _type: RLS_SPACE_TYPE,
      items: {},
      metadata: { name, modules },
    }

    const space = await this.replication.createSpace("shared", initialDoc, { name, appTag: RLS_SPACE_TYPE })
    const group = this.spaceToGroup(space, initialDoc)

    // Auto-select first group
    if (!this.currentGroupId) {
      this.setCurrentGroup(group.id)
    }

    return group
  }

  override async updateGroup(id: string, updates: Partial<Group>): Promise<Group> {
    // If we have a handle for this group, update metadata via transact
    const handle = id === this.currentGroupId
      ? this.currentHandle
      : await this.replication?.openSpace<RlsSpaceDoc>(id)

    if (!handle) throw new Error("Group not found")

    handle.transact((doc) => {
      if (updates.name) doc.metadata.name = updates.name
      if (updates.data?.modules) doc.metadata.modules = updates.data.modules as string[]
    })

    if (id !== this.currentGroupId) handle.close()

    const group = this.groupsCache.find((g) => g.id === id)
    if (group) {
      if (updates.name) group.name = updates.name
      if (updates.data) group.data = { ...group.data, ...updates.data }
      this.groupsObservable.set([...this.groupsCache])
    }
    return group ?? { id, name: updates.name ?? "Unknown", ...updates }
  }

  override async deleteGroup(id: string): Promise<void> {
    if (!this.replication) throw new Error("Not authenticated")

    // "Delete" = leave the space: remove metadata from PersonalDoc + removeMember(self)
    const did = this.identity.getDid()
    try {
      await this.replication.removeMember(id, did)
    } catch {
      // May fail if already removed
    }

    // If this was the current group, switch away
    if (this.currentGroupId === id) {
      this.closeCurrentHandle()
      this.currentGroupId = null
      this.notifyAllObservers()
    }
  }

  override async getMembers(groupId: string): Promise<User[]> {
    if (!this.replication) return []
    const space = await this.replication.getSpace(groupId)
    if (!space) return []

    const users = await Promise.all(
      space.members.map((did) => this.getUser(did))
    )
    return users.filter((u): u is User => u !== null)
  }

  override async inviteMember(groupId: string, userId: string): Promise<void> {
    if (!this.replication) throw new Error("Not authenticated")

    // Resolve member's encryption public key via discovery
    const result = await this.discovery.resolveProfile(userId)
    if (!result.profile?.encryptionPublicKey) {
      throw new Error(`Cannot invite ${userId}: encryption key not found`)
    }

    // Decode the base64url encryption key
    const keyBytes = base64UrlToBytes(result.profile.encryptionPublicKey)
    await this.replication.addMember(groupId, userId, keyBytes)
  }

  override async removeMember(groupId: string, userId: string): Promise<void> {
    if (!this.replication) throw new Error("Not authenticated")
    await this.replication.removeMember(groupId, userId)
  }

  // ==================== Items ====================

  override async getItems(filter?: ItemFilter): Promise<Item[]> {
    await this.handleReady
    const doc = this.getCurrentDoc()
    if (!doc) return []

    const items = Object.values(doc.items).map(deserializeItem)
    if (!filter) return items
    return items.filter((item) => matchesFilter(item, filter))
  }

  override async getItem(id: string): Promise<Item | null> {
    await this.handleReady
    const doc = this.getCurrentDoc()
    if (!doc) return null

    const serialized = doc.items[id]
    if (!serialized) return null
    return deserializeItem(serialized)
  }

  override async createItem(item: Omit<Item, "id" | "createdAt">): Promise<Item> {
    await this.handleReady
    const handle = this.currentHandle
    if (!handle) throw new Error("No active group selected")

    const id = crypto.randomUUID()
    const newItem: Item = {
      ...item,
      id,
      createdAt: new Date(),
    }

    const serialized = serializeItem(newItem)
    handle.transact((doc) => {
      doc.items[id] = serialized
    })
    this.notifyAllObservers()
    return newItem
  }

  override async updateItem(id: string, updates: Partial<Item>): Promise<Item> {
    await this.handleReady
    const handle = this.currentHandle
    if (!handle) throw new Error("No active group selected")

    handle.transact((doc) => {
      const existing = doc.items[id]
      if (!existing) throw new Error(`Item ${id} not found`)

      if (updates.type) existing.type = updates.type
      if (updates.data) {
        // Merge field-by-field; deep-clone values to avoid Automerge
        // "reference to existing document object" error
        for (const [key, value] of Object.entries(updates.data)) {
          existing.data[key] = (typeof value === "object" && value !== null)
            ? JSON.parse(JSON.stringify(value))
            : value as any
        }
      }
      if (updates.relations !== undefined) existing.relations = updates.relations
      if (updates.schema !== undefined) existing.schema = updates.schema
      if (updates.schemaVersion !== undefined) existing.schemaVersion = updates.schemaVersion
    })

    this.notifyAllObservers()
    const updated = await this.getItem(id)
    if (!updated) throw new Error(`Item ${id} disappeared after update`)
    return updated
  }

  override async deleteItem(id: string): Promise<void> {
    await this.handleReady
    const handle = this.currentHandle
    if (!handle) throw new Error("No active group selected")

    handle.transact((doc) => {
      delete doc.items[id]
    })
    this.notifyAllObservers()
  }

  // ==================== Observables ====================

  override observe(filter: ItemFilter): Observable<Item[]> {
    const key = JSON.stringify(filter)
    let obs = this.itemObservables.get(key)
    if (!obs) {
      obs = createObservable<Item[]>([])
      this.itemObservables.set(key, obs)
      // Load initial data (awaits handleReady internally)
      void this.getItems(filter).then((items) => obs!.set(items))
    }
    return obs
  }

  override observeItem(id: string): Observable<Item | null> {
    let obs = this.itemByIdObservables.get(id)
    if (!obs) {
      obs = createObservable<Item | null>(null)
      this.itemByIdObservables.set(id, obs)
      // Load initial data (awaits handleReady internally)
      void this.getItem(id).then((item) => obs!.set(item))
    }
    return obs
  }

  // ==================== Internal: Bootstrap ====================

  private async bootstrapAdapters(): Promise<void> {
    const did = this.identity.getDid()

    // Identity switch cleanup
    const prevDid = safeLocalStorage("rls-wot-active-did")
    if (prevDid && prevDid !== did) {
      await this.cleanupOldIdentity()
    }
    try { localStorage.setItem("rls-wot-active-did", did) } catch { /* ignore */ }

    // 1. WebSocket connect (MUST happen before PersonalDoc so it can receive sync messages)
    this.wsAdapter = new WebSocketMessagingAdapter(this.config.relayUrl)

    // Register relay state listener BEFORE connect so we catch the 'connected' event
    this.wsAdapter.onStateChange((state) => {
      this.relayStateObs.set(state as RelayState)
    })

    const outboxStore = new AutomergeOutboxStore()
    this.outboxAdapter = new OutboxMessagingAdapter(this.wsAdapter, outboxStore, {
      skipTypes: ["profile-update", "attestation-ack", "personal-sync"] as any,
    })
    await this.wsAdapter.connect(did)

    // 2. PersonalDoc (multi-device sync for space metadata + group keys)
    await initPersonalDoc(
      this.identity,
      this.outboxAdapter as unknown as MessagingAdapter,
      this.config.vaultUrl,
    )

    // 3. Now that PersonalDoc is ready, connect OutboxAdapter to enable
    //    flush + auto-reconnect. wsAdapter.connect() is idempotent, so this
    //    just triggers flushOutbox() + _startAutoReconnect() without reconnecting.
    await this.outboxAdapter.connect(did)
    const spaceMetadataStorage = new AutomergeSpaceMetadataStorage()

    // 3. Group Keys
    this.groupKeyService = new GroupKeyService()

    // 4. Replication
    this.replication = new AutomergeReplicationAdapter({
      identity: this.identity,
      messaging: this.outboxAdapter as unknown as MessagingAdapter,
      groupKeyService: this.groupKeyService,
      metadataStorage: spaceMetadataStorage,
      vaultUrl: this.config.vaultUrl,
      spaceFilter: (info) => info.appTag === RLS_SPACE_TYPE,
    })
    await this.replication.start()

    // 5. Outbox pending count → outboxCountObs
    if (outboxStore.watchPendingCount) {
      outboxStore.watchPendingCount().subscribe((count) => {
        this.outboxCountObs.set(count)
      })
    }

    // 7. PersonalDoc changes -> restore spaces + update contacts + claims
    this.personalDocUnsub = onPersonalDocChange(() => {
      this.replication?.requestSync?.("__all__").catch(() => {})
      this.syncContactsFromPersonalDoc()
      this.syncClaimsFromPersonalDoc()
    })

    // 8. Load initial contacts + claims from PersonalDoc
    this.syncContactsFromPersonalDoc()
    this.syncClaimsFromPersonalDoc()

    // 9. Watch spaces for reactive group list
    const spacesSubscribable = this.replication.watchSpaces()
    this.spacesSubscriptionUnsub = spacesSubscribable.subscribe((spaces) => {
      this.updateGroupsFromSpaces(spaces)
    })
    // Load initial spaces
    this.updateGroupsFromSpaces(spacesSubscribable.getValue())

    // 10. Auto-create personal default group if no spaces exist
    if (this.groupsCache.length === 0) {
      await this.createGroup("Mein Bereich")
    }
  }

  private async setAuthAuthenticated(): Promise<void> {
    const user = await this.getCurrentUser()
    if (user) {
      this.authStateObs.set({ status: "authenticated", user })
    }
    // Publish profile to discovery server (non-blocking)
    this.publishProfile().catch(() => {})
  }

  private async publishProfile(): Promise<void> {
    const did = this.identity.getDid()
    const doc = getPersonalDoc()
    const encPubKeyBytes = await this.identity.getEncryptionPublicKeyBytes()
    const profile: PublicProfile = {
      did,
      name: doc.profile?.name ?? getDefaultDisplayName(did),
      ...(doc.profile?.bio ? { bio: doc.profile.bio } : {}),
      ...(doc.profile?.avatar ? { avatar: doc.profile.avatar } : {}),
      encryptionPublicKey: encodeBase64Url(encPubKeyBytes),
      updatedAt: new Date().toISOString(),
    }
    await this.discovery.publishProfile(profile, this.identity)
  }

  // ==================== Internal: Space/Group mapping ====================

  private updateGroupsFromSpaces(spaces: SpaceInfo[]): void {
    // Filter to RLS spaces only — spaces without appTag are from other apps (e.g. WoT Demo)
    this.groupsCache = spaces
      .filter((s) => s.type === "shared" && s.appTag === RLS_SPACE_TYPE)
      .map((s) => ({
        id: s.id,
        name: s.name ?? "Unnamed Space",
        data: { scope: "group", modules: DEFAULT_MODULES },
      }))

    // Update the reactive observable (inherited from BaseConnector)
    this.groupsObservable.set([...this.groupsCache])

    // Auto-select first group if none selected
    if (!this.currentGroupId && this.groupsCache.length > 0) {
      this.setCurrentGroup(this.groupsCache[0].id)
    }
  }

  private spaceToGroup(space: SpaceInfo, doc?: RlsSpaceDoc): Group {
    return {
      id: space.id,
      name: space.name ?? doc?.metadata?.name ?? "Unnamed Space",
      data: {
        scope: "group",
        modules: doc?.metadata?.modules ?? DEFAULT_MODULES,
      },
    }
  }

  // ==================== Internal: Handle management ====================

  private async openCurrentHandle(): Promise<void> {
    if (!this.replication || !this.currentGroupId) return

    try {
      this.currentHandle = await this.replication.openSpace<RlsSpaceDoc>(this.currentGroupId)

      // Listen for remote updates -> refresh observables
      this.handleRemoteUnsub = this.currentHandle.onRemoteUpdate(() => {
        this.notifyAllObservers()
      })
    } catch (err) {
      console.error("[WotConnector] Failed to open space:", err)
      this.currentHandle = null
    }
  }

  private closeCurrentHandle(): void {
    this.handleRemoteUnsub?.()
    this.handleRemoteUnsub = null
    this.currentHandle?.close()
    this.currentHandle = null
  }

  private getCurrentDoc(): RlsSpaceDoc | null {
    if (!this.currentHandle) return null
    try {
      return this.currentHandle.getDoc()
    } catch {
      return null
    }
  }

  // ==================== Internal: Observers ====================

  private notifyAllObservers(): void {
    const doc = this.getCurrentDoc()

    // Update item list observables
    for (const [key, obs] of this.itemObservables) {
      const filter: ItemFilter = JSON.parse(key)
      if (!doc) {
        obs.set([])
      } else {
        const items = Object.values(doc.items).map(deserializeItem)
        const filtered = items.filter((item) => matchesFilter(item, filter))
        obs.set(filtered)
      }
    }

    // Update single-item observables
    for (const [id, obs] of this.itemByIdObservables) {
      if (!doc) {
        obs.set(null)
      } else {
        const serialized = doc.items[id]
        obs.set(serialized ? deserializeItem(serialized) : null)
      }
    }
  }

  // ==================== Contacts ====================

  override async getContacts(): Promise<ContactInfo[]> {
    return this.contactsObs.current
  }

  override observeContacts(): Observable<ContactInfo[]> {
    return this.contactsObs
  }

  override async addContact(id: string, name?: string): Promise<ContactInfo> {
    const now = new Date().toISOString()

    // Try Discovery lookup for name/publicKey/avatar
    let publicKey: string | undefined
    let resolvedName = name
    let avatar: string | undefined
    let bio: string | undefined
    try {
      const result = await this.discovery.resolveProfile(id)
      if (result.profile) {
        resolvedName = resolvedName ?? result.profile.name ?? undefined
        avatar = result.profile.avatar ?? undefined
        bio = result.profile.bio ?? undefined
        publicKey = result.profile.encryptionPublicKey ?? undefined
      }
    } catch {
      // Discovery unavailable — add with what we have
    }

    const contact: ContactInfo = {
      id,
      publicKey,
      name: resolvedName,
      avatar,
      bio,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    }

    changePersonalDoc((doc) => {
      if (!doc.contacts) doc.contacts = {}
      doc.contacts[id] = {
        did: id,
        publicKey: publicKey ?? "",
        name: resolvedName ?? null,
        avatar: avatar ?? null,
        bio: bio ?? null,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      } as any
    })

    return contact
  }

  override async activateContact(id: string): Promise<void> {
    changePersonalDoc((doc) => {
      if (doc.contacts?.[id]) {
        doc.contacts[id].status = "active"
        doc.contacts[id].updatedAt = new Date().toISOString()
      }
    })
  }

  override async updateContactName(id: string, name: string): Promise<void> {
    changePersonalDoc((doc) => {
      if (doc.contacts?.[id]) {
        doc.contacts[id].name = name as any
        doc.contacts[id].updatedAt = new Date().toISOString()
      }
    })
  }

  override async removeContact(id: string): Promise<void> {
    changePersonalDoc((doc) => {
      if (doc.contacts) {
        delete doc.contacts[id]
      }
    })
  }

  // ==================== Messaging ====================

  override getRelayState(): Observable<RelayState> {
    return this.relayStateObs
  }

  override getOutboxPendingCount(): Observable<number> {
    return this.outboxCountObs
  }

  // ==================== Signed Claims ====================

  override async createClaim(toId: string, claim: string, tags?: string[]): Promise<SignedClaim> {
    const did = this.identity.getDid()
    const id = `urn:uuid:claim-${crypto.randomUUID()}`
    const now = new Date().toISOString()

    // Sign the claim
    const claimData = JSON.stringify({ from: did, to: toId, claim, timestamp: now })
    const signature = await this.identity.sign(claimData)

    // Store as attestation in PersonalDoc
    changePersonalDoc((doc) => {
      if (!doc.attestations) doc.attestations = {} as any
      doc.attestations[id] = {
        id,
        attestationId: id,
        fromDid: did,
        toDid: toId,
        claim,
        tagsJson: tags ? JSON.stringify(tags) : null,
        context: null,
        createdAt: now,
        proofJson: JSON.stringify({ type: "Ed25519Signature2020", proofValue: signature }),
      } as any
      if (!doc.attestationMetadata) doc.attestationMetadata = {} as any
      doc.attestationMetadata[id] = {
        attestationId: id,
        accepted: true,
        acceptedAt: now,
        deliveryStatus: "queued",
      } as any
    })

    return { id, from: did, to: toId, claim, tags, createdAt: now, isAccepted: true }
  }

  override async createChallenge(): Promise<{ code: string; nonce: string }> {
    const displayName = getPersonalDoc()?.profile?.name ?? getDefaultDisplayName(this.identity.getDid())
    const code = await VerificationHelper.createChallenge(this.identity, displayName)
    // Parse the nonce from the challenge
    const parsed = JSON.parse(atob(code))
    const nonce = parsed.nonce
    this.pendingChallenge = { code, nonce }
    return { code, nonce }
  }

  override async prepareResponse(challengeCode: string): Promise<{ peerId: string; peerName?: string }> {
    const parsed = JSON.parse(atob(challengeCode))
    return { peerId: parsed.fromDid, peerName: parsed.fromName }
  }

  override async confirmAndRespond(challengeCode: string): Promise<void> {
    const did = this.identity.getDid()
    const displayName = getPersonalDoc()?.profile?.name ?? getDefaultDisplayName(did)

    // Create response (contains both parties' info)
    const responseCode = await VerificationHelper.respondToChallenge(challengeCode, this.identity, displayName)

    // Parse to get the peer's info
    const parsed = JSON.parse(atob(challengeCode))
    const peerDid = parsed.fromDid
    const nonce = parsed.nonce

    // Create our verification of the peer (from=us, to=peer)
    const verification = await VerificationHelper.createVerificationFor(this.identity, peerDid, nonce)

    // Store in PersonalDoc
    changePersonalDoc((doc) => {
      if (!doc.verifications) doc.verifications = {} as any
      doc.verifications[verification.id] = {
        id: verification.id,
        fromDid: verification.from,
        toDid: verification.to,
        timestamp: verification.timestamp,
        proofJson: JSON.stringify(verification.proof),
        locationJson: null,
      } as any

      // Activate the contact
      if (doc.contacts?.[peerDid]) {
        doc.contacts[peerDid].status = "active"
        doc.contacts[peerDid].updatedAt = new Date().toISOString()
      }
    })
  }

  override async counterVerify(targetId: string): Promise<void> {
    const nonce = crypto.randomUUID()
    const verification = await VerificationHelper.createVerificationFor(this.identity, targetId, nonce)

    changePersonalDoc((doc) => {
      if (!doc.verifications) doc.verifications = {} as any
      doc.verifications[verification.id] = {
        id: verification.id,
        fromDid: verification.from,
        toDid: verification.to,
        timestamp: verification.timestamp,
        proofJson: JSON.stringify(verification.proof),
        locationJson: null,
      } as any
    })
  }

  override async getClaimsByMe(): Promise<SignedClaim[]> {
    return this.claimsObs.current.filter((c) => c.from === this.identity.getDid())
  }

  override async getClaimsAboutMe(): Promise<SignedClaim[]> {
    return this.claimsObs.current.filter((c) => c.to === this.identity.getDid())
  }

  override observeClaims(): Observable<SignedClaim[]> {
    return this.claimsObs
  }

  override getVerificationStatus(contactId: string): VerificationDirection {
    const did = this.identity.getDid()
    const claims = this.claimsObs.current.filter(
      (c) => c.tags?.includes("verification")
    )
    const outgoing = claims.some((c) => c.from === did && c.to === contactId)
    const incoming = claims.some((c) => c.from === contactId && c.to === did)
    if (outgoing && incoming) return "mutual"
    if (outgoing) return "outgoing"
    if (incoming) return "incoming"
    return "none"
  }

  override async setAccepted(id: string, accepted: boolean): Promise<void> {
    changePersonalDoc((doc) => {
      if (doc.attestationMetadata?.[id]) {
        doc.attestationMetadata[id].accepted = accepted
        doc.attestationMetadata[id].acceptedAt = accepted ? new Date().toISOString() : null
      }
    })
  }

  override observeDeliveryStatuses(): Observable<Map<string, ClaimDeliveryStatus>> {
    return this.deliveryStatusObs
  }

  override async retryClaim(_id: string): Promise<void> {
    // TODO: Re-queue in outbox for delivery
  }

  // ==================== Internal: Claims sync ====================

  private syncClaimsFromPersonalDoc(): void {
    try {
      const doc = getPersonalDoc()
      const claims: SignedClaim[] = []

      // Map verifications → SignedClaim with tag "verification"
      const verifications = doc.verifications ?? {}
      for (const [, v] of Object.entries(verifications)) {
        const vDoc = v as unknown as VerificationDoc
        if (!vDoc.id) continue
        claims.push({
          id: vDoc.id,
          from: vDoc.fromDid,
          to: vDoc.toDid,
          claim: "physical-meeting",
          tags: ["verification"],
          createdAt: vDoc.timestamp,
          isAccepted: true,
        })
      }

      // Map attestations → SignedClaim
      const attestations = doc.attestations ?? {}
      const metadata = doc.attestationMetadata ?? {}
      for (const [, a] of Object.entries(attestations)) {
        const aDoc = a as unknown as AttestationDoc
        if (!aDoc.id) continue
        const meta = metadata[aDoc.id] as unknown as AttestationMetadataDoc | undefined
        const tags = aDoc.tagsJson ? JSON.parse(aDoc.tagsJson) : undefined
        claims.push({
          id: aDoc.id,
          from: aDoc.fromDid,
          to: aDoc.toDid,
          claim: aDoc.claim,
          tags,
          createdAt: aDoc.createdAt,
          isAccepted: meta?.accepted ?? false,
        })
      }

      this.claimsObs.set(claims)

      // Sync delivery statuses
      const statuses = new Map<string, ClaimDeliveryStatus>()
      for (const [id, m] of Object.entries(metadata)) {
        const mDoc = m as unknown as AttestationMetadataDoc
        if (mDoc.deliveryStatus) {
          statuses.set(id, mDoc.deliveryStatus as ClaimDeliveryStatus)
        }
      }
      this.deliveryStatusObs.set(statuses)
    } catch {
      // PersonalDoc not ready yet
    }
  }

  // ==================== Internal: Contacts sync ====================

  private syncContactsFromPersonalDoc(): void {
    try {
      const doc = getPersonalDoc()
      const contacts = doc.contacts ?? {}
      const unresolvedDids: string[] = []
      const mapped: ContactInfo[] = Object.entries(contacts).map(([did, c]: [string, any]) => {
        if (!c.name) unresolvedDids.push(did)
        return {
          id: did,
          publicKey: c.publicKey || undefined,
          name: c.name || undefined,
          avatar: c.avatar || undefined,
          bio: c.bio || undefined,
          status: c.status ?? "pending",
          verifiedAt: c.verifiedAt || undefined,
          createdAt: c.createdAt ?? new Date().toISOString(),
          updatedAt: c.updatedAt ?? new Date().toISOString(),
        }
      })
      this.contactsObs.set(mapped)

      // Background: resolve names for contacts without one
      if (unresolvedDids.length > 0) {
        this.resolveContactNames(unresolvedDids)
      }
    } catch {
      // PersonalDoc not ready yet
    }
  }

  /** Resolve display names for contacts via Discovery and persist in PersonalDoc */
  private async resolveContactNames(dids: string[]): Promise<void> {
    for (const did of dids) {
      try {
        const result = await this.discovery.resolveProfile(did)
        if (result.profile?.name) {
          changePersonalDoc((doc) => {
            if (doc.contacts?.[did]) {
              doc.contacts[did].name = result.profile!.name
              if (result.profile!.avatar) doc.contacts[did].avatar = result.profile!.avatar
              if (result.profile!.bio) doc.contacts[did].bio = result.profile!.bio
              doc.contacts[did].updatedAt = new Date().toISOString()
            }
          })
        }
      } catch {
        // Discovery unavailable — will retry on next sync
      }
    }
  }

  // ==================== Internal: Cleanup ====================

  private async cleanupOldIdentity(): Promise<void> {
    // Delete old IndexedDB databases to prevent data leaks between identities
    const dbNames = ["automerge-personal", "automerge-repo"]
    for (const name of dbNames) {
      try {
        await new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase(name)
          req.onsuccess = () => resolve()
          req.onerror = () => resolve()
          req.onblocked = () => resolve()
        })
      } catch { /* best effort */ }
    }
  }
}

// ==================== Helpers ====================

function safeLocalStorage(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/")
  const pad = base64.length % 4
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
