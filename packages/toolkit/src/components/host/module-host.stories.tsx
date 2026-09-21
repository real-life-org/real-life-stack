import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { MemoryFocusProvider } from "../../hooks/use-item-focus"
import { getModules } from "../../lib/module-register"
import { STORY_SEED, StoryWorld } from "../../story-support/story-world"
import { FilterProvider } from "../filter/filter-store"
import { AppShell, AppShellMain } from "../layout/app-shell"
import { ModuleTabs } from "../layout/module-tabs"
import { Navbar, NavbarCenter } from "../layout/navbar"
import { ModulePanelProvider } from "../module-panel/module-panel"
import { CreateHostProvider, CreateSheetController } from "./create-host"
import { DetailHostController, DetailHostProvider } from "./detail-host"
import { ModuleOutlet } from "./module-outlet"

/**
 * Der Modul-Host (Spec 01, „Der Modul-Host"): Register binden, Host rendern,
 * fertig. Diese Story enthält KEINE Zeile Modul-Verdrahtung — kein
 * `useItems`, kein `useRegisterDetail`, kein Plusknopf. Alles davon stellt
 * der Host aus dem Registereintrag her; die Story stellt nur, was eine App
 * stellt: Connector, Filter, Fokus, die zwei Host-Provider und das Panel.
 *
 * Kalender und Karte sind die ersten zwei Module, die so laufen. Die Karte
 * zeigt hier den Hinweis „Keine Karten-Engine gestellt": Die Engine ist die
 * eine Zeile, die eine App für die Karte schreibt (`MapLibreAdapterProvider`
 * aus `@real-life-stack/toolkit/maplibre`) — und sie fehlt hier mit Absicht,
 * damit man den Hinweis einmal gesehen hat.
 *
 * Klick auf den Termin: der Host öffnet das Detail im Panel, mit Bearbeiten.
 * Klick auf einen leeren Tag: Erstellen mit „Termin" vorgeschlagen und dem
 * Datum vorbelegt — das Typmenü bleibt offen. Der Plusknopf unten rechts:
 * derselbe Vorschlag, ohne Datum.
 */
function DerModulHost() {
  const [module, setModule] = useState("calendar")
  const space = STORY_SEED.groups[0]
  // Nur die Module, die heute eine Fläche im Toolkit haben.
  const modules = getModules().filter((m) => m.view)
  return (
    <StoryWorld>
      <FilterProvider>
        <MemoryFocusProvider module={module} scope={space.id} onModuleChange={setModule}>
          <DetailHostProvider>
            <CreateHostProvider>
              <AppShell>
                <Navbar>
                  <NavbarCenter>
                    <ModuleTabs modules={modules} activeModule={module} onModuleChange={setModule} />
                  </NavbarCenter>
                </Navbar>
                <ModulePanelProvider allowedModes={["floating", "drawer"]}>
                  <DetailHostController activeModule={module} activeGroupId={space.id} />
                  <CreateSheetController />
                  <AppShellMain>
                    <ModuleOutlet activeWorkspace={space} activeModule={module} groups={STORY_SEED.groups} />
                  </AppShellMain>
                </ModulePanelProvider>
              </AppShell>
            </CreateHostProvider>
          </DetailHostProvider>
        </MemoryFocusProvider>
      </FilterProvider>
    </StoryWorld>
  )
}

const meta: Meta<typeof DerModulHost> = {
  id: "rls-module-host",
  title: "RLS/Module/Der Modul-Host",
  component: DerModulHost,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof DerModulHost>

export const Default: Story = {}
