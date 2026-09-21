"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import {
  filterForHint,
  isWritable,
  type Group,
  type Item,
  type ItemFilter,
  type User,
} from "@real-life-stack/data-interface"

import { useConnector } from "../../hooks/connector-context"
import { useGroups, useMembers, usePersonalGroupId } from "../../hooks/use-groups"
import { useItemDetailEdit } from "../../hooks/use-item-detail-edit"
import { useItemGroupColorResolver } from "../../hooks/use-item-group-color"
import { useItemsUnionWithDraft } from "../../hooks/use-items"
import { useSpaceVocabulary } from "../../hooks/use-space-vocabulary"
import type { ModuleEntry } from "../../lib/module-register"
import type { SelectionFocusVisibleArea } from "../../lib/selection-focus"
import { contentTypesFromRegister, mapComposerSubmission, withGroupOptions } from "../composer/content-types"
import { CreateFab } from "../create-fab/create-fab"
import { useLocationPick } from "../map/location-pick"
import { ReactionBar } from "../reactions/reaction-bar"
import { useOptionalCreate, useRegisterCreate, type CreateConfig } from "./create-host"
import { useRegisterDetail, type DetailConfig } from "./detail-host"

/**
 * Der Modul-Host (Spec 01, „Der Modul-Host"): macht aus dem Registereintrag
 * die laufende Flaeche. Er stellt EINMAL je aktivem Modul her, was sich alle
 * Module teilen — und was bis zum 21.09.2026 in sieben Ansichten stand, jedes
 * Mal abgeschrieben und jedes Mal ein wenig anders:
 *
 * - den **Space-Kontext** (Mitglieder, Gruppen, persoenlicher Space, Farben),
 * - das **Detail** des offenen Items (Lesen ↔ Bearbeiten, Reaktionen, Teilen),
 * - das **Erstellen** mit ALLEN Typen — ein Modul schlaegt einen vor
 *   (`options.suggestType`), schraenkt aber nie ein (Anton, 20.09.2026) —
 *   samt Plusknopf,
 * - die **Items** nach dem Ladevertrag (`presents` → Filter aus der
 *   Hinweis-Tabelle; `loads: "module"` heisst: keine Abfrage).
 *
 * Dem Modul bleibt die Ansicht, ihre Steuerelemente, ihr Vorschlag und —
 * wo es das gibt — eigene Logik (Kanban: Spalten, Verschieben).
 */
export interface ModuleHostValue {
  entry: ModuleEntry
  /** Wie vom Outlet uebergeben: Space-Id, `"__overview__"` oder leer. */
  groupId: string
  /** Aggregat („Mein Netzwerk") oder kein Space. */
  isOverview: boolean
  /** Der konkrete Space; `undefined` im Aggregat. */
  currentSpace: string | undefined
  /** Mitglieder des Space; im Aggregat die Vereinigung aller bekannten. */
  members: readonly User[]
  groups: readonly Group[]
  personalGroupId: string | null
  /** Farbe des Herkunfts-Space eines Items — fuer aktive Karten und Marker. */
  resolveItemGroupColor: (item: Item) => string
  /** Die Items nach dem Ladevertrag; `undefined`, wenn das Modul selbst laedt. */
  items: Item[] | undefined
  itemsLoading: boolean
  /**
   * Ein Modul mit eigenem Einstieg ins Schreiben (die Composer-Pille des
   * Feeds) meldet dessen Element; der Plusknopf weicht, solange es im Bild
   * ist. `null` nimmt die Meldung zurueck.
   */
  setCreateAnchor: (el: Element | null) => void
}

const ModuleHostContext = createContext<ModuleHostValue | null>(null)

/** Der Space-Kontext des Hosts. Wirft ausserhalb — ein Modul laeuft im Host. */
export function useModuleHost(): ModuleHostValue {
  const ctx = useContext(ModuleHostContext)
  if (!ctx) throw new Error("useModuleHost: kein <ModuleHost> — Module laufen im Modul-Host (Spec 01).")
  return ctx
}

export function useOptionalModuleHost(): ModuleHostValue | null {
  return useContext(ModuleHostContext)
}

export interface ModuleHostProps {
  entry: ModuleEntry
  groupId: string
  active: boolean
  groups?: readonly Group[]
  selectionFocusVisibleArea?: SelectionFocusVisibleArea
}

/**
 * Was der Host fuer einen Eintrag laedt (Spec 01, Der Ladevertrag): je Hinweis
 * ein Connector-Filter aus der Hinweis-Tabelle, bei mehreren die Vereinigung
 * der Abfragen — nie „alles und lokal filtern", denn ein Backend-Connector
 * zoege dann den ganzen Bestand (Codex-Review zu #414). Ohne Hinweis alles:
 * das Modul aggregiert (Feed, Liste, Graph). `null`: das Modul laedt selbst
 * (die Karte, nach Ausschnitt).
 */
export function hostFiltersFor(entry: Pick<ModuleEntry, "presents" | "loads" | "options">): ItemFilter[] | null {
  if (entry.loads === "module") return null
  const hints = entry.presents ?? []
  if (hints.length === 0) return [{}]
  return hints.map((h) => filterForHint(h, entry.options))
}

interface ItemsValue {
  items: Item[] | undefined
  itemsLoading: boolean
}
const ItemsContext = createContext<ItemsValue>({ items: undefined, itemsLoading: false })

