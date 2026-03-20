import type { SpaceInfo, SpaceHandle } from "@real-life/wot-core"
import type { YjsReplicationAdapter } from "@real-life/adapter-yjs"

// --- Types ---

export interface CrossSpaceEntry<TItem> {
  item: TItem
  spaceId: string
}

export interface CrossSpaceIndexOptions {
  spaceFilter?: (info: SpaceInfo) => boolean
}

// --- CrossSpaceIndex ---

/**
 * Reactive item index across all spaces.
 *
 * Subscribes to watchSpaces(), opens a SpaceHandle per space,
 * listens to onRemoteUpdate(), and maintains a flat + type-based index
 * of all items across spaces.
 */
export class CrossSpaceIndex<TDoc, TItem> {
  private replication: YjsReplicationAdapter
  private extractItems: (doc: TDoc) => Map<string, TItem>
  private getItemType: (item: TItem) => string
  private spaceFilter: ((info: SpaceInfo) => boolean) | undefined

  // Per-space state
  private handles = new Map<string, SpaceHandle<TDoc>>()
  private pendingSpaces = new Set<string>()
  private remoteUnsubs = new Map<string, () => void>()
  private spaceItemMaps = new Map<string, Map<string, TItem>>()

  // Indexes
  private flatIndex = new Map<string, CrossSpaceEntry<TItem>>()
  private typeIndex = new Map<string, Set<string>>()

  // Reactive
  private listeners = new Set<() => void>()
  private spacesUnsub: (() => void) | null = null
  private notifyScheduled = false
  private started = false

  constructor(
    replication: YjsReplicationAdapter,
    extractItems: (doc: TDoc) => Map<string, TItem>,
    getItemType: (item: TItem) => string,
    options?: CrossSpaceIndexOptions,
  ) {
    this.replication = replication
    this.extractItems = extractItems
    this.getItemType = getItemType
    this.spaceFilter = options?.spaceFilter
  }

  // --- Lifecycle ---

  start(): void {
    if (this.started) return
    this.started = true

    const subscribable = this.replication.watchSpaces()
    // Initial index from current spaces
    this.syncSpaces(subscribable.getValue())
    // Subscribe to future changes
    this.spacesUnsub = subscribable.subscribe((spaces) => {
      this.syncSpaces(spaces)
    })
  }

  stop(): void {
    if (!this.started) return
    this.started = false

    this.spacesUnsub?.()
    this.spacesUnsub = null

    for (const unsub of this.remoteUnsubs.values()) {
      unsub()
    }
    for (const handle of this.handles.values()) {
      handle.close()
    }

    this.handles.clear()
    this.pendingSpaces.clear()
    this.remoteUnsubs.clear()
    this.spaceItemMaps.clear()
    this.flatIndex.clear()
    this.typeIndex.clear()
  }

  // --- Queries ---

  getAll(): Map<string, CrossSpaceEntry<TItem>> {
    return this.flatIndex
  }

  getByType(type: string): Array<CrossSpaceEntry<TItem>> {
    const ids = this.typeIndex.get(type)
    if (!ids) return []
    const result: Array<CrossSpaceEntry<TItem>> = []
    for (const id of ids) {
      const entry = this.flatIndex.get(id)
      if (entry) result.push(entry)
    }
    return result
  }

  getBySpace(spaceId: string): Map<string, TItem> {
    return this.spaceItemMaps.get(spaceId) ?? new Map()
  }

  getItemSpaceId(itemId: string): string | null {
    return this.flatIndex.get(itemId)?.spaceId ?? null
  }

  getFiltered(filters: {
    includedSpaces?: string[] | null
    excludedSpaces?: string[]
  }): Map<string, CrossSpaceEntry<TItem>> {
    const { includedSpaces, excludedSpaces } = filters
    // No filtering needed
    if (!includedSpaces && (!excludedSpaces || excludedSpaces.length === 0)) {
      return this.flatIndex
    }

    const included = includedSpaces ? new Set(includedSpaces) : null
    const excluded = excludedSpaces ? new Set(excludedSpaces) : null

    const result = new Map<string, CrossSpaceEntry<TItem>>()
    for (const [id, entry] of this.flatIndex) {
      if (excluded?.has(entry.spaceId)) continue
      if (included && !included.has(entry.spaceId)) continue
      result.set(id, entry)
    }
    return result
  }

