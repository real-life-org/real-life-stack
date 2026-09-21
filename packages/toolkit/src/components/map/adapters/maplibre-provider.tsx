"use client"

import { useCallback, type ReactNode } from "react"

import { MapAdapterProvider } from "../../../modules/map-module"
import { MapLibreMapAdapter } from "./maplibre"

/** Das Karten-Modul mit MapLibre als Engine. */
export function MapLibreAdapterProvider({ children }: { children: ReactNode }) {
  const createAdapter = useCallback(() => new MapLibreMapAdapter(), [])
  return <MapAdapterProvider createAdapter={createAdapter}>{children}</MapAdapterProvider>
}
