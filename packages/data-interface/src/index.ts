// @real-life-stack/data-interface
// Zentrale Typdefinitionen für das DataInterface (Connector-Schnittstelle)

export { BaseConnector } from "./base-connector.js"

// --- Core Types ---

export interface Item {
  id: string
  type: string
  createdAt: Date
  createdBy: string

  schema?: string
  schemaVersion?: number

  data: Record<string, unknown>
  relations?: Relation[]

  _source?: string
  _included?: Record<string, Item[]>
}

export interface Relation {
  predicate: string
  target: string
  meta?: Record<string, unknown>
}

export interface Group {
  id: string
  name: string
  data?: Record<string, unknown>
}

export interface User {
  id: string
  displayName?: string
  avatarUrl?: string
}

// --- Observable ---

export interface Observable<T> {
  current: T
  subscribe(callback: (value: T) => void): Unsubscribe
}

export type Unsubscribe = () => void

// --- Auth ---

export type AuthState =
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated" }
  | { status: "loading" }

export interface AuthMethod {
  method: string
  label: string
}

// --- Filter & Query ---

export interface ItemFilter {
  type?: string
  hasField?: string[]
  createdBy?: string
  source?: string
  include?: IncludeDirective[]
}

export interface IncludeDirective {
  predicate: string
  as: string
  limit?: number
}

export interface RelatedItemsOptions {
  direction?: "from" | "to" | "both"
  depth?: number
}

// --- Source (Multi-Source) ---

export interface Source {
  id: string
  name: string
  connector: DataInterface
}

// --- DataInterface ---

export interface DataInterface {
  // Lifecycle
  init(): Promise<void>
  dispose(): Promise<void>

  // Gruppen — lesen & wechseln
  getGroups(): Promise<Group[]>
  getCurrentGroup(): Group | null
  setCurrentGroup(id: string): void

  // Gruppen — verwalten (Feature-gesteuert)
  createGroup(name: string, data?: Record<string, unknown>): Promise<Group>
  updateGroup(id: string, updates: Partial<Group>): Promise<Group>
  deleteGroup(id: string): Promise<void>
  getMembers(groupId: string): Promise<User[]>
  inviteMember(groupId: string, userId: string): Promise<void>
  removeMember(groupId: string, userId: string): Promise<void>

  // Items — einmalig laden
  getItems(filter?: ItemFilter): Promise<Item[]>
  getItem(id: string): Promise<Item | null>

  // Items — reaktiv beobachten
  observe(filter: ItemFilter): Observable<Item[]>
  observeItem(id: string): Observable<Item | null>

  // Items — schreiben
  createItem(item: Omit<Item, "id" | "createdAt">): Promise<Item>
  updateItem(id: string, updates: Partial<Item>): Promise<Item>
  deleteItem(id: string): Promise<void>

  // Relations
  getRelatedItems(
    itemId: string,
    predicate?: string,
    options?: RelatedItemsOptions
  ): Promise<Item[]>

  // Nutzer
  getCurrentUser(): Promise<User | null>
  getUser(id: string): Promise<User | null>

  // Auth
  getAuthState(): Observable<AuthState>
  getAuthMethods(): AuthMethod[]
  authenticate(method: string, credentials: unknown): Promise<User>
  logout(): Promise<void>

  // Quellen (Multi-Source)
  getSources(): Source[]
  getActiveSource(): Source
  setActiveSource(sourceId: string): void
}
