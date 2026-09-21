// Erweiterung der Referenz-App am Modul-Register (Spec 01, Regel 2).
//
// Das Toolkit definiert die Module. Kalender und Karte bringen ihre Flaeche
// aus dem Toolkit mit (B0, Schritt 5a); die uebrigen fuenf erweitert diese
// App noch um ihre Flaeche, bis sie je in einem eigenen Schritt umziehen.
//
// Einmal importieren, vor dem ersten Render (main.tsx).

import {
  TOOLKIT_DEFINITION,
  composeModules,
  setModuleRegistry,
  type ModuleViewProps,
} from "@real-life-stack/toolkit"
import { FeedView } from "./views/feed-view"
import { KanbanView } from "./views/kanban-view"
import { CollectionView } from "./views/collection-view"
import { ResonanceView } from "./views/resonance-view"
import { GraphViewWrapper } from "./views/graph-view"

const Feed = ({ groupId }: ModuleViewProps) => <FeedView groupId={groupId} />
const Resonance = ({ groupId }: ModuleViewProps) => <ResonanceView groupId={groupId} />
const Graph = ({ groupId }: ModuleViewProps) => <GraphViewWrapper groupId={groupId || "__overview__"} />
const Kanban = ({ groupId, groups }: ModuleViewProps) => (
  <KanbanView activeWorkspaceId={groupId || null} groups={[...(groups ?? [])]} />
)
const Collection = ({ groupId, selectionFocusVisibleArea }: ModuleViewProps) => (
  <CollectionView groupId={groupId} selectionFocusVisibleArea={selectionFocusVisibleArea} />
)

// Einmal komponiert, einmal gebunden, danach unveraenderlich (Spec 01, Regel 3).
export const MODULE_REGISTRY = composeModules([
  TOOLKIT_DEFINITION,
  { name: "app", extensions: [
    { id: "feed", view: Feed },
    { id: "kanban", view: Kanban },
    { id: "resonance", view: Resonance },
    { id: "collection", view: Collection },
    { id: "graph", view: Graph },
  ] },
])

setModuleRegistry(MODULE_REGISTRY)
