import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { hasGroups, type Group } from "@real-life-stack/data-interface"

import { AppFrame, type FrameRouting } from "../components/frame/app-frame"
import { useConnector } from "../hooks/connector-context"
import { MemoryFocusProvider, useItemFocus } from "../hooks/use-item-focus"
import { getModules } from "../lib/module-register"
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

export function HostWorld({ module: start, children, ...options }: StoryWorldOptions & { module: string; children?: ReactNode }) {
  const [module, setModule] = useState(start)
  const { groups, space: startSpace } = hostWorldSpace(options)
  const [spaceId, setSpaceId] = useState(startSpace.id)
  return (
    <StoryWorld {...options}>
      <MemoryFocusProvider module={module} scope={spaceId} onModuleChange={setModule}>
        <MemoryFrame groups={groups} spaceId={spaceId} onSpaceChange={setSpaceId} module={module} onModuleChange={setModule}>
          {children}
        </MemoryFrame>
      </MemoryFocusProvider>
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
  // Alle Module mit Flaeche — eine Story soll jedes zeigen koennen, unabhaengig
  // davon, was der Space speichert.
  const modules = useMemo(() => getModules().filter((m) => m.view).map((m) => ({ id: m.id, label: m.label, icon: m.icon })), [])
  const workspaces = useMemo(() => groups.map((g) => ({ id: g.id, name: g.name, primaryColor: typeof g.data?.primaryColor === "string" ? g.data.primaryColor : undefined })), [groups])
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
