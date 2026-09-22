import type { ReactNode } from "react"
import type { Item } from "@real-life-stack/data-interface"

import { FilterProvider } from "../components/filter/filter-store"
import { CreateHostProvider, CreateSheetController } from "../components/host/create-host"
import { DetailHostController, DetailHostProvider } from "../components/host/detail-host"
import { ModuleHost } from "../components/host/module-host"
import { ModulePanelProvider } from "../components/module-panel/module-panel"
import { MemoryFocusProvider } from "../hooks/use-item-focus"
import type { ModuleEntry } from "../lib/module-register"
import { STORY_SEED, StoryWorld } from "./story-world"

/** Ein Ort mit Koordinaten und eine Ressource — damit Hinweise etwas zu laden haben. */
export const PROBE_PLACE: Item = {
  id: "place-schuppen", type: "place", createdAt: "2026-09-03T10:00:00+02:00", createdBy: "jonas",
  data: { title: "Geräteschuppen", description: "Schlüssel hängt am Brett.", position: { type: "Point", coordinates: [13.41, 52.52] } },
}
export const PROBE_RESOURCE: Item = {
  id: "resource-schubkarre", type: "resource", createdAt: "2026-09-04T10:00:00+02:00", createdBy: "lea",
  data: { title: "Schubkarre", kind: "tool", availability: "im Schuppen" },
}
export const PROBE_SEED = {
  ...STORY_SEED,
  items: [...STORY_SEED.items, PROBE_PLACE, PROBE_RESOURCE],
  groupItems: { ...STORY_SEED.groupItems, garden: [...STORY_SEED.groupItems!.garden, PROBE_PLACE.id, PROBE_RESOURCE.id] },
}

/**
 * Der Host ueber einem einzelnen Eintrag, ohne Rahmen und Register — fuer die
 * Seiten, die zeigen, was der Host aus einem Eintrag herstellt. Was hier
 * steht, ist genau der Stapel, den `AppFrame` fuer alle Module stellt;
 * `HostWorld` zeigt den Rahmen als Ganzes, diese Welt einen Eintrag im
 * Ausschnitt.
 */
export function ProbeWorld({ entry, group = "garden", children }: { entry: ModuleEntry; group?: string; children?: ReactNode }) {
  return (
    <StoryWorld seed={PROBE_SEED} group={group}>
      <FilterProvider>
        <MemoryFocusProvider module={entry.id} scope={group}>
          <DetailHostProvider>
            <CreateHostProvider>
              <ModulePanelProvider allowedModes={["floating", "drawer"]}>
                <DetailHostController activeModule={entry.id} activeGroupId={group} />
                <CreateSheetController />
                <div className="relative h-full min-h-[32rem] w-full">
                  <ModuleHost entry={entry} groupId={group} active groups={PROBE_SEED.groups} />
                </div>
                {children}
              </ModulePanelProvider>
            </CreateHostProvider>
          </DetailHostProvider>
        </MemoryFocusProvider>
      </FilterProvider>
    </StoryWorld>
  )
}
