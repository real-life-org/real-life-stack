// Erweiterung der Referenz-App am Modul-Register (Spec 01, Regel 2).
//
// Das Toolkit definiert die Module. Alle ausser dem Kanban bringen ihre
// Flaeche aus dem Toolkit mit (B0–B4); das Kanban erweitert diese App noch
// um seine Flaeche, bis es umzieht (B5). Eine Flaeche des Toolkits ERSETZEN darf sie auch — dann mit
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

// Die Ansichten lesen Items und Kontext vom Host (Spec 01, Der Modul-Host);
// Detail, Erstellen und Plusknopf stellt er selbst.
const Kanban = ({ groupId, groups, items, itemsLoading }: ModuleViewProps) => (
  <KanbanView activeWorkspaceId={groupId || null} groups={[...(groups ?? [])]} items={items} itemsLoading={itemsLoading} />
)

// Einmal komponiert, einmal gebunden, danach unveraenderlich (Spec 01, Regel 3).
export const MODULE_REGISTRY = composeModules([
  TOOLKIT_DEFINITION,
  { name: "app", extensions: [
    { id: "kanban", view: Kanban },
  ] },
])

setModuleRegistry(MODULE_REGISTRY)
