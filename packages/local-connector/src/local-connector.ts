import type {
  FullConnector,
  Item,
  ItemFilter,
  ItemObserveOptions,
  Group,
  User,
  Observable,
  AuthState,
  AuthMethod,
  RelatedItemsOptions,
  Source,
} from "@real-life-stack/data-interface"
import { createObservable, matchesFilter, findRelatedItems, resolveIncludes } from "@real-life-stack/data-interface"
import { get, set, del, createStore } from "idb-keyval"

// --- Types ---

interface StoredState {
  items: SerializedItem[]
  groups: Group[]
  users: User[]
  groupMembers: Record<string, string[]>
  groupItems: Record<string, string[]>
  currentUserId: string | null
  currentGroupId: string | null
  nextItemId: number
}

interface SerializedItem extends Omit<Item, "createdAt"> {
  createdAt: string
}

interface BroadcastMessage {
  type: "items-changed" | "groups-changed" | "full-sync"
  senderId: string
}

// --- Serialization helpers ---

function serializeItem(item: Item): SerializedItem {
  return { ...item, createdAt: item.createdAt.toISOString() }
}

function deserializeItem(item: SerializedItem): Item {
  return { ...item, createdAt: new Date(item.createdAt) }
}

// --- LocalConnector ---

export class LocalConnector implements FullConnector {
  private items: Item[] = []
  private groups: Group[] = []
  private users: User[] = []
  private groupMembers: Record<string, string[]> = {}
  private groupItems: Record<string, string[]> = {}
  private currentGroup: Group | null = null
  private currentUser: User | null = null
  private nextItemId = 100

  private authState = createObservable<AuthState>({ status: "loading" })
  private groupsObs = createObservable<Group[]>([])
  private currentGroupObs = createObservable<Group | null>(null)
  private itemObservables = new Map<string, ReturnType<typeof createObservable<Item[]>>>()
  private singleItemObservables = new Map<string, ReturnType<typeof createObservable<Item | null>>>()
  private singleItemOptions = new Map<string, ItemObserveOptions>()

  private channel: BroadcastChannel | null = null
  private readonly instanceId = crypto.randomUUID()
  private store = createStore("rls-local-connector", "state")
  private seedData: StoredState | null

  constructor(seed?: {
    items: Item[]
    groups: Group[]
    users: User[]
    groupMembers: Record<string, string[]>
    groupItems?: Record<string, string[]>
  }) {
    this.seedData = seed
      ? {
          items: seed.items.map(serializeItem),
          groups: seed.groups,
          users: seed.users,
          groupMembers: seed.groupMembers,
          groupItems: seed.groupItems ?? {},
          currentUserId: seed.users[0]?.id ?? null,
          currentGroupId: seed.groups[0]?.id ?? null,
          nextItemId: 100,
        }
      : null
  }

