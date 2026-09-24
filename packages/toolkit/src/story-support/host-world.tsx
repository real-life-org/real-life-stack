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
/**
 * Die Module eines Space in der Story-Welt: fuehrt er `data.modules`, gelten
 * sie wie in der App (`resolveSpaceModules`); sonst alle Module mit Flaeche,
 * damit eine Story jedes zeigen kann, ohne es in den Seed zu schreiben.
 */
export function hostWorldModules(groups: readonly Group[], spaceId: string): string[] {
  const stored = groups.find((g) => g.id === spaceId)?.data?.modules as string[] | undefined
  return stored ? resolveSpaceModules(stored) : getModules().filter((m) => m.view).map((m) => m.id)
}

/** Das aktive Modul nach einem Space-Wechsel: bleibt, wenn der neue Space es fuehrt, sonst sein erstes (wie `resolveActiveModule`). */
export function hostWorldModuleFor(groups: readonly Group[], spaceId: string, candidate: string): string {
  const available = hostWorldModules(groups, spaceId)
  return available.includes(candidate) ? candidate : available[0]
}

/**
 * Welche Spaces der Wechsler anbietet: alle, wenn der Connector Gruppen kann;
 * sonst nur den aktiven. Ohne die Faehigkeit kann niemand den Space wechseln
 * (`setCurrentGroup` fehlt) — ein Wechsler, der es trotzdem anbietet, zeigt
 * danach die alten Daten unter neuem Namen (Codex-Befund zu rls#477).
 */
export function hostWorldGroups(canSwitch: boolean, groups: readonly Group[], spaceId: string): Group[] {
  return canSwitch ? [...groups] : groups.filter((g) => g.id === spaceId)
}

export function HostWorld({ module: start, children, mapEngine = true, ...options }: StoryWorldOptions & { module: string; mapEngine?: boolean; children?: ReactNode }) {
  const { groups, space: startSpace } = hostWorldSpace(options)
  const [spaceId, setSpaceId] = useState(startSpace.id)
  const [module, setModule] = useState(() => hostWorldModuleFor(groups, startSpace.id, start))
  // Beim Space-Wechsel bleibt ein Modul nur aktiv, wenn der neue Space es fuehrt (Codex-Befund zu rls#477).
  const changeSpace = useCallback((id: string) => {
    setSpaceId(id)
    setModule((current) => hostWorldModuleFor(groups, id, current))
  }, [groups])
  const frame = (
    <MemoryFocusProvider module={module} scope={spaceId} onModuleChange={setModule}>
      <MemoryFrame groups={groups} spaceId={spaceId} onSpaceChange={changeSpace} module={module} onModuleChange={setModule}>
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
function MemoryFrame({ groups: allGroups, spaceId, onSpaceChange, module, onModuleChange, children }: {
  groups: Group[]; spaceId: string; onSpaceChange: (id: string) => void
  module: string; onModuleChange: (id: string) => void; children?: ReactNode
}) {
  const connector = useConnector()
  const { focusItem } = useItemFocus()
  const focusRef = useRef(focusItem)
  focusRef.current = focusItem
  const modules = useMemo(
    () => hostWorldModules(allGroups, spaceId).map(getModule).filter((m): m is NonNullable<typeof m> => !!m).map((m) => ({ id: m.id, label: m.label, icon: m.icon })),
    [allGroups, spaceId],
  )
  const groups = useMemo(() => hostWorldGroups(hasGroups(connector), allGroups, spaceId), [connector, allGroups, spaceId])
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