  // --- Reactive ---

  onChange(callback: () => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  // --- Manual reindex (for local writes) ---

  reindexSpace(spaceId: string): void {
    const handle = this.handles.get(spaceId)
    if (!handle) return
    this.indexSpace(spaceId, handle)
  }

  // --- Internal ---

  private syncSpaces(spaces: SpaceInfo[]): void {
    const filtered = this.spaceFilter
      ? spaces.filter(this.spaceFilter)
      : spaces

    const currentIds = new Set(filtered.map((s) => s.id))
    const knownIds = new Set([...this.handles.keys(), ...this.pendingSpaces])

    // Remove spaces that are no longer present
    for (const id of knownIds) {
      if (!currentIds.has(id)) {
        this.pendingSpaces.delete(id)
        this.removeSpace(id)
      }
    }

    // Add new spaces
    for (const space of filtered) {
      if (!knownIds.has(space.id)) {
        this.addSpace(space.id)
      }
    }
  }

  private async addSpace(spaceId: string): Promise<void> {
    this.pendingSpaces.add(spaceId)
    try {
      const handle = await this.replication.openSpace<TDoc>(spaceId)
      this.pendingSpaces.delete(spaceId)

      if (!this.started) {
        handle.close()
        return
      }

      this.handles.set(spaceId, handle)

      // Initial index
      this.indexSpace(spaceId, handle)

      // Subscribe to remote updates
      const unsub = handle.onRemoteUpdate(() => {
        this.indexSpace(spaceId, handle)
      })
      this.remoteUnsubs.set(spaceId, unsub)
    } catch {
      this.pendingSpaces.delete(spaceId)
      // Space may have been deleted between watchSpaces emit and openSpace call
    }
  }

  private removeSpace(spaceId: string): void {
    // Unsubscribe
    this.remoteUnsubs.get(spaceId)?.()
    this.remoteUnsubs.delete(spaceId)

    // Close handle
    this.handles.get(spaceId)?.close()
    this.handles.delete(spaceId)

    // Remove items from indexes
    const oldItems = this.spaceItemMaps.get(spaceId)
    if (oldItems) {
      for (const [id, item] of oldItems) {
        this.flatIndex.delete(id)
        const type = this.getItemType(item)
        this.typeIndex.get(type)?.delete(id)
      }
      this.spaceItemMaps.delete(spaceId)
    }

    this.notify()
  }

  private indexSpace(spaceId: string, handle: SpaceHandle<TDoc>): void {
    const newItems = this.extractItems(handle.getDoc())
    const oldItems = this.spaceItemMaps.get(spaceId)

    // Diff: remove deleted items
    if (oldItems) {
      for (const [id, item] of oldItems) {
        if (!newItems.has(id)) {
          this.flatIndex.delete(id)
          const type = this.getItemType(item)
          this.typeIndex.get(type)?.delete(id)
        }
      }
    }

    // Add/update items
    for (const [id, item] of newItems) {
      const type = this.getItemType(item)

      // Update type index (handle type changes)
      const existing = this.flatIndex.get(id)
      if (existing) {
        const oldType = this.getItemType(existing.item)
        if (oldType !== type) {
          this.typeIndex.get(oldType)?.delete(id)
        }
      }

      this.flatIndex.set(id, { item, spaceId })

      let typeSet = this.typeIndex.get(type)
      if (!typeSet) {
        typeSet = new Set()
        this.typeIndex.set(type, typeSet)
      }
      typeSet.add(id)
    }

    this.spaceItemMaps.set(spaceId, newItems)
    this.notify()
  }

  private notify(): void {
    if (this.notifyScheduled) return
    this.notifyScheduled = true
    queueMicrotask(() => {
      this.notifyScheduled = false
      if (!this.started) return
      for (const cb of this.listeners) {
        cb()
      }
    })
  }
}
