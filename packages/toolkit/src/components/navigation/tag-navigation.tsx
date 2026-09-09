"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import { useSharedFilter } from "../filter/filter-store"

/**
 * Wie ein Tag auf einer Karte zu allem anderen fuehrt, das so verschlagwortet
 * ist: Er setzt den geteilten Filter.
 *
 * **Warum als Vertrag und nicht direkt im Chip.** Ein `TagChip` steht auch
 * dort, wo es keinen Filter gibt — in Stories, in Tests, in der
 * Netzwerk-App. Griffe er selbst nach dem Filter, waere jede dieser Flaechen
 * ein Absturz oder ein Knopf, der nichts tut. Also fragt der Chip nur: „Fuehrt
 * dieses Tag irgendwohin?" Ohne Provider fuehrt es nirgendwohin und bleibt
 * Text — dieselbe Regel wie bei {@link FieldNavigationValue} und
 * {@link CommentNavigationValue}.
 *
 * Anders als die beiden Schwestern bringt der Provider seine Implementierung
 * MIT: Wohin ein Feld navigiert, weiss nur die App (Route, Register, Module
 * dieses Space) — was ein Tag tut, steht dagegen vollstaendig in der Spec
 * (shared-components → „Modul-uebergreifender Filter-State"). Die App
 * entscheidet nur noch, OB Tags klickbar sind, indem sie den Provider montiert.
 */
export interface TagNavigationValue {
  /** Aktion fuer dieses Tag, oder `null`, wenn es keinen Weg gibt. */
  openTag(tag: string): (() => void) | null
  /** Steht das Tag gerade im Filter? */
  isActive(tag: string): boolean
}

const TagNavigationContext = createContext<TagNavigationValue | null>(null)

/**
 * Macht Tags anklickbar: Ein Klick nimmt das Tag in den geteilten Filter auf,
 * ein Klick auf ein aktives nimmt es wieder heraus.
 *
 * Tags sind UND-verknuepft (`FilterBarValue.tags`, Spec shared-components):
 * Der zweite Tag verengt die Auswahl, er erweitert sie nicht. Deshalb ist
 * „hinzufuegen" die richtige Antwort auf den Klick und nicht „ersetzen" — wer
 * zwei Tags antippt, meint beide.
 *
 * Muss unter einem `FilterProvider` haengen; ohne ihn gaebe es keinen Filter,
 * den ein Klick setzen koennte.
 */
export function TagNavigationProvider({ children }: { children: ReactNode }) {
  const { value, setValue } = useSharedFilter()
  const navigation = useMemo<TagNavigationValue>(
    () => ({
      isActive: (tag) => value.tags.includes(tag),
      openTag: (tag) => () =>
        setValue({
          ...value,
          tags: value.tags.includes(tag)
            ? value.tags.filter((t) => t !== tag)
            : [...value.tags, tag],
        }),
    }),
    [value, setValue],
  )
  return <TagNavigationContext.Provider value={navigation}>{children}</TagNavigationContext.Provider>
}

/**
 * Der Weg, den ein Tag oeffnet — oder `null`, wo es keinen gibt.
 *
 * Gibt Aktion UND Zustand zurueck, anders als `useFieldLink`: Ein Tag-Filter
 * ist umschaltbar, und wer den Chip zeichnet, muss sagen koennen, ob er
 * gerade filtert (`aria-pressed`). Zwei Hooks fuer dieselbe Frage waeren zwei
 * Stellen, die den Vertrag kennen.
 */
export interface TagLink {
  onClick(): void
  active: boolean
}

export function useTagLink(tag: string): TagLink | null {
  const navigation = useContext(TagNavigationContext)
  const oeffnen = navigation?.openTag(tag)
  if (!navigation || !oeffnen) return null
  return { onClick: oeffnen, active: navigation.isActive(tag) }
}
