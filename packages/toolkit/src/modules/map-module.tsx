"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { isWritable } from "@real-life-stack/data-interface"

import { useConnector } from "../hooks/connector-context"
import { useCurrentUser } from "../hooks/use-auth"
import { useDraftItem } from "../hooks/use-draft-item"
import { useGroups, useMembers, usePersonalGroupId } from "../hooks/use-groups"
import { useItem, useItems } from "../hooks/use-items"
import { useItemFocus } from "../hooks/use-item-focus"
import { useItemDetailEdit } from "../hooks/use-item-detail-edit"
import { useItemGroupColorResolver } from "../hooks/use-item-group-color"
import { useIsCompact } from "../hooks/use-mobile"
import { contentTypesFromRegister, mapComposerSubmission, withGroupOptions } from "../components/composer/content-types"
import { useCreate, useRegisterCreate, type CreateConfig } from "../components/host/create-host"
import { useRegisterDetail, type DetailConfig } from "../components/host/detail-host"
import { MapView } from "../components/map/map-view"
import type { MapAdapter } from "../components/map/adapter"
import { useModulePanel } from "../components/module-panel/module-panel"
import { ReactionBar } from "../components/reactions/reaction-bar"
import { getModule, type ModuleViewProps } from "../lib/module-register"

const AWAITING_VIEWPORT_FILTER = { hasField: ["__rls_awaiting_viewport__"] }
type Bounds = [number, number, number, number]

/**
 * Welche Karten-Engine das Modul benutzt. Die Engine ist ein optionaler Peer
 * (`maplibre-gl`, `leaflet`) und darf den Kern der Bibliothek nicht
 * betreten — darum stellt sie ein Provider aus dem jeweiligen Unterpfad:
 * `MapLibreAdapterProvider` aus `@real-life-stack/toolkit/maplibre`. Das ist
 * die eine Zeile, die eine App fuer die Karte schreibt, und sie sagt nur,
 * WELCHE Engine — nicht, wie das Modul funktioniert.
 */
const MapAdapterContext = createContext<(() => MapAdapter) | null>(null)

export function MapAdapterProvider({ createAdapter, children }: { createAdapter: () => MapAdapter; children: ReactNode }) {
  return <MapAdapterContext.Provider value={createAdapter}>{children}</MapAdapterContext.Provider>
}

function useMapAdapterFactory(): (() => MapAdapter) | null {
  return useContext(MapAdapterContext)
}

/**
 * Das Karten-Modul, vollstaendig aus dem Toolkit (Spec 01, Der Modul-Host).
 * `loads: "module"`: Die Karte laedt selbst, nach Kartenausschnitt — der Host
 * stellt keine Abfrage (Ladevertrag, Punkt 4). Bis zum 21.09.2026 stand diese
 * Verdrahtung als `MapView`-Wrapper in der Referenz-App.
 */
export function MapModule({ groupId, active = true }: ModuleViewProps) {
  const isOverview = groupId === "__overview__"
  const currentSpace = isOverview ? undefined : groupId
  const [bbox, setBbox] = useState<Bounds | undefined>()
  const { data: items, isLoading } = useItems(bbox ? { hasField: ["position"], bbox } : AWAITING_VIEWPORT_FILTER)
  const { itemId: focusedId, focusItem } = useItemFocus()
  const { data: focusedItem } = useItem(active ? (focusedId ?? "") : "")
  const panel = useModulePanel()
  const compact = useIsCompact()
  const draftItem = useDraftItem()
  const connector = useConnector()
  const { data: members } = useMembers(isOverview ? null : groupId)
  const { data: currentUser } = useCurrentUser()
  const { data: groups } = useGroups()
  const personalGroupId = usePersonalGroupId()
  const resolveGroupColor = useItemGroupColorResolver(currentSpace)
  const editConfig = useItemDetailEdit(members)
  const { startCreate } = useCreate()
  const createAdapter = useMapAdapterFactory()
  const options = getModule("map")?.options
  const initialView = (options?.initialView as { center: [number, number]; zoom: number } | undefined) ?? { center: [13.4, 52.5], zoom: 6 }

  const createConfig = useMemo<CreateConfig>(() => ({
    contentTypes: withGroupOptions(contentTypesFromRegister(), groups, currentSpace, personalGroupId),
    mapper: mapComposerSubmission,
    composerProps: editConfig.composerProps,
    shell: "sheet",
  }), [editConfig.composerProps, groups, currentSpace, personalGroupId])
  useRegisterCreate("map", createConfig)

  const detailConfig = useMemo<DetailConfig>(() => ({
    ...editConfig,
    renderCommentReactions: (id) => <ReactionBar itemId={id} />,
    onShare: () => void navigator.clipboard?.writeText(window.location.href),
    // Der Hintergrund-Schleier folgt aus panelFit: ueber der Karte keiner, sie bleibt bewegbar.
    backdrop: false,
  }), [editConfig])
  useRegisterDetail("map", detailConfig)

  // Vorschlag, kein Zaun: Der Plusknopf der Karte schlaegt „Ort" vor, das Typmenue bleibt offen.
  const onCreate = useCallback(() => startCreate("place"), [startCreate])
  void currentUser

  if (!createAdapter) {
    // Sichtbar sagen statt leer (Spec 01, Regel 7): Ohne Engine gibt es keine
    // Karte — die App stellt sie mit einer Zeile aus dem Unterpfad.
    return (
      <div className="h-full overflow-y-auto container mx-auto px-4 pt-12 max-w-md text-center">
        <p className="text-lg font-medium text-foreground">Karte</p>
        <p className="text-sm text-muted-foreground mt-2">
          Keine Karten-Engine gestellt. Eine App setzt <code>MapLibreAdapterProvider</code> aus <code>@real-life-stack/toolkit/maplibre</code> um ihre Shell.
        </p>
      </div>
    )
  }
  return (
    <MapView
      items={items}
      itemsLoading={isLoading}
      inventoryKey={groupId}
      focusedItem={focusedItem}
      createAdapter={createAdapter}
      initialView={initialView}
      viewportMode="bbox-module"
      onViewportBoundsChange={setBbox}
      active={active}
      activeItemId={panel.current?.itemId}
      isCompact={compact}
      draftItem={draftItem}
      onItemClick={(item) => focusItem(item.id)}
      allowCreate={isWritable(connector)}
      onCreate={isWritable(connector) ? onCreate : undefined}
      clustering={{}}
      resolveGroupColor={resolveGroupColor}
    />
  )
}
