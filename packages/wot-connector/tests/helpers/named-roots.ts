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
    const read = (key: string) => {
      const pending = ops.get(key)
      if (pending) return "remove" in pending ? undefined : clone(pending.value)
      return clone(stored[key])
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
        ops.set(key, value === undefined ? { remove: true } : { value: clone(value) })
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
    getRoot: <R extends object>(name: string) => clone(rootOf(name)) as R,
    transactRoot,
    transactRootDurable: async <R extends object>(name: string, fn: (root: R) => void) => {
      transactRoot<R>(name, fn)
    },
  }
}
