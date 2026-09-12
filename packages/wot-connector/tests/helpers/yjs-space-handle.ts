import * as Y from "yjs"

/**
 * Ein `SpaceHandle` über einem ECHTEN Y.Doc, mit denselben Proxy-Regeln wie
 * `@real-life/adapter-yjs` 0.2.8 (`dist/index.js`, Funktionen `Mn` und `ri`):
 * ein Objektwert legt unter dem Schlüssel eine geschachtelte `Y.Map` an, wenn
 * dort noch keine liegt, und mischt sonst in die vorhandene hinein.
 *
 * Genau daran hängt Befund R2-1: eine geschachtelte Map, die zwei Geräte
 * NEBENLÄUFIG anlegen, ist im Merge ein Register — eine der beiden gewinnt, die
 * andere geht samt Inhalt verloren. Mit einer Attrappe aus einfachen Objekten
 * ist das nicht beobachtbar, deshalb steht hier Yjs.
 */

function docProxy<T extends object>(map: Y.Map<unknown>): T {
  return new Proxy({}, {
    get(_target, key: string | symbol) {
      const value = map.get(String(key))
      if (value instanceof Y.Map) return docProxy(value)
      if (value instanceof Y.Array) return value.toArray()
      return value
    },
    set(_target, key: string | symbol, value: unknown) {
      assign(map, String(key), value)
      return true
    },
    deleteProperty(_target, key: string | symbol) {
      map.delete(String(key))
      return true
    },
    has(_target, key: string | symbol) {
      return map.has(String(key))
    },
    ownKeys() {
      return Array.from(map.keys())
    },
    getOwnPropertyDescriptor(_target, key: string | symbol) {
      if (!map.has(String(key))) return undefined
      return { configurable: true, enumerable: true, writable: true, value: map.get(String(key)) }
    },
  }) as T
}

function assign(map: Y.Map<unknown>, key: string, value: unknown): void {
  if (Array.isArray(value)) {
    const array = new Y.Array()
    array.push(value)
    map.set(key, array)
    return
  }
  if (value && typeof value === "object") {
    let child = map.get(key)
    if (!(child instanceof Y.Map)) {
      child = new Y.Map()
      map.set(key, child as Y.Map<unknown>)
    }
    mergeInto(child as Y.Map<unknown>, value as Record<string, unknown>)
    return
  }
  map.set(key, value)
}

function mergeInto(map: Y.Map<unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) assign(map, key, value)
}

export interface YjsTestSpaceHandle<T extends object> {
  id: string
  ydoc: Y.Doc
  getDoc(): T
  transact(fn: (doc: T) => void): void
  onRemoteUpdate(callback: () => void): () => void
  close(): void
  /** Alles, was dieses Doc weiß, in ein anderes übertragen (ein Sync-Schritt). */
  syncInto(other: YjsTestSpaceHandle<T>): void
}

export function createYjsSpaceHandle<T extends object>(id: string): YjsTestSpaceHandle<T> {
  const ydoc = new Y.Doc()
  const root = ydoc.getMap<unknown>("data")
  const doc = docProxy<T>(root)
  const callbacks = new Set<() => void>()
  ydoc.on("update", (_update: Uint8Array, origin: unknown) => {
    if (origin === "remote") callbacks.forEach((callback) => { callback() })
  })
  return {
    id,
    ydoc,
    getDoc: () => doc,
    transact: (fn) => { ydoc.transact(() => { fn(doc) }) },
    onRemoteUpdate: (callback) => {
      callbacks.add(callback)
      return () => callbacks.delete(callback)
    },
    close: () => { callbacks.clear() },
    syncInto: (other) => {
      Y.applyUpdate(other.ydoc, Y.encodeStateAsUpdate(ydoc), "remote")
    },
  }
}
