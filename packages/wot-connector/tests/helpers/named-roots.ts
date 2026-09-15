/**
 * Die Attrappe der Adapter-Capability `NamedRootsCapable` (wot-core 0.5.9,
 * adapter-yjs 0.2.9) für Tests ohne Yjs.
 *
 * Nachgebildet sind genau die Eigenschaften, an denen die Schreibpfade hängen:
 *
 * - Eine Wurzel existiert IMMER; kein Aufrufer legt sie an (`getRoot` liefert
 *   `{}`, solange nie geschrieben wurde).
 * - Gelesen wird eine tiefe Kopie, geschrieben eine tiefe Kopie — nichts aus
 *   dem Doc verlässt es als Referenz.
 * - Der Entwurf sammelt die Schreibvorgänge und wendet sie erst nach der
 *   Rückkehr an; wirft die Funktion, wird NICHTS geschrieben.
 *
 * Für den echten Merge-Beweis steht `yjs-space-handle.ts` daneben: zwei echte
 * Y-Dokumente, gleiche Wurzel-Semantik.
 */
export interface FakeNamedRoots {
  /** Der rohe Inhalt je Wurzelname — Testsicht, nicht Teil der Capability. */
  roots: Record<string, Record<string, unknown>>
  getRoot<R extends object = Record<string, unknown>>(name: string): R
  transactRoot<R extends object = Record<string, unknown>>(name: string, fn: (root: R) => void): void
  transactRootDurable<R extends object = Record<string, unknown>>(name: string, fn: (root: R) => void): Promise<void>
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

export function createFakeNamedRoots(
  initial: Record<string, Record<string, unknown>> = {},
): FakeNamedRoots {
  const roots: Record<string, Record<string, unknown>> = clone(initial)
  const rootOf = (name: string) => (roots[name] ??= {})

  const transactRoot = <R extends object>(name: string, fn: (root: R) => void): void => {
    const stored = rootOf(name)
    const ops = new Map<string, { value: unknown } | { remove: true }>()
    // Gelesen wird eine tief EINGEFRORENE Kopie, wie im Adapter: eine
    // verschachtelte Mutation am gelesenen Wert wirkt nie im Doc und muss
    // deshalb auch im Test auffallen.
    const read = (key: string) => {
      const pending = ops.get(key)
      if (pending) return "remove" in pending ? undefined : toRootValue(clone(pending.value), `${name}.${key}`)
      return toRootValue(clone(stored[key]), `${name}.${key}`)
    }
    const keys = () => {
      const all = new Set(Object.keys(stored))
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
        if (FORBIDDEN_ROOT_KEYS.has(key)) {
          throw new TypeError(`named root key "${key}" at "${name}.${key}" is not allowed`)
        }
        ops.set(key, value === undefined ? { remove: true } : { value: toRootValue(clone(value), `${name}.${key}`) })
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
    for (const [key, op] of ops) {
      if ("remove" in op) delete stored[key]
      else stored[key] = op.value
    }
  }

  return {
    roots,
    getRoot: <R extends object>(name: string) => {
      const projection: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(rootOf(name))) {
        projection[key] = toRootValue(clone(value), `${name}.${key}`)
      }
      return projection as R
    },
    transactRoot,
    transactRootDurable: async <R extends object>(name: string, fn: (root: R) => void) => {
      transactRoot<R>(name, fn)
    },
  }
}
