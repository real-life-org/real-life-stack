import type {
  DataInterface,
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
} from "@real-life-stack/data-interface"
import { demoItems, demoGroups, demoUsers, demoGroupMembers } from "@real-life-stack/data-interface/demo-data"

type Callback<T> = (value: T) => void

function createObservable<T>(initial: T): Observable<T> & { set(value: T): void } {
  let current = initial
  const subscribers = new Set<Callback<T>>()

  return {
    get current() {
      return current
    },
    subscribe(callback: Callback<T>): Unsubscribe {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
    set(value: T) {
      current = value
      subscribers.forEach((cb) => cb(value))
    },
  }
}

function matchesFilter(item: Item, filter: ItemFilter): boolean {
  if (filter.type && item.type !== filter.type) return false
  if (filter.createdBy && item.createdBy !== filter.createdBy) return false
  if (filter.hasField) {
    for (const field of filter.hasField) {
      if (!(field in item.data)) return false
    }
  }
  return true
}

export class MockConnector implements DataInterface {
  private items: Item[]
  private groups: Group[]
  private users: User[]
  private groupMembers: Record<string, string[]>
  private currentGroup: Group | null
  private currentUser: User | null
  private authState: ReturnType<typeof createObservable<AuthState>>
  private itemObservables = new Map<string, ReturnType<typeof createObservable<Item[]>>>()
  private singleItemObservables = new Map<string, ReturnType<typeof createObservable<Item | null>>>()
  private nextItemId = 100

  constructor() {
    this.items = [...demoItems]
    this.groups = [...demoGroups]
    this.users = [...demoUsers]
    this.groupMembers = { ...demoGroupMembers }
    this.currentGroup = this.groups[0] ?? null
    this.currentUser = this.users[0] ?? null
    this.authState = createObservable<AuthState>(
      this.currentUser
        ? { status: "authenticated", user: this.currentUser }
        : { status: "unauthenticated" }
    )
  }

  async init(): Promise<void> {
    // Mock: nothing to initialize
  }

  async dispose(): Promise<void> {
    this.itemObservables.clear()
    this.singleItemObservables.clear()
  }

  // --- Groups ---

  async getGroups(): Promise<Group[]> {
    return this.groups
  }

  getCurrentGroup(): Group | null {
    return this.currentGroup
  }

  setCurrentGroup(id: string): void {
    const group = this.groups.find((g) => g.id === id)
    if (group) this.currentGroup = group
  }

  async createGroup(name: string, data?: Record<string, unknown>): Promise<Group> {
    const group: Group = { id: `group-${Date.now()}`, name, data }
    this.groups.push(group)
    this.groupMembers[group.id] = this.currentUser ? [this.currentUser.id] : []
    return group
  }

  async updateGroup(id: string, updates: Partial<Group>): Promise<Group> {
    const group = this.groups.find((g) => g.id === id)
    if (!group) throw new Error(`Group not found: ${id}`)
    Object.assign(group, updates)
    return group
  }

  async deleteGroup(id: string): Promise<void> {
    this.groups = this.groups.filter((g) => g.id !== id)
    delete this.groupMembers[id]
    if (this.currentGroup?.id === id) {
      this.currentGroup = this.groups[0] ?? null
    }
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
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    if (this.groupMembers[groupId]) {
      this.groupMembers[groupId] = this.groupMembers[groupId].filter((id) => id !== userId)
    }
  }

  // --- Items ---

  async getItems(filter?: ItemFilter): Promise<Item[]> {
    if (!filter) return this.items
    return this.items.filter((item) => matchesFilter(item, filter))
  }

  async getItem(id: string): Promise<Item | null> {
    return this.items.find((item) => item.id === id) ?? null
  }

  observe(filter: ItemFilter): Observable<Item[]> {
    const key = JSON.stringify(filter)
    if (!this.itemObservables.has(key)) {
      const filtered = this.items.filter((item) => matchesFilter(item, filter))
      this.itemObservables.set(key, createObservable(filtered))
    }
    return this.itemObservables.get(key)!
  }

  observeItem(id: string): Observable<Item | null> {
    if (!this.singleItemObservables.has(id)) {
      const item = this.items.find((i) => i.id === id) ?? null
      this.singleItemObservables.set(id, createObservable(item))
    }
    return this.singleItemObservables.get(id)!
  }

  async createItem(item: Omit<Item, "id" | "createdAt">): Promise<Item> {
    const newItem: Item = {
      ...item,
      id: `item-${this.nextItemId++}`,
      createdAt: new Date(),
    }
    this.items.push(newItem)
    this.notifyObservers()
    return newItem
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<Item> {
    const idx = this.items.findIndex((i) => i.id === id)
    if (idx === -1) throw new Error(`Item not found: ${id}`)
    this.items[idx] = { ...this.items[idx], ...updates, id }
    this.notifyObservers()
    return this.items[idx]
  }

  async deleteItem(id: string): Promise<void> {
    this.items = this.items.filter((i) => i.id !== id)
    this.notifyObservers()
  }

  // --- Relations ---

  async getRelatedItems(
    itemId: string,
    predicate?: string,
    _options?: RelatedItemsOptions
  ): Promise<Item[]> {
    const item = this.items.find((i) => i.id === itemId)
    if (!item?.relations) return []

    const matchingRelations = predicate
      ? item.relations.filter((r) => r.predicate === predicate)
      : item.relations

    const targetIds = matchingRelations
      .map((r) => r.target.replace(/^(item:|global:)/, ""))
      .filter((t) => !t.startsWith("space:"))

    return this.items.filter((i) => targetIds.includes(i.id))
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
    return [{ method: "mock", label: "Mock Login" }]
  }

  async authenticate(_method: string, _credentials: unknown): Promise<User> {
    const user = this.users[0]
    this.currentUser = user
    this.authState.set({ status: "authenticated", user })
    return user
  }

  async logout(): Promise<void> {
    this.currentUser = null
    this.authState.set({ status: "unauthenticated" })
  }

  // --- Sources ---

  getSources(): Source[] {
    return [{ id: "mock", name: "Mock Data", connector: this }]
  }

  getActiveSource(): Source {
    return { id: "mock", name: "Mock Data", connector: this }
  }

  setActiveSource(_sourceId: string): void {
    // Mock: only one source
  }

  // --- Internal ---

  private notifyObservers(): void {
    for (const [key, observable] of this.itemObservables) {
      const filter: ItemFilter = JSON.parse(key)
      const filtered = this.items.filter((item) => matchesFilter(item, filter))
      observable.set(filtered)
    }
    for (const [id, observable] of this.singleItemObservables) {
      const item = this.items.find((i) => i.id === id) ?? null
      observable.set(item)
    }
  }
}
