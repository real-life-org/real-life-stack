import { useState, type ReactNode } from "react"

import { CreateHostProvider, CreateSheetController } from "../components/host/create-host"
import { DetailHostController, DetailHostProvider } from "../components/host/detail-host"
import { ModuleOutlet } from "../components/host/module-outlet"
import { FilterProvider } from "../components/filter/filter-store"
import { AppShell, AppShellMain } from "../components/layout/app-shell"
import { ModuleTabs } from "../components/layout/module-tabs"
import { Navbar, NavbarCenter } from "../components/layout/navbar"
import { ModulePanelProvider } from "../components/module-panel/module-panel"
import { MemoryFocusProvider } from "../hooks/use-item-focus"
import { getModules } from "../lib/module-register"
import { STORY_SEED, StoryWorld, type StoryWorldOptions } from "./story-world"

/**
 * Was eine App fuer den Modul-Host stellt — und sonst nichts: Connector,
 * Filter, Fokus, die zwei Host-Provider, das Panel. Die Module darin kommen
 * vollstaendig aus dem Register (Spec 01, Der Modul-Host). Eine Story, die
 * ein Modul zeigt, zeigt es HIER — nicht als Nachbau aus Bausteinen.
 */
export function HostWorld({ module: start, children, ...options }: StoryWorldOptions & { module: string; children?: ReactNode }) {
  const [module, setModule] = useState(start)
  const space = STORY_SEED.groups[0]
  const modules = getModules().filter((m) => m.view)
  return (
    <StoryWorld {...options}>
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
                  {children}
                </ModulePanelProvider>
              </AppShell>
            </CreateHostProvider>
          </DetailHostProvider>
        </MemoryFocusProvider>
      </FilterProvider>
    </StoryWorld>
  )
}
