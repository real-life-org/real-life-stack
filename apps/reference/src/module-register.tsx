// Das Modul-Register der Referenz-App (Spec 01, Regel 2).
//
// Seit dem 21.09.2026 (B0–B5) bringt jedes Toolkit-Modul seine Flaeche
// selbst mit: Die App erweitert hier nichts mehr. Sie komponiert trotzdem —
// einmal, vor dem ersten Render (main.tsx) —, damit klar ist, WO eine App
// eigene Module einfuehrt (`definitions`) oder eine Toolkit-Flaeche
// ausdruecklich ersetzt (`extensions` mit `replaces: ["view"]`).

import { TOOLKIT_DEFINITION, composeModules, setModuleRegistry } from "@real-life-stack/toolkit"

// Einmal komponiert, einmal gebunden, danach unveraenderlich (Spec 01, Regel 3).
export const MODULE_REGISTRY = composeModules([
  TOOLKIT_DEFINITION,
  { name: "app", definitions: [], extensions: [] },
])

setModuleRegistry(MODULE_REGISTRY)
