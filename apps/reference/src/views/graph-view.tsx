import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  graphItemNodeId,
  graphNodeRef,
  projectSpaceGraph,
  GraphView,
  ModuleToolbar,
  resolveTypePresentation,
  useModuleFilteredItems,
  useMembers,
  useRelationRecords,
  type GraphViewHandle,
  type ModuleViewProps,
} from "@real-life-stack/toolkit"
import { useItemFocus, useItemGroupResolver, useOpenProfile } from "@real-life-stack/toolkit"
import { useModulePanel } from "@real-life-stack/toolkit"

/**
 * Graph module — the space's items and their relations as a force graph.
 *
 * Nodes are the space's card-bearing items (system types stay out — a
 * reaction or comment is not a node) plus the PEOPLE that item edges point
 * at (`global:` targets, resolved via the member union). Edges come from two
 * sources, mirroring spec 04's two relation mechanisms:
 *
 * - embedded relations (`item.relations[]`, e.g. task --assignedTo--> user)
 * - relation records (items of type `relation` with `from`/`to`, e.g. votesOn)
 *
 * Node colours derive from the TYPE REGISTER labels — the graph is a lens
 * like any other and introduces no fifth type list.
 */

export function GraphViewWrapper({ groupId, items: alleItems = [] }: Pick<ModuleViewProps, "groupId" | "items">) {
  // Der Graph aggregiert: der Host laedt ungefiltert (kein `presents`).
  // Der Graph filtert wie jedes andere Modul — nur schwebt seine Leiste ueber
  // der Flaeche, statt in einem Kopf zu sitzen (`panelFit: "overlay"`,
  // Spec 01, Regel 5). Der Wert ist derselbe wie im Feed daneben.
  const items = useModuleFilteredItems(alleItems)
  const { data: records } = useRelationRecords()
  const { data: members } = useMembers(groupId === "__overview__" ? null : groupId)
  const { focusItem, itemId: focusedItemId, clearFocus } = useItemFocus()
  const modulePanel = useModulePanel()
  const graphRef = useRef<GraphViewHandle>(null)

  const resolveLabel = useCallback((typeId: string) => resolveTypePresentation(typeId).label, [])

  // Connector knowledge of an item's HOME space, for verifying space-qualified
  // relation targets (`space:B/item:x`) against id collisions.
  const resolveGroup = useItemGroupResolver()
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const resolveItemSpace = useCallback(
    (itemId: string) => {
      const item = itemById.get(itemId)
      return item ? resolveGroup(item)?.id ?? null : null
    },
    [itemById, resolveGroup],
  )

  const projection = useMemo(
    () => projectSpaceGraph(items, records, members, resolveLabel, { resolveItemSpace }),
    [items, records, members, resolveLabel, resolveItemSpace],
  )

  // Tags und Typen aus dem UNGEFILTERTEN Bestand: Sonst verschwaende die
  // Auswahl mit dem, was sie gerade wegfiltert, und man koennte einen Filter
  // nicht mehr gegen einen anderen tauschen.

  // Selection wires into the shared focus/detail flow: an ITEM node opens the
  // one detail panel every module shares; a PERSON node opens the profile
  // overlay (`?profile=`), the same surface every avatar in the app uses.
  // Spec 04 allows profiles as `type: "profile"` items — once a connector
  // projects them, person details can flow through the detail host instead.
  //
  // Item focus → person click: the old focus (and its panel) must go. Focus
  // and profile both write the URL, and two navigations in one tick race each
  // other's stale route state — so clear first, then open the profile from an
  // effect once the focus is really gone.
  const openProfile = useOpenProfile()
  const pendingProfileRef = useRef<string | null>(null)
  useEffect(() => {
    if (!focusedItemId && pendingProfileRef.current) {
      const userId = pendingProfileRef.current
      pendingProfileRef.current = null
      openProfile(userId)
    }
  }, [focusedItemId, openProfile])
  const onSelect = useCallback(
    (nodeId: string | null) => {
      // The node id carries its identity KIND (rls#248) — never guess from a
      // lookup, an item id and a user id may be the same string.
      const ref = nodeId ? graphNodeRef(nodeId) : null
      if (ref?.kind === "item") {
        focusItem(ref.id)
      } else if (ref?.kind === "user") {
        if (focusedItemId) {
          pendingProfileRef.current = ref.id
          clearFocus()
        } else {
          openProfile(ref.id)
        }
      } else if (!nodeId && focusedItemId) {
        clearFocus()
      }
    },
    [focusItem, openProfile, focusedItemId, clearFocus],
  )

  return (
    <div className="relative h-full w-full">
      <GraphView
      ref={graphRef}
      nodes={projection.nodes}
      edges={projection.edges}
      nodeTypes={projection.nodeTypes}
      selectedNodeId={focusedItemId ? graphItemNodeId(focusedItemId) : null}
      onSelectedNodeChange={onSelect}
      fitViewKey={groupId}
      className="h-full w-full"
      ariaLabel="Beziehungsgraph des Space"
      selectionFocusBottomInset={modulePanel.current ? 200 : 0}
      />
      {/* Wie in jedem anderen Modul: EIN Beitrag, verteilt wird er von der
          Flaeche (hier schwebend, weil der Graph seine Flaeche ist). */}
      <ModuleToolbar
      />
    </div>
  )
}
