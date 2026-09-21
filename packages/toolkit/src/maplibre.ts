/**
 * Subpath entry for the MapLibre GL map adapter.
 *
 * Import via:
 *   import { MapLibreMapAdapter } from "@real-life-stack/toolkit/maplibre"
 *
 * This entry is intentionally separate from the main toolkit entry so that
 * `maplibre-gl` stays an optional peer dependency: consumers that never use
 * the vector map do not pull maplibre-gl into their dependency graph or bundle.
 */

export { MapLibreMapAdapter, prefetchMapLibre } from "./components/map/adapters/maplibre"

/**
 * Stellt dem Karten-Modul die MapLibre-Engine — die eine Zeile, die eine App
 * fuer die Karte schreibt (Spec 01, Der Modul-Host). Lebt hier und nicht im
 * Kern, damit `maplibre-gl` ein optionaler Peer bleibt.
 */
export { MapLibreAdapterProvider } from "./components/map/adapters/maplibre-provider"
