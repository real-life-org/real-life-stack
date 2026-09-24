import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { hasGroups, type Group } from "@real-life-stack/data-interface"

import { AppFrame, type FrameRouting } from "../components/frame/app-frame"
import { MapLibreAdapterProvider } from "../components/map/adapters/maplibre-provider"
import { workspaceOf } from "../components/layout/workspace-switcher"
import { useConnector } from "../hooks/connector-context"
import { MemoryFocusProvider, useItemFocus } from "../hooks/use-item-focus"
import { getModule, getModules, resolveSpaceModules } from "../lib/module-register"
import { STORY_SEED, StoryWorld, type StoryWorldOptions } from "./story-world"

/**
 * Was eine App fuer den Modul-Host stellt — und sonst nichts: Connector,
 * Fokus (hier im Speicher) und den Rahmen `AppFrame`. Die Module darin kommen
 * vollstaendig aus dem Register (Spec 01, Der Modul-Host). Eine Story, die
 * ein Modul zeigt, zeigt es HIER — nicht als Nachbau aus Bausteinen. Und weil
 * es derselbe Rahmen wie in den Apps ist, kann eine Story nicht mehr von der
 * App abweichen (bis zum 21.09.2026 war sie eine dritte, kleinere Fassung).
 */
/**
 * Der aktive Space und die Gruppenliste kommen aus DERSELBEN Konfiguration wie
 * der Connector (`seed`, `group`) — sonst steht der Connector auf einem Space
 * und Fokus, Host-Kontext und Outlet auf einem anderen (rls#423).
 */
export function hostWorldSpace(options: StoryWorldOptions): { groups: Group[]; space: Group } {
  const groups = options.seed?.groups ?? STORY_SEED.groups
  const gewuenscht = options.group ?? "garden"
  const space = groups.find((g) => g.id === gewuenscht) ?? groups[0]
  return { groups, space }
}

/**
 * Die Welt einer App-Story: Connector, Fokus im Speicher, Rahmen — und die
 * Karten-Engine, die jede App um ihre Shell legt (`MapLibreAdapterProvider`).
 * `mapEngine={false}` lässt sie weg, für die eine Story, die den Hinweis
 * „keine Karten-Engine gestellt" zeigen soll.
 */
export function HostWorld({ module: start, children, mapEngine = true, ...options }: StoryWorldOptions & { module: string; mapEngine?: boolean; children?: ReactNode }) {
  const [module, setModule] = useState(start)
  const { groups, space: startSpace } = hostWorldSpace(options)
  const [spaceId, setSpaceId] = useState(startSpace.id)
  const frame = (
    <MemoryFocusProvider module={module} scope={spaceId} onModuleChange={setModule}>
      <MemoryFrame groups={groups} spaceId={spaceId} onSpaceChange={setSpaceId} module={module} onModuleChange={setModule}>
        {children}
      </MemoryFrame>
    </MemoryFocusProvider>
  )
  return (
    <StoryWorld {...options}>
      {mapEngine ? <MapLibreAdapterProvider>{frame}</MapLibreAdapterProvider> : frame}
    </StoryWorld>
  )
}

/** Das Routing im Speicher: dieselbe Auskunft, die `useWorkspaceRouting` aus der URL zieht. */
function MemoryFrame({ groups, spaceId, onSpaceChange, module, onModuleChange, children }: {
  groups: Group[]; spaceId: string; onSpaceChange: (id: string) => void
  module: string; onModuleChange: (id: string) => void; children?: ReactNode
}) {
  const connector = useConnector()
  const { focusItem } = useItemFocus()
  const focusRef = useRef(focusItem)
  focusRef.current = focusItem
  // Fuehrt der Space seine Module (`data.modules`), gelten sie wie in der App
  // (resolveSpaceModules). Sonst alle Module mit Flaeche, damit eine Story
  // jedes zeigen kann, ohne es in den Seed zu schreiben.
  const stored = groups.find((g) => g.id === spaceId)?.data?.modules as string[] | undefined
  const modules = useMemo(() => {
    const ids = stored ? resolveSpaceModules(stored) : getModules().filter((m) => m.view).map((m) => m.id)
    return ids.map(getModule).filter((m): m is NonNullable<typeof m> => !!m).map((m) => ({ id: m.id, label: m.label, icon: m.icon }))
  }, [stored])
  const workspaces = useMemo(() => groups.map(workspaceOf), [groups])
  const activeWorkspace = workspaces.find((w) => w.id === spaceId) ?? null
  const handleWorkspaceChange = useCallback((w: { id: string }) => {
    if (hasGroups(connector)) connector.setCurrentGroup(w.id)
    onSpaceChange(w.id)
  }, [connector, onSpaceChange])
  const routing = useMemo<FrameRouting>(() => ({
    groups, workspaces, activeWorkspace, activeModule: module, modules,
    handleWorkspaceChange,
    handleModuleChange: (id) => onModuleChange(id),
    goTo: ({ groupId, module: ziel, itemId }) => {
      if (groupId !== spaceId) handleWorkspaceChange({ id: groupId })
      onModuleChange(ziel)
      focusRef.current(itemId, ziel)
    },
    goHome: () => handleWorkspaceChange({ id: groups[0].id }),
  }), [groups, workspaces, activeWorkspace, module, modules, handleWorkspaceChange, onModuleChange, spaceId])
  return <AppFrame routing={routing}>{children}</AppFrame>
}
