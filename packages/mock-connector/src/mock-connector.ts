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
import { demoItems, demoGroups, demoUsers, demoGroupMembers, demoGroupItems } from "@real-life-stack/data-interface/demo-data"

export class MockConnector implements FullConnector {
  private items: Item[]
  private groups: Group[]
  private users: User[]
  private groupMembers: Record<string, string[]>
  private groupItems: Record<string, string[]>
  private currentGroup: Group | null
  private currentUser: User | null
  private authState: ReturnType<typeof createObservable<AuthState>>
  private groupsObs: ReturnType<typeof createObservable<Group[]>>
  private currentGroupObs: ReturnType<typeof createObservable<Group | null>>
  private singleItemOptions = new Map<string, ItemObserveOptions>()
  private itemObservables = new Map<string, ReturnType<typeof createObservable<Item[]>>>()
  private singleItemObservables = new Map<string, ReturnType<typeof createObservable<Item | null>>>()
  private nextItemId = 100

  constructor() {
    this.items = [...demoItems]
    this.groups = [...demoGroups]
    this.users = [...demoUsers]
    this.groupMembers = { ...demoGroupMembers }
    this.groupItems = { ...demoGroupItems }
    this.currentGroup = this.groups[0] ?? null
    this.currentUser = this.users[0] ?? null
    this.authState = createObservable<AuthState>(
      this.currentUser
        ? { status: "authenticated", user: this.currentUser }
        : { status: "unauthenticated" }
    )
    this.groupsObs = createObservable<Group[]>([...this.groups])
    this.currentGroupObs = createObservable<Group | null>(this.currentGroup)
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
    return group
  }

  async updateGroup(id: string, updates: Partial<Group>): Promise<Group> {
    const group = this.groups.find((g) => g.id === id)
    if (!group) throw new Error(`Group not found: ${id}`)
    Object.assign(group, updates)
    this.notifyGroupObservers()
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
  }

  async getMembers(groupId: string): Promise<User[]> {
    const memberIds = this.groupMembers[groupId] ?? []
    return this.users.filter((u) => memberIds.includes(u.id))
  }

  private memberObservables = new Map<string, ReturnType<typeof createObservable<User[]>>>()

  observeMembers(groupId: string): Observable<User[]> {
    if (!this.memberObservables.has(groupId)) {
      const memberIds = this.groupMembers[groupId] ?? []
      const members = this.users.filter((u) => memberIds.includes(u.id))
      this.memberObservables.set(groupId, createObservable(members))
    }
    return this.memberObservables.get(groupId)!
  }

  private notifyMemberObservers(groupId: string): void {
    const obs = this.memberObservables.get(groupId)
    if (obs) {
      const memberIds = this.groupMembers[groupId] ?? []
      obs.set(this.users.filter((u) => memberIds.includes(u.id)))
    }
  }

  async inviteMember(groupId: string, userId: string): Promise<void> {
    if (!this.groupMembers[groupId]) this.groupMembers[groupId] = []
    if (!this.groupMembers[groupId].includes(userId)) {
      this.groupMembers[groupId].push(userId)
    }
    this.notifyMemberObservers(groupId)
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    if (this.groupMembers[groupId]) {
      this.groupMembers[groupId] = this.groupMembers[groupId].filter((id) => id !== userId)
    }
    this.notifyMemberObservers(groupId)
  }

  // --- Items ---

  private getScopedItems(): Item[] {
    const groupId = this.currentGroup?.id
    const scope = (this.currentGroup?.data?.scope as string) ?? "group"

    if (!groupId || scope === "aggregate") {
      // "Alles" scope: return all items (except feature items which are always global)
      return this.items
    }

    // For specific scopes (personal, friends, group-*): filter by groupItems mapping
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

    // Register item in current group's scope
    const groupId = this.currentGroup?.id
    if (groupId && groupId !== "all") {
      if (!this.groupItems[groupId]) this.groupItems[groupId] = []
      this.groupItems[groupId].push(newItem.id)
    }

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

  getItemGroupId(itemId: string): string | null {
    for (const [gid, itemIds] of Object.entries(this.groupItems)) {
      if (itemIds.includes(itemId)) return gid
    }
    return null
  }

  moveItemToGroup(itemId: string, targetGroupId: string): void {
    // Remove from all groups
    for (const gid of Object.keys(this.groupItems)) {
      this.groupItems[gid] = this.groupItems[gid].filter((id) => id !== itemId)
    }
    // Add to target group
    if (!this.groupItems[targetGroupId]) this.groupItems[targetGroupId] = []
    this.groupItems[targetGroupId].push(itemId)
    this.notifyObservers()
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
      const id = opts ? key.slice(0, key.indexOf("{")) : key
      let item = this.items.find((i) => i.id === id) ?? null
      if (item && opts?.include?.length) {
        [item] = resolveIncludes([item], scoped, opts.include)
      }
      observable.set(item)
    }
  }
}
