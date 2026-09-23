"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  filterForHint,
  isAggregateVisibleItemType,
  isWritable,
  type Group,
  type Item,
  type ItemFilter,
  type User,
} from "@real-life-stack/data-interface"

import { useConnector } from "../../hooks/connector-context"
import { useCurrentUser } from "../../hooks/use-auth"
import { useOptionalItemFocus } from "../../hooks/use-item-focus"
import { useResolvedUsers } from "../../hooks/use-resolved-users"
import { useGroups, useMembers, usePersonalGroupId } from "../../hooks/use-groups"
import { useItemDetailEdit } from "../../hooks/use-item-detail-edit"
import { useItemPresentation } from "../../hooks/use-item-presentation"
import { useSurfaceFilteredItems } from "../../hooks/use-filterable-items"
import { useItemsUnionWithDraft } from "../../hooks/use-items"
import { useGroupVocabulary } from "../../hooks/use-group-vocabulary"
import type { ModuleEntry } from "../../lib/module-register"
import type { SelectionFocusVisibleArea } from "../../lib/selection-focus"
import { contentTypesFromRegister, mapComposerSubmission, withGroupOptions } from "../composer/content-types"
import { useOptionalSharedFilter } from "../filter/filter-store"
import { useOptionalModulePanel } from "../module-panel/module-panel"
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
  /** Die Items nach dem Ladevertrag, gefiltert wie der Kopf es anzeigt; `undefined`, wenn das Modul selbst laedt. */
  items: Item[] | undefined
  itemsLoading: boolean
  /** Die angemeldete Person. */
  currentUser: User | null
  /**
   * Wer hat ein Item angelegt — als `User` fuer die Karte: Mitglied des
   * Space, sonst ich selbst, sonst ueber die Kontakte nachgeschlagen. Vorher
   * in Feed und Resonanz je einmal geschrieben, im Kanban halb, im Detail
   * ein viertes Mal.
   */
  resolveAuthor: (createdBy: string) => User | undefined
  /**
   * Das Item, das gerade offen ist: im geteilten Panel oder, solange es
   * noch nicht offen ist, im Fokus. Vorher rechnete es jedes Modul selbst,
   * in drei Varianten.
   */
  activeItemId: string | undefined
  /** Ist Suche, Tag- oder Typfilter gesetzt? Fuer „Keine Treffer" statt „Noch nichts hier". */
  filterActive: boolean
  /**
   * Ein Modul meldet das Element einer Karte; der Host scrollt es in den
   * Blick, wenn sein Item in den Fokus kommt — auch wenn es erst spaeter
   * gerendert wird. Als `ref`-Callback benutzen.
   */
  registerItemElement: (id: string, el: Element | null) => void
  /**
   * Ein Modul mit eigenem Einstieg ins Schreiben (die Composer-Pille des
   * Feeds) meldet dessen Element; der Plusknopf weicht, solange es im Bild
   * ist. `null` nimmt die Meldung zurueck.
   */
  setCreateAnchor: (el: Element | null) => void
}

const ModuleHostContext = createContext<ModuleHostValue | null>(null)