function LoadedItems({ filters, children }: { filters: ItemFilter[]; children: ReactNode }) {
  const { data: items, isLoading } = useItemsUnionWithDraft(filters)
  const value = useMemo<ItemsValue>(() => ({ items, itemsLoading: isLoading }), [items, isLoading])
  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>
}

function HostItems({ entry, children }: { entry: ModuleEntry; children: ReactNode }) {
  const filters = hostFiltersFor(entry)
  if (!filters) return <>{children}</>
  return <LoadedItems filters={filters}>{children}</LoadedItems>
}

/**
 * Rendert die Flaeche eines Eintrags im Host. Das Outlet ruft ihn je Modul;
 * ein `keepMounted`-Modul behaelt seinen Host, solange es im Baum bleibt —
 * die Konfigurationen sind je Modul-Id registriert, also ueberschreibt ein
 * inaktiver Host nie den aktiven.
 */
export function ModuleHost({ entry, groupId, active, groups: groupsProp, selectionFocusVisibleArea }: ModuleHostProps) {
  return (
    <HostItems entry={entry}>
      <HostSurface entry={entry} groupId={groupId} active={active} groups={groupsProp} selectionFocusVisibleArea={selectionFocusVisibleArea} />
    </HostItems>
  )
}

function HostSurface({ entry, groupId, active, groups: groupsProp, selectionFocusVisibleArea }: ModuleHostProps) {
  const isOverview = !groupId || groupId === "__overview__"
  const currentSpace = isOverview ? undefined : groupId
  // `null` fragt die Vereinigung aller bekannten Mitglieder ab, damit im
  // Aggregat ein Autor aus einem anderen Space noch aufloest.
  const { data: members } = useMembers(isOverview ? null : groupId)
  const { data: groupsLive } = useGroups()
  const groups = groupsProp ?? groupsLive
  const personalGroupId = usePersonalGroupId()
  const resolveItemGroupColor = useItemGroupColorResolver(currentSpace)
  const { items, itemsLoading } = useContext(ItemsContext)

  // Bearbeiten und Erstellen teilen die Verdrahtung; die Tag-Vorschlaege
  // kommen aus dem Vokabular des Space (Spec 01, Regel 2a) — vorher hatte
  // nur das Kanban sie.
  const editConfig = useItemDetailEdit(members)
  const vokabular = useSpaceVocabulary()
  const composerProps = useMemo(
    () => ({
      ...editConfig.composerProps,
      tagSuggestions: [...vokabular.tags],
      tagQuickSuggestions: vokabular.tags.slice(0, 10),
    }),
    [editConfig.composerProps, vokabular.tags],
  )

  const createShell = entry.options?.createShell ?? "sheet"
  const createConfig = useMemo<CreateConfig>(
    () => ({
      // ALLE Typen; die Gruppenauswahl steht auf dem aktuellen Space, im
      // Aggregat auf dem persoenlichen.
      contentTypes: withGroupOptions(contentTypesFromRegister(), [...groups], currentSpace, personalGroupId),
      mapper: mapComposerSubmission,
      composerProps,
      shell: createShell,
    }),
    [groups, currentSpace, personalGroupId, composerProps, createShell],
  )
  useRegisterCreate(entry.id, createConfig)

  // Der Hintergrund-Schleier folgt aus `panelFit`: ueber einer ueberlagerten
  // Flaeche (Karte, Graph) keiner, sie bleibt bedienbar.
  const backdrop = entry.panelFit !== "overlay"
  const detailConfig = useMemo<DetailConfig>(
    () => ({
      ...editConfig,
      composerProps,
      renderCommentReactions: (commentId) => <ReactionBar itemId={commentId} />,
      onShare: () => { void navigator.clipboard?.writeText(window.location.href) },
      backdrop,
    }),
    [editConfig, composerProps, backdrop],
  )
  useRegisterDetail(entry.id, detailConfig)

  // Der Plusknopf: ueberall derselbe, mit dem Vorschlag des Moduls. Weg,
  // solange ein Ort auf der Karte gewaehlt wird, ohne Schreibrecht, und
  // solange ein vom Modul gemeldeter eigener Einstieg im Bild ist.
  const create = useOptionalCreate()
  const connector = useConnector()
  const { isPicking } = useLocationPick()
  const [anchor, setAnchor] = useState<Element | null>(null)
  const anchorRef = useMemo(() => ({ current: anchor }), [anchor])
  const suggestType = entry.options?.suggestType
  const showFab = !!create && active && !isPicking && isWritable(connector)

  const value = useMemo<ModuleHostValue>(
    () => ({
      entry, groupId, isOverview, currentSpace, members, groups, personalGroupId,
      resolveItemGroupColor, items, itemsLoading, setCreateAnchor: setAnchor,
    }),
    [entry, groupId, isOverview, currentSpace, members, groups, personalGroupId, resolveItemGroupColor, items, itemsLoading],
  )

  const View = entry.view
  return (
    <ModuleHostContext.Provider value={value}>
      {View && (
        <View
          groupId={groupId}
          active={active}
          groups={groups}
          selectionFocusVisibleArea={selectionFocusVisibleArea}
          items={items}
          itemsLoading={itemsLoading}
        />
      )}
      {showFab && (
        <CreateFab
          onClick={() => create.startCreate(suggestType)}
          label="Erstellen"
          hideWhileVisible={anchor ? anchorRef : undefined}
        />
      )}
    </ModuleHostContext.Provider>
  )
}
