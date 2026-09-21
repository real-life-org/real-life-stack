"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"

import { useItemFocus } from "../hooks/use-item-focus"
import { useItemGroupResolver } from "../hooks/use-item-group-color"
import { useOpenProfile } from "../hooks/use-open-profile"
import { useRelationRecords } from "../hooks/use-relation-records"
import { GraphView } from "../components/graph/graph-view"
import { graphItemNodeId, graphNodeRef, projectSpaceGraph } from "../components/graph/project-space-graph"
import type { GraphViewHandle } from "../components/graph/types"
import { useModuleHost } from "../components/host/module-host"
import { useOptionalModulePanel } from "../components/module-panel/module-panel"
import { resolveTypePresentation } from "../components/preview/type-presentation"
import type { ModuleViewProps } from "../lib/module-register"

/**
 * Das Graph-Modul, vollstaendig aus dem Toolkit (Spec 01, Der Modul-Host;
 * B3, 21.09.2026 — bis dahin `GraphViewWrapper` in der Referenz-App): die
 * Items des Space und ihre Beziehungen als Kraftgraph.
 *
 * Knoten sind die Items, die als eigene Karte stehen (das begrenzt der Host
 * fuer jedes aggregierende Modul), plus die MENSCHEN, auf die Kanten zeigen
 * (`global:`-Ziele, aufgeloest ueber die Mitglieder). Kanten kommen aus den
 * zwei Mechanismen von Spec 04: eingebettete Relationen (`item.relations[]`,
 * etwa task --assignedTo--> user) und Relation Records (Items vom Typ
 * `relation` mit `from`/`to`, etwa votesOn).
 *
 * Knotenfarben kommen aus dem Typ-Register — der Graph fuehrt keine fuenfte
 * Typliste. Suche, Tags und Typen hat der Host schon angewendet; die Leiste
 * schwebt hier ueber der Flaeche statt in einem Kopf (`panelFit: "overlay"`).
 */
export function GraphModule({ items = [] }: ModuleViewProps) {
  const { groupId, members } = useModuleHost()
  const { data: records } = useRelationRecords()
  const { focusItem, itemId: focusedItemId, clearFocus } = useItemFocus()
  const panel = useOptionalModulePanel()
  const graphRef = useRef<GraphViewHandle>(null)

  const resolveLabel = useCallback((typeId: string) => resolveTypePresentation(typeId).label, [])

  // Der Heimat-Space eines Items laut Connector — um space-qualifizierte
  // Relationsziele (`space:B/item:x`) gegen Id-Kollisionen zu pruefen.
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

  // Auswahl haengt am geteilten Fokus: Ein ITEM-Knoten oeffnet das eine
  // Detail-Panel aller Module; ein PERSON-Knoten das Profil-Overlay
  // (`?profile=`), dieselbe Flaeche wie jeder Avatar der App.
  //
  // Item-Fokus → Klick auf eine Person: Der alte Fokus (und sein Panel) muss
  // erst weg. Fokus und Profil schreiben beide die URL, und zwei Navigationen
  // in einem Tick ueberholen sich — darum erst loesen, dann das Profil aus
  // einem Effekt oeffnen, wenn der Fokus wirklich weg ist.
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
      // Die Knoten-Id traegt ihre IdentitaetsART (rls#248) — nie raten, eine
      // Item-Id und eine User-Id koennen derselbe String sein.
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
    <GraphView
      ref={graphRef}
      nodes={projection.nodes}
      edges={projection.edges}
      nodeTypes={projection.nodeTypes}
      selectedNodeId={focusedItemId ? graphItemNodeId(focusedItemId) : null}
      onSelectedNodeChange={onSelect}
      fitViewKey={groupId || "__overview__"}
      className="h-full w-full"
      ariaLabel="Beziehungsgraph des Space"
      selectionFocusBottomInset={panel?.current ? 200 : 0}
    />
  )
}
