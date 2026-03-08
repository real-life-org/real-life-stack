export function stripNulls<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: Exclude<T[K], null> } {
  const result = {} as Record<string, unknown>
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null) result[k] = v
  }
  return result as { [K in keyof T]: Exclude<T[K], null> }
}
