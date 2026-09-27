import { useCallback, useState } from "react"
import { useOptionalSharedFilter } from "../components/filter/filter-store"
import { useOptionalModuleHost } from "../components/host/module-host"

/**
 * A module's own filter value that survives the module switch.
 *
 * Drop-in for `useState` for the values behind a module's `drawerExtra` /
 * `chipsExtra` („Nur meine", Zuweisung, Personen). They stay the module's:
 * each module has its own area, keyed by the module id, and no other module
 * reads it (spec shared-components → Modul-übergreifender Filter-State,
 * rule 2). But they live as long as the shared filter — switching to another
 * module and back keeps them, as it keeps tags and search.
 *
 * Without a filter owner (story, test) the value is local, like `useState`.
 *
 * @answers `[value, setValue]`
 * @without value — local state
 * @group host
 * @see spec docs/spec/modules/shared-components.md
 */
export function useModuleFilter<T>(key: string, initial: T): [T, (next: T) => void] {
  const shared = useOptionalSharedFilter()
  const moduleId = useOptionalModuleHost()?.entry.id ?? "_"
  const [local, setLocal] = useState<T>(initial)
  const fullKey = `${moduleId}:${key}`
  const stored = shared?.moduleFilters[fullKey]
  const value = shared ? (stored === undefined ? initial : (stored as T)) : local
  const setModuleFilter = shared?.setModuleFilter
  const setValue = useCallback(
    (next: T) => (setModuleFilter ? setModuleFilter(fullKey, next) : setLocal(next)),
    [setModuleFilter, fullKey],
  )
  return [value, setValue]
}
