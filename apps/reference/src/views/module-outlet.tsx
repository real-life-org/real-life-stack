import { useNavigate } from "react-router-dom"
import { Button, ModuleOutlet as ToolkitModuleOutlet, type SelectionFocusVisibleArea, type Workspace } from "@real-life-stack/toolkit"
import type { Group } from "@real-life-stack/data-interface"

export interface ModuleOutletProps {
  activeWorkspace: Workspace | null
  activeModule: string
  groups: Group[]
  urlSpaceId?: string
  urlItemId?: string
  selectionFocusVisibleArea?: SelectionFocusVisibleArea
}

/**
 * Der Outlet lebt im Toolkit (B0, Schritt 5a). Die App steuert nur bei, was
 * ohne Zugang steht — denn nur sie weiss, wohin „zurueck" fuehrt.
 */
export function ModuleOutlet({ activeWorkspace, activeModule, groups, urlSpaceId, selectionFocusVisibleArea }: ModuleOutletProps) {
  const navigate = useNavigate()
  return (
    <ToolkitModuleOutlet
      activeWorkspace={activeWorkspace}
      activeModule={activeModule}
      groups={groups}
      urlSpaceId={urlSpaceId}
      selectionFocusVisibleArea={selectionFocusVisibleArea}
      noAccessContent={
        <div className="h-full overflow-y-auto container mx-auto px-4 pt-12 max-w-md text-center">
          <p className="text-lg font-medium text-foreground">Du bist kein Mitglied dieses Spaces</p>
          <p className="text-sm text-muted-foreground mt-2">Der Space existiert nicht oder du hast keinen Zugang.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>Zurück zur Übersicht</Button>
        </div>
      }
    />
  )
}
