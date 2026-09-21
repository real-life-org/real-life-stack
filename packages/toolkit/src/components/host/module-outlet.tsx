"use client"

import { useEffect, useState, type ReactNode } from "react"
import type { Group } from "@real-life-stack/data-interface"

import { getModule, getModules } from "../../lib/module-register"
import type { SelectionFocusVisibleArea } from "../../lib/selection-focus"
import { ModuleFrame } from "../layout/module-frame"

export interface ModuleOutletProps {
  /** Der aktive Space; `null` heisst: die URL nennt einen Space ohne Zugang. */
  activeWorkspace: { id: string; name: string } | null
  activeModule: string
  groups: readonly Group[]
  /** Nennt die URL einen Space? Zusammen mit `activeWorkspace === null` ergibt das „kein Zugang". */
  urlSpaceId?: string
  selectionFocusVisibleArea?: SelectionFocusVisibleArea
  /** Was ohne Zugang steht — die App sagt es, weil nur sie weiss, wohin „zurueck" fuehrt. */
  noAccessContent?: ReactNode
}

/**
 * Rendert das aktive Modul fuer den aktiven Space. Reiner Dispatch ueber das
 * Register (Spec 01, Regel 1) — kennt kein Modul beim Namen. Bis zum
 * 21.09.2026 in der Referenz-App.
 */
export function ModuleOutlet({ activeWorkspace, activeModule, groups, urlSpaceId, selectionFocusVisibleArea, noAccessContent }: ModuleOutletProps) {
  const noAccess = !!urlSpaceId && !activeWorkspace
  const groupId = activeWorkspace?.id ?? ""

  // `keepMounted`-Module (die Karte: WebGL, Worker, Style) werden beim ersten
  // Besuch angelegt und danach nur versteckt, nicht abgebaut.
  const [visited, setVisited] = useState<string[]>(() => (noAccess ? [] : [activeModule]))
  useEffect(() => {
    if (noAccess) return
    setVisited((prev) => (prev.includes(activeModule) ? prev : [...prev, activeModule]))
  }, [activeModule, noAccess])

  const persistent = getModules().filter((m) => m.keepMounted && visited.includes(m.id))
  const active = getModule(activeModule)
  const activeIsPersistent = !!active?.keepMounted

  // Die Suche gehoert der Flaeche und zieht sich durch alle Module (Spec 01,
  // Regel 2a). Ihre Beschriftung nennt darum den Space, nicht das Modul.
  const searchLabel = activeWorkspace ? `In ${activeWorkspace.name} suchen` : undefined
  const wrap = (id: string, node: ReactNode) => (
    <ModuleFrame moduleId={id} searchLabel={searchLabel}>{node}</ModuleFrame>
  )

  return (
    <>
      {persistent.map((mod) => {
        const View = mod.view
        if (!View) return null
        const isActive = mod.id === activeModule && !noAccess
        return (
          <div key={mod.id} className="h-full w-full" style={isActive ? undefined : { display: "none" }}>
            {wrap(mod.id, <View groupId={groupId} active={isActive} groups={groups} selectionFocusVisibleArea={selectionFocusVisibleArea} />)}
          </div>
        )
      })}

      {noAccess ? (
        noAccessContent ?? (
          <div className="h-full overflow-y-auto container mx-auto px-4 pt-12 max-w-md text-center">
            <p className="text-lg font-medium text-foreground">Kein Zugang zu diesem Space</p>
          </div>
        )
      ) : activeIsPersistent ? null : active?.view ? (
        wrap(active.id, <active.view groupId={groupId} active groups={groups} selectionFocusVisibleArea={selectionFocusVisibleArea} />)
      ) : active ? (
        // Registriert, aber ohne Flaeche — sichtbar sagen statt leer (Spec 01, Regel 7).
        <div className="h-full overflow-y-auto container mx-auto px-4 pt-12 max-w-md text-center">
          <p className="text-lg font-medium text-foreground">{active.label}</p>
          <p className="text-sm text-muted-foreground mt-2">Fuer dieses Modul ist keine Ansicht hinterlegt.</p>
        </div>
      ) : null}
    </>
  )
}
