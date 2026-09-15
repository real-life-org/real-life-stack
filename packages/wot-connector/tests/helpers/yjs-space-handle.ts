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

/**
 * `getDoc()` liefert im Adapter einen Objekt-SNAPSHOT (`ii`), keinen lebenden
 * Schreibproxy — Lesen außerhalb einer Transaktion darf nicht schreiben können.
 */
function snapshot(map: Y.Map<unknown>): Record<string, unknown> {
  const plain: Record<string, unknown> = {}
  map.forEach((value, key) => {
    if (value instanceof Y.Map) plain[key] = snapshot(value)
    else if (value instanceof Y.Array) plain[key] = value.toArray()
    else plain[key] = value
  })
  return plain
}

/**
 * Benannte Wurzeln wie in `@real-life/adapter-yjs` 0.2.9 (`dist/index.js`,
 * `getRoot`/`transactRoot`/`transactRootDurable`, Helfer `Ol`, `tr`, `nr`):
 *
 * - Eine Wurzel IST ein Y-Root-Type (`doc.getMap(name)`). Sie existiert auf
 *   jedem Gerät, ohne dass ein Gerät sie anlegt — genau das ist der Grund für
 *   rls#353.
 * - Werte sind flaches JSON, tief kopiert. Es entstehen KEINE geschachtelten
 *   Y.Maps, eine Zuweisung ersetzt den Wert atomar.
 * - Der Entwurf sammelt die Schreibvorgänge und wendet sie erst NACH der
 *   Rückkehr der Funktion in EINER Transaktion an; wirft die Funktion, wird
 *   nichts geschrieben.
 */
function rootDraft<R extends object>(map: Y.Map<unknown>, fn: (root: R) => void): Array<[string, unknown]> {
  const ops = new Map<string, { value: unknown } | { remove: true }>()
  // Gelesen wird eine tief EINGEFRORENE Kopie, wie im Adapter.
  const read = (key: string): unknown => {
    const pending = ops.get(key)
    if (pending) return "remove" in pending ? undefined : toRootValue(clone(pending.value), `root.${key}`)
    return toRootValue(clone(map.get(key)), `root.${key}`)
  }
  const keys = () => {
    const all = new Set(map.keys())
    for (const [key, op] of ops) {
      if ("remove" in op) all.delete(key)
      else all.add(key)
    }
    return Array.from(all)
  }
  const draft = new Proxy({}, {
    get: (_t, key: string | symbol) => (typeof key === "string" ? read(key) : undefined),
    set: (_t, key: string | symbol, value: unknown) => {
      if (typeof key !== "string") throw new TypeError("named root keys must be strings")
      if (FORBIDDEN_ROOT_KEYS.has(key)) throw new TypeError(`named root key "${key}" is not allowed`)
      if (value === undefined) ops.set(key, { remove: true })
      else ops.set(key, { value: toRootValue(clone(value), `root.${key}`) })
      return true
    },
    deleteProperty: (_t, key: string | symbol) => {
      if (typeof key === "string") ops.set(key, { remove: true })
      return true
    },
    has: (_t, key: string | symbol) => typeof key === "string" && read(key) !== undefined,
    ownKeys: () => keys(),
    getOwnPropertyDescriptor: (_t, key: string | symbol) => {
      if (typeof key !== "string" || read(key) === undefined) return undefined
      return { configurable: true, enumerable: true, get: () => read(key) }
    },
  }) as R
  fn(draft)
  return Array.from(ops.entries()).map(([key, op]) => [key, "remove" in op ? undefined : op.value] as [string, unknown])
}

const FORBIDDEN_ROOT_KEYS = new Set(["__proto__", "constructor", "prototype"])

/**
 * Der Wertvertrag benannter Wurzeln, wie der Adapter ihn prüft: `nt`/`Sa` in
 * `@real-life/adapter-yjs@0.2.9` gehen REKURSIV durch den Wert und werfen bei
 * jedem verbotenen Schlüssel — auch tief drin, etwa in `supersedes`. Und der
 * gelesene Wert ist tief eingefroren, eine verschachtelte Mutation wirft.
 */
function toRootValue<V>(value: V, path: string): V {
  if (value === null || typeof value !== "object") return value
  const source = value as Record<string, unknown>
  if (Array.isArray(source)) {
    return Object.freeze(source.map((entry, index) => toRootValue(entry, `${path}[${index}]`))) as unknown as V
  }
  const copy: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(source)) {
    if (FORBIDDEN_ROOT_KEYS.has(key)) {
      throw new TypeError(`named root key "${key}" at "${path}.${key}" is not allowed`)
    }
    copy[key] = toRootValue(entry, `${path}.${key}`)
  }
  return Object.freeze(copy) as V
}

function clone<V>(value: V): V {
  return value === undefined || value === null || typeof value !== "object"
    ? value
    : JSON.parse(JSON.stringify(value)) as V
}

export interface YjsTestSpaceHandle<T extends object> {
  id: string
  ydoc: Y.Doc
  getDoc(): T
  transact(fn: (doc: T) => void): void
  getRoot<R extends object = Record<string, unknown>>(name: string): R
  transactRoot<R extends object = Record<string, unknown>>(name: string, fn: (root: R) => void): void
  transactRootDurable<R extends object = Record<string, unknown>>(name: string, fn: (root: R) => void): Promise<void>
  onRemoteUpdate(callback: () => void): () => void
  close(): void
  /** Alles, was dieses Doc weiß, in ein anderes übertragen (ein Sync-Schritt). */
  syncInto(other: YjsTestSpaceHandle<T>): void
}

function assertRootName(name: string): void {
  if (name === "data" || name.startsWith("_") || !/^[a-z][A-Za-z0-9]*$/.test(name)) {
    throw new TypeError(`named root: "${name}" is not a valid root name`)
  }
}

export function createYjsSpaceHandle<T extends object>(id: string): YjsTestSpaceHandle<T> {
  const ydoc = new Y.Doc()
  const root = ydoc.getMap<unknown>("data")
  const doc = docProxy<T>(root)
  const callbacks = new Set<() => void>()
  ydoc.on("update", (_update: Uint8Array, origin: unknown) => {
    if (origin === "remote") callbacks.forEach((callback) => { callback() })
  })
  const handle: YjsTestSpaceHandle<T> = {
    id,
    ydoc,
    getDoc: () => snapshot(root) as T,
    transact: (fn) => { ydoc.transact(() => { fn(doc) }) },
    getRoot: <R extends object>(name: string) => {
      assertRootName(name)
      const projection: Record<string, unknown> = {}
      ydoc.getMap<unknown>(name).forEach((value, key) => {
        projection[key] = toRootValue(clone(value), `${name}.${key}`)
      })
      return projection as R
    },
    transactRoot: <R extends object>(name: string, fn: (root: R) => void) => {
      assertRootName(name)
      const map = ydoc.getMap<unknown>(name)
      const ops = rootDraft<R>(map, fn)
      if (ops.length === 0) return
      ydoc.transact(() => {
        for (const [key, value] of ops) {
          if (value === undefined) map.delete(key)
          else map.set(key, value)
        }
      })
    },
    transactRootDurable: async <R extends object>(name: string, fn: (root: R) => void) => {
      handle.transactRoot<R>(name, fn)
    },
    onRemoteUpdate: (callback) => {
      callbacks.add(callback)
      return () => callbacks.delete(callback)
    },
    close: () => { callbacks.clear() },
    syncInto: (other) => {
      Y.applyUpdate(other.ydoc, Y.encodeStateAsUpdate(ydoc), "remote")
    },
  }
  return handle
}