/**
 * The space context and the items the module host produced for this surface.
 *
 * Der Space-Kontext des Hosts. Wirft ausserhalb — ein Modul laeuft im Host.
 *
 * @answers `{entry, currentSpace, members, groups, items, setCreateAnchor, …}`
 * @without throws on render
 * @group surface
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useModuleHost(): ModuleHostValue {
  const ctx = useContext(ModuleHostContext)
  if (!ctx) throw new Error("useModuleHost: kein <ModuleHost> — Module laufen im Modul-Host (Spec 01).")
  return ctx
}

/**
 * The host context, or `null` outside a module host.
 *
 * @answers `ModuleHostValue | null`
 * @without value — null
 * @group surface
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
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

function LoadedItems({ entry, filters, children }: { entry: ModuleEntry; filters: ItemFilter[]; children: ReactNode }) {
  const { data: geladen, isLoading } = useItemsUnionWithDraft(filters)
  // Der geteilte Filter (Suche, Tags, Typen) ist HIER angewendet: Ein Modul
  // bekommt genau das, was der Kopf anzeigt, und kann nichts vergessen.
  const gefiltert = useSurfaceFilteredItems(geladen)
  // Ein aggregierendes Modul (ohne `presents`: Feed, Liste, Graph) sieht,
  // was als eigene Karte steht — Kommentare, Reaktionen und Relationen
  // werden ueber ihr Item gelesen (Spec 06, Modul-Konsequenzen). Vorher
  // stand diese Regel in jedem dieser Module einzeln.
  const aggregiert = !(entry.presents?.length)
  const items = useMemo(
    () => (aggregiert ? gefiltert.filter((item) => isAggregateVisibleItemType(item.type)) : gefiltert),
    [aggregiert, gefiltert],
  )
  const value = useMemo<ItemsValue>(() => ({ items, itemsLoading: isLoading }), [items, isLoading])
  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>
}

function HostItems({ entry, children }: { entry: ModuleEntry; children: ReactNode }) {
  const filters = hostFiltersFor(entry)
  if (!filters) return <>{children}</>
  return <LoadedItems entry={entry} filters={filters}>{children}</LoadedItems>
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
  // Die Farbe kommt aus derselben Ableitung wie Herkunft und Privatheit (useItemPresentation); der Host reicht nur die Farbe weiter.
  const present = useItemPresentation(currentSpace)
  const resolveItemGroupColor = useCallback((item: Item) => present(item).color, [present])
  const { items, itemsLoading } = useContext(ItemsContext)
  const { data: currentUser } = useCurrentUser()

  // Autor-Aufloesung: Mitglied → ich selbst → Kontakte (nachgeschlagen nur
  // fuer die Ids, die die Items dieses Moduls wirklich tragen).
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const unknownAuthorIds = useMemo(
    () => [...new Set((items ?? []).map(({ createdBy }) => createdBy))].filter((id) => !memberMap.has(id) && id !== currentUser?.id),
    [items, memberMap, currentUser],
  )
  const resolvedAuthors = useResolvedUsers(unknownAuthorIds)
  const resolveAuthor = useCallback(
    (createdBy: string): User | undefined =>
      memberMap.get(createdBy) ?? (currentUser?.id === createdBy ? currentUser : undefined) ?? resolvedAuthors.get(createdBy),
    [memberMap, currentUser, resolvedAuthors],
  )

  // Das offene Item: im Panel, sonst im Fokus (das Panel folgt ihm gleich).
  const focus = useOptionalItemFocus()
  const panel = useOptionalModulePanel()
  const focusedId = focus?.itemId
  const panelItem = panel?.current?.kind === "detail" ? panel.current.itemId : undefined
  const activeItemId = panelItem ?? focusedId

  const filter = useOptionalSharedFilter()
  const filterActive = !!filter && (filter.searchText.trim() !== "" || filter.value.tags.length > 0 || filter.value.types.length > 0)

  // In den Blick scrollen, was in den Fokus kommt — einmal je Item, auch
  // wenn die Karte erst nach dem Fokus gerendert wird (Filter, Nachladen).
  const elementsRef = useRef(new Map<string, Element>())
  const revealedRef = useRef<string | null>(null)
  const focusedRef = useRef<string | undefined>(undefined)
  focusedRef.current = focusedId
  const zeige = useCallback((id: string, el: Element) => {
    if (revealedRef.current === id) return
    revealedRef.current = id
    el.scrollIntoView?.({ behavior: "smooth", block: "center" })
  }, [])
  const registerItemElement = useCallback((id: string, el: Element | null) => {
    if (el) {
      elementsRef.current.set(id, el)
      if (focusedRef.current === id) zeige(id, el)
    } else {
      elementsRef.current.delete(id)
    }
  }, [zeige])
  useEffect(() => {
    if (!focusedId) { revealedRef.current = null; return }
    const el = elementsRef.current.get(focusedId)
    if (el) zeige(focusedId, el)
  }, [focusedId, items, zeige])

  // Bearbeiten und Erstellen teilen die Verdrahtung; die Tag-Vorschlaege
  // kommen aus dem Vokabular des Space (Spec 01, Regel 2a) — vorher hatte
  // nur das Kanban sie.
  const editConfig = useItemDetailEdit(members)
  const vokabular = useGroupVocabulary()
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
      currentUser: currentUser ?? null, resolveAuthor, activeItemId, filterActive, registerItemElement,
    }),
    [entry, groupId, isOverview, currentSpace, members, groups, personalGroupId, resolveItemGroupColor, items, itemsLoading, currentUser, resolveAuthor, activeItemId, filterActive, registerItemElement],
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
