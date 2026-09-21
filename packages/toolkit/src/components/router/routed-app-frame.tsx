"use client"

import { useCallback, useMemo, type ReactNode } from "react"
import { Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom"

import { AppFrame, type AppFrameProps, type FrameOverlayId, type FrameRouting } from "../frame/app-frame"
import { UnsavedChangesGuard } from "./unsaved-changes-guard"
import { UrlFocusProvider } from "./url-focus"
import { STORAGE_KEY_GROUP, scopeToSlug, useWorkspaceRouting } from "./workspace-routing"

export interface RoutedAppFrameProps extends Omit<AppFrameProps, "routing"> {
  /** Was ausserhalb der Modulflaeche, aber unter allen Providern steht — wie `children`. */
  children?: ReactNode
}

const OVERLAY_IDS = new Set<FrameOverlayId>(["contacts", "verify"])

/**
 * Der Rahmen einer App MIT Router: Fokus in der URL, Space/Modul/Item aus der
 * URL, Overlay-Ebenen als `?dialog=`-Back-Stack, der Guard vor Entwurfsverlust
 * — um den routerfreien `AppFrame` gelegt. Die Routen sind das flache Schema
 * `/{scope}/{modul}/{item}`; die App schreibt keine mehr.
 */
export function RoutedAppFrame(props: RoutedAppFrameProps) {
  return (
    <UrlFocusProvider>
      <Routes>
        <Route path=":scope/:seg/:itemId" element={<RoutedFrame {...props} />} />
        <Route path=":scope/:seg" element={<RoutedFrame {...props} />} />
        <Route path=":scope" element={<RoutedFrame {...props} />} />
        <Route path="*" element={<RoutedFrame {...props} />} />
      </Routes>
    </UrlFocusProvider>
  )
}

function RoutedFrame({ children, fallbackModule, ...rest }: RoutedAppFrameProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const routing = useWorkspaceRouting({ fallbackModule })

  // Overlay-Ebenen im ?dialog=-Query (Komma-Liste, letztes = oben). Oeffnen
  // pusht einen Verlaufseintrag; Schliessen und Browser-Zurueck poppen eine
  // Ebene. Nur In-App-Pushes haben einen echten Eintrag (`rlsDialogPush`);
  // ein Deep-Link schliesst per replace, ohne die App zu verlassen.
  const stack = useMemo<FrameOverlayId[]>(
    () => (searchParams.get("dialog")?.split(",") ?? []).filter((x): x is FrameOverlayId => OVERLAY_IDS.has(x as FrameOverlayId)),
    [searchParams],
  )
  const overlay = useMemo<NonNullable<FrameRouting["overlay"]>>(() => ({
    top: stack[stack.length - 1] ?? null,
    open: (id) => {
      const next = [...stack.filter((x) => x !== id), id]
      const params = new URLSearchParams(searchParams)
      params.set("dialog", next.join(","))
      const prev = (typeof location.state === "object" && location.state) || {}
      setSearchParams(params, { state: { ...prev, rlsDialogPush: true } })
    },
    pop: () => {
      const pushed = (location.state as { rlsDialogPush?: boolean } | null)?.rlsDialogPush
      if (pushed) { navigate(-1); return }
      const next = stack.slice(0, -1)
      const params = new URLSearchParams(searchParams)
      if (next.length > 0) params.set("dialog", next.join(","))
      else params.delete("dialog")
      setSearchParams(params, { replace: true })
    },
  }), [location.state, navigate, searchParams, setSearchParams, stack])

  const goTo = useCallback((target: { groupId: string; module: string; itemId: string }) => {
    navigate(`/${scopeToSlug(target.groupId)}/${target.module}/${target.itemId}`)
  }, [navigate])
  const goHome = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_GROUP)
    navigate("/")
  }, [navigate])

  const frameRouting = useMemo<FrameRouting>(() => ({ ...routing, goTo, goHome, overlay }), [routing, goTo, goHome, overlay])

  return (
    <AppFrame routing={frameRouting} fallbackModule={fallbackModule} {...rest}>
      <UnsavedChangesGuard />
      {children}
    </AppFrame>
  )
}
