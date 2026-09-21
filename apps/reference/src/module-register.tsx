// Erweiterung der Referenz-App am Modul-Register (Spec 01, Regel 2).
//
// Das Toolkit definiert die Module. Feed, Kalender und Karte bringen ihre
// Flaeche aus dem Toolkit mit (B0, B1); die uebrigen vier erweitert diese
// App noch um ihre Flaeche, bis sie je in einem eigenen Schritt umziehen
// (B2–B5). Eine Flaeche des Toolkits ERSETZEN darf sie auch — dann mit
// `replaces: ["view"]` am Fragment (Spec 01, Regel 2).
//
// Einmal importieren, vor dem ersten Render (main.tsx).

import {
  TOOLKIT_DEFINITION,
  composeModules,
  setModuleRegistry,
  type ModuleViewProps,
} from "@real-life-stack/toolkit"
import { KanbanView } from "./views/kanban-view"
import { CollectionView } from "./views/collection-view"
import { ResonanceView } from "./views/resonance-view"
import { GraphViewWrapper } from "./views/graph-view"

// Die Ansichten lesen Items und Kontext vom Host (Spec 01, Der Modul-Host);
// Detail, Erstellen und Plusknopf stellt er selbst.
const Resonance = (p: ModuleViewProps) => <ResonanceView {...p} />
const Graph = ({ groupId, items }: ModuleViewProps) => <GraphViewWrapper groupId={groupId || "__overview__"} items={items} />
const Kanban = ({ groupId, groups, items, itemsLoading }: ModuleViewProps) => (
  <KanbanView activeWorkspaceId={groupId || null} groups={[...(groups ?? [])]} items={items} itemsLoading={itemsLoading} />
)
const Collection = ({ items, selectionFocusVisibleArea }: ModuleViewProps) => (
  <CollectionView items={items} selectionFocusVisibleArea={selectionFocusVisibleArea} />
)

// Einmal komponiert, einmal gebunden, danach unveraenderlich (Spec 01, Regel 3).
export const MODULE_REGISTRY = composeModules([
  TOOLKIT_DEFINITION,
  { name: "app", extensions: [
    { id: "kanban", view: Kanban },
    { id: "resonance", view: Resonance },
    { id: "collection", view: Collection },
    { id: "graph", view: Graph },
  ] },
])

setModuleRegistry(MODULE_REGISTRY)
