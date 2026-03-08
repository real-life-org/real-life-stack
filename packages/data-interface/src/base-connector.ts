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
} from "./index.js"

function createStaticObservable<T>(value: T): Observable<T> {
  return {
    get current() {
      return value
    },
    subscribe(_callback: (value: T) => void): Unsubscribe {
      return () => {}
    },
  }
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
export abstract class BaseConnector implements DataInterface {
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
    const observable = createStaticObservable<Item[]>([])
    this.getItems(filter).then((items) => {
      ;(observable as { current: Item[] }).current = items
    })
    return observable
  }

  observeItem(id: string): Observable<Item | null> {
    const observable = createStaticObservable<Item | null>(null)
    this.getItem(id).then((item) => {
      ;(observable as { current: Item | null }).current = item
    })
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

  async getGroups(): Promise<Group[]> {
    return [DEFAULT_GROUP]
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
    return createStaticObservable<AuthState>({ status: "unauthenticated" })
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
}
