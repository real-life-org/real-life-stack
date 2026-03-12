import type {
  FullConnector,
  Item,
  ItemFilter,
  Group,
  User,
  Observable,
  Unsubscribe,
  AuthState,
  AuthMethod,
  RelatedItemsOptions,
  Source,
  ContactInfo,
  RelayState,
  SignedClaim,
  ClaimDeliveryStatus,
  VerificationDirection,
  PublicProfileData,
  IncomingEvent,
} from "./index.js"

// --- Shared Helpers for Connector implementations ---

export type ReactiveObservable<T> = Observable<T> & { set(value: T): void; destroy(): void }

export function createObservable<T>(initial: T): ReactiveObservable<T> {
  let current = initial
  const subscribers = new Set<(value: T) => void>()

  return {
    get current() {
      return current
    },
    subscribe(callback: (value: T) => void): Unsubscribe {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
    set(value: T) {
      current = value
      subscribers.forEach((cb) => cb(value))
    },
    destroy() {
      subscribers.clear()
    },
  }
}

export function matchesFilter(item: Item, filter: ItemFilter): boolean {
  if (filter.type && item.type !== filter.type) return false
  if (filter.createdBy && item.createdBy !== filter.createdBy) return false
  if (filter.hasField) {
    for (const field of filter.hasField) {
      if (!(field in item.data)) return false
    }
  }
  return true
}

const DEFAULT_GROUP: Group = { id: "default", name: "Default" }

/**
 * Abstrakte Basisklasse fuer Connectoren.
 *
 * Implementiert alle optionalen Methoden mit sinnvollen Defaults.
 * Ein einfacher Connector muss nur die abstrakten Methoden implementieren:
 * - getItems, getItem, createItem, updateItem, deleteItem
 *
 * Alles andere (Groups, Auth, Sources, Observables) hat Default-Verhalten.
 */
export abstract class BaseConnector implements FullConnector {
  // --- Lifecycle (override bei Bedarf) ---

  async init(): Promise<void> {}
  async dispose(): Promise<void> {}

  // --- Items (MUSS implementiert werden) ---

  abstract getItems(filter?: ItemFilter): Promise<Item[]>
  abstract getItem(id: string): Promise<Item | null>
  abstract createItem(item: Omit<Item, "id" | "createdAt">): Promise<Item>
  abstract updateItem(id: string, updates: Partial<Item>): Promise<Item>
  abstract deleteItem(id: string): Promise<void>

  // --- Observables (Default: kein Live-Update) ---

  observe(filter: ItemFilter): Observable<Item[]> {
    const observable = createObservable<Item[]>([])
    this.getItems(filter).then((items) => observable.set(items))
    return observable
  }

  observeItem(id: string): Observable<Item | null> {
    const observable = createObservable<Item | null>(null)
    this.getItem(id).then((item) => observable.set(item))
    return observable
  }

  // --- Relations (Default: Relations aus Item auflösen) ---

  async getRelatedItems(
    itemId: string,
    predicate?: string,
    _options?: RelatedItemsOptions
  ): Promise<Item[]> {
    const item = await this.getItem(itemId)
    if (!item?.relations) return []

    const matching = predicate
      ? item.relations.filter((r) => r.predicate === predicate)
      : item.relations

    const targetIds = matching
      .map((r) => r.target.replace(/^(item:|global:)/, ""))
      .filter((t) => !t.startsWith("space:"))

    const items = await this.getItems()
    return items.filter((i) => targetIds.includes(i.id))
  }

  // --- Groups (Default: eine Default-Gruppe) ---

  protected groupsObservable: ReactiveObservable<Group[]> = createObservable<Group[]>([DEFAULT_GROUP])

  async getGroups(): Promise<Group[]> {
    return this.groupsObservable.current
  }

  observeGroups(): Observable<Group[]> {
    return this.groupsObservable
  }

  getCurrentGroup(): Group | null {
    return DEFAULT_GROUP
  }

  setCurrentGroup(_id: string): void {}

  async createGroup(_name: string, _data?: Record<string, unknown>): Promise<Group> {
    throw new Error("createGroup not supported")
  }

  async updateGroup(_id: string, _updates: Partial<Group>): Promise<Group> {
    throw new Error("updateGroup not supported")
  }

  async deleteGroup(_id: string): Promise<void> {
    throw new Error("deleteGroup not supported")
  }

  async getMembers(_groupId: string): Promise<User[]> {
    return []
  }

  async inviteMember(_groupId: string, _userId: string): Promise<void> {
    throw new Error("inviteMember not supported")
  }

  async removeMember(_groupId: string, _userId: string): Promise<void> {
    throw new Error("removeMember not supported")
  }

  // --- Users (Default: kein User) ---

  async getCurrentUser(): Promise<User | null> {
    return null
  }

  async getUser(_id: string): Promise<User | null> {
    return null
  }

  // --- Auth (Default: unauthenticated) ---

  getAuthState(): Observable<AuthState> {
    return createObservable<AuthState>({ status: "unauthenticated" })
  }

  getAuthMethods(): AuthMethod[] {
    return []
  }

  async authenticate(_method: string, _credentials: unknown): Promise<User> {
    throw new Error("authenticate not supported")
  }

  async logout(): Promise<void> {}

  // --- Sources (Default: single source) ---

  getSources(): Source[] {
    return [{ id: "default", name: "Default", connector: this }]
  }

  getActiveSource(): Source {
    return { id: "default", name: "Default", connector: this }
  }

  setActiveSource(_sourceId: string): void {}

  // --- Contacts (Default: not supported) ---

  async getContacts(): Promise<ContactInfo[]> {
    return []
  }

  observeContacts(): Observable<ContactInfo[]> {
    return createObservable<ContactInfo[]>([])
  }

  async addContact(_id: string, _name?: string): Promise<ContactInfo> {
    throw new Error("addContact not supported")
  }

  async activateContact(_id: string): Promise<void> {
    throw new Error("activateContact not supported")
  }

  async updateContactName(_id: string, _name: string): Promise<void> {
    throw new Error("updateContactName not supported")
  }

  async removeContact(_id: string): Promise<void> {
    throw new Error("removeContact not supported")
  }

  // --- Messaging (Default: disconnected) ---

  getRelayState(): Observable<RelayState> {
    return createObservable<RelayState>("disconnected")
  }

  getOutboxPendingCount(): Observable<number> {
    return createObservable<number>(0)
  }

  // --- Signed Claims (Default: not supported) ---

  async createClaim(_toId: string, _claim: string, _tags?: string[]): Promise<SignedClaim> {
    throw new Error("createClaim not supported")
  }

  async createChallenge(): Promise<{ code: string; nonce: string }> {
    throw new Error("createChallenge not supported")
  }

  async prepareResponse(_challengeCode: string): Promise<{ peerId: string; peerName?: string }> {
    throw new Error("prepareResponse not supported")
  }

  async confirmAndRespond(_challengeCode: string): Promise<void> {
    throw new Error("confirmAndRespond not supported")
  }

  async counterVerify(_targetId: string): Promise<void> {
    throw new Error("counterVerify not supported")
  }

  async getClaimsByMe(): Promise<SignedClaim[]> {
    return []
  }

  async getClaimsAboutMe(): Promise<SignedClaim[]> {
    return []
  }

  observeClaims(): Observable<SignedClaim[]> {
    return createObservable<SignedClaim[]>([])
  }

  getVerificationStatus(_contactId: string): VerificationDirection {
    return "none"
  }

  async setAccepted(_id: string, _accepted: boolean): Promise<void> {
    throw new Error("setAccepted not supported")
  }

  observeDeliveryStatuses(): Observable<Map<string, ClaimDeliveryStatus>> {
    return createObservable<Map<string, ClaimDeliveryStatus>>(new Map())
  }

  async retryClaim(_id: string): Promise<void> {
    throw new Error("retryClaim not supported")
  }

  // --- Profile (Default: not supported) ---

  async getMyProfile(): Promise<Item | null> {
    return null
  }

  observeMyProfile(): Observable<Item | null> {
    return createObservable<Item | null>(null)
  }

  async updateMyProfile(_updates: Partial<Record<string, unknown>>): Promise<Item> {
    throw new Error("updateMyProfile not supported")
  }

  async setFieldVisibility(_field: string, _isPublic: boolean): Promise<void> {
    throw new Error("setFieldVisibility not supported")
  }

  async getPublicProfile(_id: string): Promise<PublicProfileData | null> {
    return null
  }

  async syncProfile(): Promise<void> {}

  isSyncPending(): Observable<boolean> {
    return createObservable<boolean>(false)
  }

  // --- Event Listener (Default: no-op) ---

  onIncomingEvent(_callback: (event: IncomingEvent) => void): () => void {
    return () => {}
  }
}
