import { useMemo } from "react"
import type { Item, User } from "@real-life-stack/data-interface"

import type { ContentComposerProps, ContentTypeConfig, WidgetData } from "../components/composer/content-composer"
import type { ItemEditorMapper } from "./use-item-editor"
import {
  contentTypesFromRegister,
  itemToComposerData,
  mapComposerSubmission,
  withGroupOptions,
} from "../components/composer/content-types"
import { useGroups, usePersonalGroupId } from "./use-groups"
import { useItemComposerProps } from "./use-item-composer-props"

/** Die geteilte, typgetriebene Bearbeiten-Hälfte jeder Detail-Konfiguration. */
export interface ItemDetailEditConfig {
  /** Alle Inhaltstypen — die Ansicht sperrt auf den Typ des Items. */
  contentTypes: ContentTypeConfig[]
  /** Abbildung Composer → Item, für Erstellen und Bearbeiten. */
  mapper: ItemEditorMapper
  /** Vorbelegung des Composers aus dem lebenden Item. */
  editInitialData: (item: Item) => Partial<WidgetData>
  /** Laufzeit-Verdrahtung (Geocoder, Karten-Pick, Personen). */
  composerProps?: Partial<ContentComposerProps>
}

/**
 * Die Bearbeiten-Seite des Details, für alle Module gleich: das volle
 * Typ-Register (der Host sperrt auf den Typ des Items und zeigt dessen
 * Felder, wo immer es geöffnet wird — ein Task mit Ort bearbeitbar auf der
 * Karte), die geteilte Abbildung und Vorbelegung, und die Composer-Rückrufe
 * aus den Mitgliedern des aktiven Space.
 *
 * Bis zum 21.09.2026 in der Referenz-App; jedes Modul rief es einzeln
 * (B0, Schritt 3).
 */
export function useItemDetailEdit(members: readonly User[]): ItemDetailEditConfig {
  const { data: groups } = useGroups()
  const personalGroupId = usePersonalGroupId()
  const composerProps = useItemComposerProps(members)
  const contentTypes = useMemo(
    () => withGroupOptions(contentTypesFromRegister(), groups, undefined, personalGroupId),
    [groups, personalGroupId],
  )
  return useMemo(
    () => ({ contentTypes, mapper: mapComposerSubmission, editInitialData: itemToComposerData, composerProps }),
    [contentTypes, composerProps],
  )
}
