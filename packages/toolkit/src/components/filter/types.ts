import type { ComponentType } from "react"

/**
 * The shared `FilterBar` value. Modules hold this in their view state
 * (controlled component) and pass it back via `onChange`. Module-
 * specific extras live alongside, not inside.
 */
export interface FilterBarValue {
  /** Tag IDs (matched against top-level `item.tags`). Empty = no filter. */
  tags: string[]
  /** Item-type IDs. Empty = no filter. */
  types: string[]
}

/**
 * Empty `FilterBarValue` constant — handy as initial state. Deep-frozen
 * so accidental `emptyFilterBarValue.tags.push(...)` throws instead of
 * silently sharing state across callers.
 */
export const emptyFilterBarValue: FilterBarValue = Object.freeze({
  tags: Object.freeze([]) as readonly string[] as string[],
  types: Object.freeze([]) as readonly string[] as string[],
}) as FilterBarValue

/**
 * Option entry for the type filter. Each module supplies the types it
 * wants to expose; the toolkit doesn't decide which item types exist.
 */
export interface FilterTypeOption {
  id: string
  label: string
  /** Optional lucide-react (or compatible) icon component for the row. */
  icon?: ComponentType<{ className?: string }>
  /**
   * Farbklassen des Typ-Abzeichens, damit der Chip im Filter aussieht wie das
   * Abzeichen auf der Karte.
   *
   * Vom AUFRUFER, nicht aus dem Typ-Register gezogen: Die Filter-Schicht
   * entscheidet so wenig ueber Typen wie bisher — sie kennt weder die Liste
   * noch ihre Darstellung (`resolveTypePresentation(id).badge?.className`
   * liefert den Wert dort, wo das Register ohnehin schon gelesen wird).
   */
  badgeClassName?: string
}