  async init(): Promise<void> {
    // Load from IndexedDB or seed
    const stored = await get<StoredState>("state", this.store)

    if (stored) {
      this.items = stored.items.map(deserializeItem)
      this.groups = stored.groups
      this.users = stored.users
      this.groupMembers = stored.groupMembers
      this.groupItems = stored.groupItems ?? {}
      this.nextItemId = stored.nextItemId
      this.currentUser = stored.currentUserId
        ? this.users.find((u) => u.id === stored.currentUserId) ?? null
        : null
      this.currentGroup = stored.currentGroupId
        ? this.groups.find((g) => g.id === stored.currentGroupId) ?? null
        : null
    } else if (this.seedData) {
      this.items = this.seedData.items.map(deserializeItem)
      this.groups = [...this.seedData.groups]
      this.users = [...this.seedData.users]
      this.groupMembers = { ...this.seedData.groupMembers }
      this.groupItems = { ...this.seedData.groupItems }
      this.nextItemId = this.seedData.nextItemId
      this.currentUser = this.seedData.currentUserId
        ? this.users.find((u) => u.id === this.seedData!.currentUserId) ?? null
        : null
      this.currentGroup = this.seedData.currentGroupId
        ? this.groups.find((g) => g.id === this.seedData!.currentGroupId) ?? null
        : null
      await this.persist()
    }

    this.authState.set(
      this.currentUser
        ? { status: "authenticated", user: this.currentUser }
        : { status: "unauthenticated" }
    )
    this.groupsObs.set([...this.groups])
    this.currentGroupObs.set(this.currentGroup)

    // Set up cross-tab sync
    this.channel = new BroadcastChannel("rls-local-connector")
    this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      if (event.data.senderId === this.instanceId) return
      this.handleBroadcast(event.data)
    }
  }

  async dispose(): Promise<void> {
    this.channel?.close()
    this.channel = null
    this.itemObservables.clear()
    this.singleItemObservables.clear()
  }

  // --- Groups ---

  async getGroups(): Promise<Group[]> {
    return this.groups
  }

  observeGroups(): Observable<Group[]> {
    return this.groupsObs
  }

  getCurrentGroup(): Group | null {
    return this.currentGroup
  }

  observeCurrentGroup(): Observable<Group | null> {
    return this.currentGroupObs
  }

  setCurrentGroup(id: string): void {
    if (this.currentGroup?.id === id) return
    const group = this.groups.find((g) => g.id === id)
    if (group) {
      this.currentGroup = group
      this.currentGroupObs.set(group)
      this.notifyObservers()
    }
  }

  async createGroup(name: string, data?: Record<string, unknown>): Promise<Group> {
    const group: Group = { id: `group-${Date.now()}`, name, data }
    this.groups.push(group)
    this.groupMembers[group.id] = this.currentUser ? [this.currentUser.id] : []
    this.notifyGroupObservers()
    await this.persist()
    this.broadcast({ type: "groups-changed" })
    return group
  }

  async updateGroup(id: string, updates: Partial<Group>): Promise<Group> {
    const group = this.groups.find((g) => g.id === id)
    if (!group) throw new Error(`Group not found: ${id}`)
    Object.assign(group, updates)
    this.notifyGroupObservers()
    await this.persist()
    this.broadcast({ type: "groups-changed" })
    return group
  }

  async deleteGroup(id: string): Promise<void> {
    this.groups = this.groups.filter((g) => g.id !== id)
    delete this.groupMembers[id]
    if (this.currentGroup?.id === id) {
      this.currentGroup = this.groups[0] ?? null
      this.currentGroupObs.set(this.currentGroup)
    }
    this.notifyGroupObservers()
    await this.persist()
    this.broadcast({ type: "groups-changed" })
  }

  async getMembers(groupId: string): Promise<User[]> {
    const memberIds = this.groupMembers[groupId] ?? []
    return this.users.filter((u) => memberIds.includes(u.id))
  }

  async inviteMember(groupId: string, userId: string): Promise<void> {
    if (!this.groupMembers[groupId]) this.groupMembers[groupId] = []
    if (!this.groupMembers[groupId].includes(userId)) {
      this.groupMembers[groupId].push(userId)
    }
    await this.persist()
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    if (this.groupMembers[groupId]) {
      this.groupMembers[groupId] = this.groupMembers[groupId].filter((id) => id !== userId)
    }
    await this.persist()
  }

  // --- Items ---

  private getScopedItems(): Item[] {
    const groupId = this.currentGroup?.id
    const scope = (this.currentGroup?.data?.scope as string) ?? "group"

    if (!groupId || scope === "aggregate") {
      return this.items
    }

    const itemIds = this.groupItems[groupId]
    if (!itemIds) return this.items.filter((i) => i.type === "feature")
    return this.items.filter((i) => itemIds.includes(i.id) || i.type === "feature")
  }

  async getItems(filter?: ItemFilter): Promise<Item[]> {
    const scoped = this.getScopedItems()
    if (!filter) return scoped
    let filtered = scoped.filter((item) => matchesFilter(item, filter))
    if (filter.include?.length) {
      filtered = resolveIncludes(filtered, scoped, filter.include)
    }
    return filtered
  }

  async getItem(id: string): Promise<Item | null> {
    return this.items.find((item) => item.id === id) ?? null
  }

  observe(filter: ItemFilter): Observable<Item[]> {
    const key = JSON.stringify(filter)
    if (!this.itemObservables.has(key)) {
      const scoped = this.getScopedItems()
      let filtered = scoped.filter((item) => matchesFilter(item, filter))
      if (filter.include?.length) {
        filtered = resolveIncludes(filtered, scoped, filter.include)
      }
      this.itemObservables.set(key, createObservable(filtered))
    }
    return this.itemObservables.get(key)!
  }

  observeItem(id: string, options?: ItemObserveOptions): Observable<Item | null> {
    const key = options?.include ? id + JSON.stringify(options) : id
    if (!this.singleItemObservables.has(key)) {
      let item = this.items.find((i) => i.id === id) ?? null
      if (item && options?.include?.length) {
        [item] = resolveIncludes([item], this.items, options.include)
      }
      this.singleItemObservables.set(key, createObservable(item))
      if (options) this.singleItemOptions.set(key, options)
    }
    return this.singleItemObservables.get(key)!
  }

  async createItem(item: Omit<Item, "id" | "createdAt">): Promise<Item> {
    const newItem: Item = {
      ...item,
      id: `item-${this.nextItemId++}`,
      createdAt: new Date(),
    }
    this.items.push(newItem)
    const groupId = this.currentGroup?.id
    if (groupId) {
      if (!this.groupItems[groupId]) this.groupItems[groupId] = []
      this.groupItems[groupId].push(newItem.id)
    }
    this.notifyObservers()
    await this.persist()
    this.broadcast({ type: "items-changed" })
    return newItem
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<Item> {
    const idx = this.items.findIndex((i) => i.id === id)
    if (idx === -1) throw new Error(`Item not found: ${id}`)
    this.items[idx] = { ...this.items[idx], ...updates, id }
    this.notifyObservers()
    await this.persist()
    this.broadcast({ type: "items-changed" })
    return this.items[idx]
  }

  async deleteItem(id: string): Promise<void> {
    this.items = this.items.filter((i) => i.id !== id)
    this.notifyObservers()
    await this.persist()
    this.broadcast({ type: "items-changed" })
  }

  getItemGroupId(itemId: string): string | null {
    for (const [gid, itemIds] of Object.entries(this.groupItems)) {
      if (itemIds.includes(itemId)) return gid
    }
    return null
  }

  async moveItemToGroup(itemId: string, targetGroupId: string): Promise<void> {
    // Remove from all groups
    for (const gid of Object.keys(this.groupItems)) {
      this.groupItems[gid] = this.groupItems[gid].filter((id) => id !== itemId)
    }
    // Add to target group
    if (!this.groupItems[targetGroupId]) this.groupItems[targetGroupId] = []
    this.groupItems[targetGroupId].push(itemId)
    this.notifyObservers()
    await this.persist()
    this.broadcast({ type: "items-changed" })
  }

  // --- Relations ---

  async getRelatedItems(
    itemId: string,
    predicate?: string,
    options?: RelatedItemsOptions
  ): Promise<Item[]> {
    return findRelatedItems(itemId, this.items, predicate, options)
  }

  // --- Users ---

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser
  }

  async getUser(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null
  }

  // --- Auth ---

  getAuthState(): Observable<AuthState> {
    return this.authState
  }

  getAuthMethods(): AuthMethod[] {
    return [{ method: "local", label: "Local Login" }]
  }

  async authenticate(_method: string, _credentials: unknown): Promise<User> {
    const user = this.users[0]
    this.currentUser = user
    this.authState.set({ status: "authenticated", user })
    await this.persist()
    return user
  }

  async logout(): Promise<void> {
    this.currentUser = null
    this.authState.set({ status: "unauthenticated" })
    await this.persist()
  }

  // --- Sources ---

  getSources(): Source[] {
    return [{ id: "local", name: "Local (IndexedDB)", connector: this }]
  }

  getActiveSource(): Source {
    return { id: "local", name: "Local (IndexedDB)", connector: this }
  }

  setActiveSource(_sourceId: string): void {
    // Only one source
  }

  // --- Clear all data (useful for testing) ---

  async clear(): Promise<void> {
    await del("state", this.store)
    this.items = []
    this.groups = []
    this.users = []
    this.groupMembers = {}
    this.groupItems = {}
    this.currentUser = null
    this.currentGroup = null
    this.nextItemId = 100
    this.notifyObservers()
    this.notifyGroupObservers()
    this.broadcast({ type: "full-sync" })
  }

  // --- Internal: Persistence ---

  private async persist(): Promise<void> {
    const state: StoredState = {
      items: this.items.map(serializeItem),
      groups: this.groups,
      users: this.users,
      groupMembers: this.groupMembers,
      groupItems: this.groupItems,
      currentUserId: this.currentUser?.id ?? null,
      currentGroupId: this.currentGroup?.id ?? null,
      nextItemId: this.nextItemId,
    }
    await set("state", state, this.store)
  }

  // --- Internal: Cross-Tab Sync ---

  private broadcast(msg: Omit<BroadcastMessage, "senderId">): void {
    this.channel?.postMessage({ ...msg, senderId: this.instanceId })
  }

  private async handleBroadcast(msg: BroadcastMessage): Promise<void> {
    // Reload from IndexedDB when another tab changes data
    const stored = await get<StoredState>("state", this.store)
    if (!stored) return

    if (msg.type === "items-changed" || msg.type === "full-sync") {
      this.items = stored.items.map(deserializeItem)
      this.nextItemId = stored.nextItemId
      this.notifyObservers()
    }

    if (msg.type === "groups-changed" || msg.type === "full-sync") {
      this.groups = stored.groups
      this.users = stored.users
      this.groupMembers = stored.groupMembers
      this.notifyGroupObservers()
    }
  }

  // --- Internal: Observable Notification ---

  private notifyGroupObservers(): void {
    this.groupsObs.set([...this.groups])
  }

  private notifyObservers(): void {
    const scoped = this.getScopedItems()
    for (const [key, observable] of this.itemObservables) {
      const filter: ItemFilter = JSON.parse(key)
      let filtered = scoped.filter((item) => matchesFilter(item, filter))
      if (filter.include?.length) {
        filtered = resolveIncludes(filtered, scoped, filter.include)
      }
      observable.set(filtered)
    }
    for (const [key, observable] of this.singleItemObservables) {
      const opts = this.singleItemOptions.get(key)
      // Extract the item ID (key may contain appended JSON options)
      const id = opts ? key.slice(0, key.indexOf("{")) : key
      let item = this.items.find((i) => i.id === id) ?? null
      if (item && opts?.include?.length) {
        [item] = resolveIncludes([item], scoped, opts.include)
      }
      observable.set(item)
    }
  }
}
