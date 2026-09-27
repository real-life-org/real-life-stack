"use client"

import { startTransition, useEffect, useMemo, useState } from "react"
import { hasGroups, hasGroupScope, type Item, type Observable, type User } from "@real-life-stack/data-interface"

import { useOptionalConnector } from "../../hooks/connector-context"
import { groupVocabulary } from "../../hooks/use-group-vocabulary"
import type { PersonOption } from "./widgets/people-widget"

/** Was der Formular-Space für Vorschläge liefert; `undefined` je Feld: die Vorgabe des Hosts gilt. */
export interface FormSpaceSources {
  /** Mitglieder des Formular-Space (`observeMembers(space)`). */
  people?: PersonOption[]
  /** Tags des Formular-Space. */
  tags?: string[]
  /** Der Connector kann die Tags dieses Space nicht lesen (Regel 7). */
  tagsUnavailable?: boolean
  /** Die Items des Formular-Space (nur mit `ItemFilter.group`): Vorschläge der Chips-Felder (B10). */
  items?: readonly Item[]
}

const NONE: readonly never[] = []

function useObservableValue<T>(observable: Observable<T> | null, empty: T): T {
  const [value, setValue] = useState<T>(() => observable?.current ?? empty)
  useEffect(() => {
    if (!observable) {
      setValue(empty)
      return
    }
    setValue(observable.current)
    return observable.subscribe((next) => startTransition(() => setValue(next)))
    // `empty` ist eine Konstante des Aufrufers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observable])
  return value
}

/**
 * Personen- und Tag-Vorschläge aus dem Space des Formulars
 * (shared-components → Space des Formulars, Regel 3), nicht aus dem
 * geöffneten. Personen: die Mitglieder dieses Space. Tags: das Vokabular
 * seiner Items, gelesen mit `ItemFilter.group` (02). Kann der Connector
 * dort nicht lesen und ist es nicht der geöffnete Space, gibt es keine
 * Tag-Vorschläge, und das Formular sagt es (Regel 7).
 *
 * Ohne Connector mit Gruppen oder ohne Formular-Space: `null` — dann
 * gelten die Vorschläge, die der Host mitgibt.
 */
export function useFormSpaceSources(formSpace: string | undefined): FormSpaceSources | null {
  const connector = useOptionalConnector()
  const groups = connector && hasGroups(connector) ? connector : null
  const space = groups && formSpace ? formSpace : undefined
  const scoped = !!connector && !!space && hasGroupScope(connector)

  const membersObservable = useMemo(() => (groups && space ? groups.observeMembers(space) : null), [groups, space])
  const itemsObservable = useMemo(
    () => (connector && space && scoped ? connector.observe({ group: space }) : null),
    [connector, space, scoped],
  )
  const members = useObservableValue<readonly User[]>(membersObservable, NONE)
  const items = useObservableValue<readonly Item[]>(itemsObservable, NONE)

  // Nur für die Frage, ob die Vorgabe des Hosts (Vokabular des geöffneten
  // Space) hier stimmt — der Formular-Space selbst kommt nie von hier.
  const openSpace = groups?.getCurrentGroup()?.id ?? null
  return useMemo(() => {
    if (!space) return null
    const people = members.map((m) => ({ id: m.id, name: m.displayName ?? m.id }))
    if (scoped) return { people, tags: [...groupVocabulary(items).tags], items }
    if (openSpace === space) return { people }
    return { people, tags: [], tagsUnavailable: true }
  }, [space, scoped, members, items, openSpace])
}
