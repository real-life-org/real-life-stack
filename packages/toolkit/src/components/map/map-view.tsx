import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Item } from "@real-life-stack/data-interface"
import { Calendar, Loader2, MapPin } from "lucide-react"

import { latLngFromPoint } from "../../lib/geo"
import { useSharedFilter, type FilterBarValue, type FilterTypeOption } from "../filter"
import { CreateFab } from "../create-fab"
import { StandortIcon } from "./standort-icon"
import { PanelSafeArea } from "../layout/panel-safe-area"
import { ModuleToolbar } from "../layout/module-toolbar"
import { ModuleSurfaceScope } from "../layout/module-surface-scope"
import { Button } from "../primitives"
import { focusNeedsRecentering, focusOffsetFor, type MapFocusInsets } from "./focus-offset"
import { usePanelEdges, type PanelEdges } from "../layout/panel-edges"
import { MapLens } from "../lens/map-lens"
import type { SelectionFocusVisibleArea } from "../../lib/selection-focus"
import { cn, getSpacePrimaryColor } from "../../lib/utils"
import { hasViewportPadding, hasGlobe, hasUserPosition, hasUserGesture, type MapAdapter, type MapBounds, type MapMountOptions, type MapProjection } from "./adapter"
import { useLocationPick } from "./location-pick"

const MAP_TYPES: FilterTypeOption[] = [
  { id: "event", label: "Events", icon: Calendar },
  { id: "place", label: "Orte", icon: MapPin },
]
const PICK_MARKER_ID = "__rls_pick__"
const PICK_MARKER_COLOR = "#ef4444"
const MAP_SHEET_FRACTION = .55
const MIN_REVEAL_ZOOM = 10
const REVEAL_SEPARATION_PX = 64
const MERCATOR_TILE_SIZE = 512
const EARTH_CIRCUMFERENCE_M = 40075016.686

export type MapViewportMode = "lens-auto-fit" | "bbox-module"
export interface MapViewProps {
  items: readonly Item[]
  itemsLoading: boolean
  inventoryKey: string | number
  focusedItem?: Item | null
  createAdapter: () => MapAdapter
  initialView: MapMountOptions
  viewportMode: MapViewportMode
  onViewportBoundsChange?: (bounds: [number, number, number, number]) => void
  active?: boolean
  activeItemId?: string
  selectionFocusVisibleArea?: SelectionFocusVisibleArea
  onItemClick?: (item: Item) => void
  /** The app passes this only when its connector is an ItemWriter. */
  allowCreate?: boolean
  onCreate?: () => void
  clustering?: false | { radius?: number }
  resolveGroupColor?: (item: Item) => string | undefined
  /** A shell-owned composer draft is shown as a non-clickable marker when positioned. */
  draftItem?: Item | null
  isCompact?: boolean
}

function inBounds(item: Item, bounds: [number, number, number, number]) {
  const point = latLngFromPoint(item.data.position)
  if (!point) return false
  const [west, south, east, north] = bounds
  return point.lat >= south && point.lat <= north && (west <= east ? point.lng >= west && point.lng <= east : point.lng >= west || point.lng <= east)
}

/**
 * Reconcile map inventory according to the viewport owner's data contract.
 * Bbox pages are incremental, while a lens receives its complete marker set.
 */
export function reconcileMapInventory(
  previous: ReadonlyMap<string, Item>,
  items: readonly Item[],
  itemsLoading: boolean,
  bounds: [number, number, number, number] | null,
  viewportMode: MapViewportMode,
): Map<string, Item> {
  if (viewportMode === "lens-auto-fit") return new Map(items.map((item) => [item.id, item]))

  const next = new Map(previous)
  if (bounds && !itemsLoading) {
    const ids = new Set(items.map(({ id }) => id))
    for (const [id, item] of next) if (!ids.has(id) && inBounds(item, bounds)) next.delete(id)
  }
  for (const item of items) next.set(item.id, item)
  return next
}

/** A key change starts a new inventory but immediately reconciles the current props. */
export function reconcileMapInventoryForKey(
  previousKey: string | number,
  inventoryKey: string | number,
  previous: ReadonlyMap<string, Item>,
  items: readonly Item[],
  itemsLoading: boolean,
  bounds: [number, number, number, number] | null,
  viewportMode: MapViewportMode,
): Map<string, Item> {
  return reconcileMapInventory(previousKey === inventoryKey ? previous : new Map(), items, itemsLoading, bounds, viewportMode)
}

/** The draft is a display-only overlay and never becomes part of the bbox inventory. */
export function mapViewMarkerItems(items: readonly Item[], draftItem: Item | null | undefined, isPicking: boolean): Item[] {
  if (isPicking || !draftItem || !latLngFromPoint(draftItem.data.position)) return [...items]
  return [...items.filter((item) => item.id !== draftItem.id), draftItem]
}

/** The actual module gate; app-side capability detection only decides whether it passes a callback. */
export function mapViewCanCreate(allowCreate: boolean | undefined, onCreate: (() => void) | undefined): boolean {
  return allowCreate === true && onCreate != null
}

/** Debounced bbox reporting is module behaviour; the shell merely owns the query. */
export function observeMapViewBounds(
  adapter: MapAdapter,
  onBounds: (bounds: [number, number, number, number]) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const report = () => {
    const value = adapter.getView().bounds
    onBounds([value.west, value.south, value.east, value.north])
  }
  report()
  const unsubscribe = adapter.observeView(() => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(report, 250)
  })
  return () => { if (timer) clearTimeout(timer); unsubscribe() }
}

/**
 * Die Projektion der Karte: Globus, wo der Adapter ihn kann.
 *
 * Frueher ein Umschalter in der Leiste. Er stellte eine Frage, auf die es nur
 * eine Antwort gab — die Erde ist rund, und wer Mercator sah, sah ihn nicht
 * aus Ueberzeugung, sondern weil der Knopf so stand. Adapter ohne die
 * Faehigkeit (Leaflet) bleiben bei Mercator; ein Versprechen, das die Technik
 * nicht halten kann, gibt die Oberflaeche nicht.
 */
export function mapViewProjection(adapter: MapAdapter | null): MapProjection {
  return adapter && hasGlobe(adapter) ? "globe" : "mercator"
}

/** Zoomstufe, auf die die Ortung heranfaehrt, wenn die Genauigkeit unbekannt ist. */
export const LOCATE_ZOOM = 14

/**
 * So nah hoechstens: Bei wenigen Metern Genauigkeit landete der Ausschnitt
 * sonst auf der Maximalstufe, auf der nichts mehr einzuordnen ist. 18 statt
 * niedriger, damit auch ein 10-Meter-Ring noch deutlich als Ring erscheint
 * (rund 0,6 m/px in unseren Breiten, also ~17px Radius).
 */
export const LOCATE_MAX_ZOOM = 18

/** Grad pro Meter in Nord-Sued-Richtung — ueberall gleich. */
const METER_JE_GRAD = 111_320

/**
 * Der Ausschnitt, der den Genauigkeitskreis ganz zeigt.
 *
 * Anton: „Beim Orten den Zoom so setzen, dass man auch den Ring sieht." Ein
 * fester Zoom kann das nicht — der Ring misst mal fuenf Meter und mal einen
 * halben Kilometer. Also nicht die Stufe waehlen, sondern den Ausschnitt: der
 * Kreis plus etwas Luft, damit er nicht am Rand klebt.
 *
 * Die Ost-West-Ausdehnung haengt am Breitengrad: Ein Meter ist dort weniger
 * Laengengrad als am Aequator; ohne die Korrektur waere der Ausschnitt in
 * Mitteleuropa rund ein Drittel zu schmal.
 */
export function userPositionBounds(
  position: { lng: number; lat: number; accuracy: number },
  luft = 1.3,
): MapBounds {
  const radius = Math.max(position.accuracy, 1) * luft
  const dLat = radius / METER_JE_GRAD
  const dLng = radius / (METER_JE_GRAD * Math.max(Math.cos((position.lat * Math.PI) / 180), 0.01))
  return {
    south: position.lat - dLat,
    north: position.lat + dLat,
    west: position.lng - dLng,
    east: position.lng + dLng,
  }
}

/** Aus, suchend, aktiv — mehr Zustaende hat die Ortung nicht. */
export type LocateState = "aus" | "suchend" | "aktiv"

/** Kennt dieser Browser ueberhaupt einen Standort? Sonst gibt es keinen Knopf. */
export function hasGeolocation(): boolean {
  return typeof navigator !== "undefined" && !!navigator.geolocation
}

function metersBetween(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** The zoom required to separate an external target from its nearest fresh bbox neighbour. */
export function mapViewSeparationZoom(item: Item, others: readonly Item[]): number {
  const point = latLngFromPoint(item.data.position)
  if (!point) return MIN_REVEAL_ZOOM
  let nearest = Infinity
  for (const other of others) {
    if (other.id === item.id) continue
    const candidate = latLngFromPoint(other.data.position)
    if (!candidate) continue
    nearest = Math.min(nearest, metersBetween(point.lng, point.lat, candidate.lng, candidate.lat))
  }
  if (!Number.isFinite(nearest)) return MIN_REVEAL_ZOOM
  return Math.max(MIN_REVEAL_ZOOM, Math.log2(
    (REVEAL_SEPARATION_PX * EARTH_CIRCUMFERENCE_M * Math.cos((point.lat * Math.PI) / 180)) /
      (Math.max(nearest, .1) * MERCATOR_TILE_SIZE),
  ))
}

/** One pick transition is shared by bare-map and existing-marker clicks. */
export function applyMapViewPick(
  position: { lat: number; lng: number },
  isCompact: boolean,
  updatePick: (position: { lat: number; lng: number }) => void,
  setPickPosition: (position: { lat: number; lng: number }) => void,
  confirmPick: () => void,
): void {
  updatePick(position)
  setPickPosition(position)
  if (!isCompact) confirmPick()
}

/** FilterBar and text-search own the same marker input as the rendered module. */
export function filterMapViewItems(items: readonly Item[], filter: FilterBarValue, search: string): Item[] {
  const needle = search.trim().toLowerCase()
  return items.filter((item) => {
    if (item.type === "relation" || !latLngFromPoint(item.data.position)) return false
    if (filter.types?.length && !filter.types.includes(item.type)) return false
    if (filter.tags?.length && !filter.tags.every((tag) => item.tags?.includes(tag))) return false
    return !needle || [item.data.title, item.data.description, item.data.content]
      .some((value) => String(value ?? "").toLowerCase().includes(needle))
  })
}

/**
 * Die Raender, die gerade Karte verdecken: unten das Blatt auf schmalen
 * Geraeten, links/rechts ein schwebendes Panel. Beides zusammen, damit ein
 * angeklickter Marker im sichtbaren Rest landet und nicht hinter dem Panel.
 */
/**
 * Die Raender, die die Karte bei einer Bewegung selbst ausgleichen muss.
 *
 * `kameraKenntSeiten`: Wo die Kamera eine Polsterung traegt
 * ({@link ViewportPaddingCapable}), weiss sie bereits, wo ihre Mitte liegt —
 * die Seitenraender hier nochmal aufzuschlagen hiesse, den Punkt zweimal zu
 * verschieben.
 *
 * Das Blatt am unteren Rand bleibt in beiden Faellen hier: Es aendert seine
 * Hoehe beim Ziehen laufend, und eine animierte Kamera-Polsterung liefe dabei
 * gegen die Geste.
 */
export function mapViewFocusInsets(
  isCompact: boolean,
  panelEdges: PanelEdges,
  kameraKenntSeiten = false,
): MapFocusInsets {
  const bottomInset = isCompact ? window.innerHeight * MAP_SHEET_FRACTION : 0
  if (kameraKenntSeiten) return { bottomInset, leftInset: 0, rightInset: 0 }
  return { bottomInset, leftInset: panelEdges.left, rightInset: panelEdges.right }
}

export function mapViewRevealOptions(
  fromMarkerClick: boolean,
  isCompact: boolean,
  panelEdges: PanelEdges = { left: 0, right: 0 },
) {
  return { animate: !fromMarkerClick, ...mapViewFocusInsets(isCompact, panelEdges) }
}

/**
 * Full Map module: filter/create/bbox behaviour around the filterless MapLens core.
 *
 * Die Huelle an der Wurzel: Die Karte laeuft auch ohne App-Shell (Story,
 * Test, apps/network) und braucht dort beides selbst — einen Besitzer fuer den
 * Filter, den ihre Leiste und ihre Marker teilen, und die Modulflaeche, die
 * Kopf und schwebende Ecke platziert. Unter der App reicht die Huelle beides
 * durch.
 */
export function MapView(props: MapViewProps) {
  return (
    <ModuleSurfaceScope fill="bleed" panelFit="overlay">
      <MapViewInner {...props} />
    </ModuleSurfaceScope>
  )
}

function MapViewInner({
  items, itemsLoading, inventoryKey, focusedItem, createAdapter, initialView, viewportMode,
  onViewportBoundsChange, active = true, activeItemId, selectionFocusVisibleArea, onItemClick,
  allowCreate, onCreate, clustering = false, resolveGroupColor, draftItem, isCompact = false,
}: MapViewProps) {
  const [adapter, setAdapter] = useState<MapAdapter | null>(null)
  const [mountError, setMountError] = useState(false)
  const [mountAttempt, setMountAttempt] = useState(0)
  // Die Karte traegt ihre Leiste selbst (`panelFit: "overlay"`: sie schwebt
  // ueber der Flaeche, statt in einem Kopf zu sitzen) — den WERT teilt sie
  // sich aber mit den anderen Modulen. Ein im Feed gesetztes Tag filtert die
  // Karte ohne Zutun mit.
  const { value: filter, searchText: search } = useSharedFilter()
  // Der Globus ist der Standard, wo der Adapter ihn kann — keine Wahl mehr.
  const projection = mapViewProjection(adapter)
  const [ortung, setOrtung] = useState<LocateState>("aus")
  const [standortFehler, setStandortFehler] = useState<string | null>(null)
  /** Laufende Beobachtung (`watchPosition`), solange die Ortung an ist. */
  const ortungsId = useRef<number | null>(null)
  /**
   * Zieht die Kamera noch mit?
   *
   * Wie `setView: "untilPanOrZoom"` im Vorbild: Der erste Fix faehrt hin,
   * weitere ziehen nach — bis jemand selbst schwenkt. Danach laeuft die
   * Ortung weiter (der Punkt wandert), aber die Kamera bleibt, wo der Nutzer
   * sie hingestellt hat. Ihn dorthin zurueckzuziehen waere ein Kampf gegen
   * seine eigene Geste.
   */
  const folgt = useRef(false)
  /** Ist der erste Fix schon eingelaufen? Nur er waehlt den Ausschnitt. */
  const ersterFix = useRef(true)
  /**
   * Faehrt die Kamera gerade? Dann wird nicht dazwischengefunkt.
   *
   * Der Grund: Eine zweite Bewegung bricht die laufende ab — die Karte blieb
   * auf halbem Weg stehen, mal ja, mal nein, je nachdem wann der naechste Fix
   * kam. Sichtbar als „manchmal zoomt es schoen rein, manchmal bricht es ab".
   */
  const kameraFaehrt = useRef(false)
  /** Der neueste Fix, der waehrend einer Fahrt kam — genau einer, der letzte. */
  const offenerFix = useRef<{ lng: number; lat: number; accuracy: number } | null>(null)
  const [pickPosition, setPickPosition] = useState<{ lat: number; lng: number } | null>(null)
  const { isPicking, updatePick, confirmPick, cancelPick } = useLocationPick()
  const accumulated = useRef(new Map<string, Item>())
  const accumulatedKey = useRef<string | number>(inventoryKey)
  const [inventory, setInventory] = useState<Item[]>([])
  const bounds = useRef<[number, number, number, number] | null>(null)
  const markerClick = useRef<string | null>(null)
  const settledReveal = useRef<string | null>(null)
  const approachedReveal = useRef<string | null>(null)
  // Mit welcher Verschiebung der aktuell gezeigte Punkt zuletzt zentriert
  // wurde. Aendert sich die Verdeckung danach, muss er nachgeholt werden.
  const revealOffset = useRef<[number, number] | null>(null)
  const panelEdges = usePanelEdges()

  useEffect(() => {
    const keyChanged = accumulatedKey.current !== inventoryKey
    if (keyChanged) {
      bounds.current = null
    }
    const next = reconcileMapInventoryForKey(accumulatedKey.current, inventoryKey, accumulated.current, items, itemsLoading, bounds.current, viewportMode)
    accumulatedKey.current = inventoryKey
    const changed = keyChanged || next.size !== accumulated.current.size || [...next].some(([id, item]) => accumulated.current.get(id) !== item)
    accumulated.current = next
    if (changed) setInventory([...next.values()])
  }, [inventoryKey, items, itemsLoading, viewportMode])

  useEffect(() => {
    if (!adapter || viewportMode !== "bbox-module" || !onViewportBoundsChange) return
    return observeMapViewBounds(adapter, (nextBounds) => {
      bounds.current = nextBounds
      onViewportBoundsChange(nextBounds)
    })
  }, [adapter, onViewportBoundsChange, viewportMode])
  useEffect(() => { if (adapter && hasGlobe(adapter)) adapter.setProjection("globe") }, [adapter])
  // Der Karte einmal sagen, wo ihre Mitte liegt: Dann stimmt jede weitere
  // Bewegung von selbst — auch das Zoomen von Hand, bei dem der Globus sonst
  // um die Container-Mitte waechst und hinter dem Panel verschwindet.
  const kameraKenntSeiten = !!adapter && hasViewportPadding(adapter)
  useEffect(() => {
    if (!adapter || !hasViewportPadding(adapter)) return
    adapter.setViewportPadding({ left: panelEdges.left, right: panelEdges.right })
  }, [adapter, panelEdges])
  useEffect(() => {
    if (!active) { settledReveal.current = null; approachedReveal.current = null; revealOffset.current = null; return }
    if (!focusedItem) { settledReveal.current = null; approachedReveal.current = null; revealOffset.current = null; return }
    if (!adapter || viewportMode !== "bbox-module") return
    const point = latLngFromPoint(focusedItem.data.position)
    if (!point) return
    const insets = mapViewFocusInsets(isCompact, panelEdges, kameraKenntSeiten)
    const offset = focusOffsetFor(insets)
    const fromClick = markerClick.current === focusedItem.id
    markerClick.current = null
    if (fromClick) {
      const nachholen = focusNeedsRecentering(null, offset)
      settledReveal.current = focusedItem.id
      approachedReveal.current = focusedItem.id
      revealOffset.current = offset
      if (nachholen) adapter.focusOn([point.lng, point.lat], { ...insets, animate: true })
      return
    }
    if (settledReveal.current === focusedItem.id) {
      // Der Punkt ist schon im Blick — aber vielleicht hat sich seither ein
      // Panel darueber gelegt. Das Panel oeffnet in einem eigenen Effekt, also
      // erst NACH dem Klick, der es ausgeloest hat; ohne diesen Nachlauf legt
      // sich die Detailkarte genau auf den Marker, den sie beschreibt.
      if (focusNeedsRecentering(revealOffset.current, offset)) {
        revealOffset.current = offset
        adapter.focusOn([point.lng, point.lat], { ...insets, animate: true })
      }
      return
    }
    if (items.some((item) => item.id === focusedItem.id)) {
      settledReveal.current = focusedItem.id
      revealOffset.current = offset
      adapter.focusOn([point.lng, point.lat], { zoom: Math.max(adapter.getView().zoom, mapViewSeparationZoom(focusedItem, items)), ...insets, animate: true })
      return
    }
    if (bounds.current && inBounds(focusedItem, bounds.current)) return
    if (approachedReveal.current !== focusedItem.id && bounds.current && !itemsLoading) {
      approachedReveal.current = focusedItem.id
      revealOffset.current = offset
      adapter.focusOn([point.lng, point.lat], { zoom: Math.max(adapter.getView().zoom, MIN_REVEAL_ZOOM), ...insets, animate: true })
    }
  }, [active, adapter, focusedItem, isCompact, items, itemsLoading, kameraKenntSeiten, panelEdges, viewportMode])
  useEffect(() => {
    if (!adapter || !isPicking) return
    return adapter.observeClicks(({ position: [lng, lat] }) => {
      applyMapViewPick({ lat, lng }, isCompact, updatePick, setPickPosition, confirmPick)
    })
  }, [adapter, confirmPick, isCompact, isPicking, updatePick])
  useEffect(() => { if (!isPicking) setPickPosition(null) }, [isPicking])

  const filtered = useMemo(() => filterMapViewItems(inventory, filter, search), [filter, inventory, search])
  const availableTags = useMemo(() => [...new Set(inventory.flatMap((item) => item.tags ?? []))].sort(), [inventory])
  const markerItems = useMemo(() => mapViewMarkerItems(filtered, draftItem, isPicking), [draftItem, filtered, isPicking])
  const lensItems = useMemo(() => pickPosition && isPicking ? [...markerItems, {
    id: PICK_MARKER_ID, type: "__pick__", createdAt: "", createdBy: "", data: { position: { type: "Point", coordinates: [pickPosition.lng, pickPosition.lat] }, color: PICK_MARKER_COLOR },
  } as Item] : markerItems, [isPicking, markerItems, pickPosition])
  const canCreate = mapViewCanCreate(allowCreate, onCreate)
  const onAdapterChange = useCallback((next: MapAdapter | null) => { setAdapter(next); if (next) setMountError(false) }, [])
  const handleClick = useCallback((item: Item) => {
    if (item.id === PICK_MARKER_ID) return
    if (isPicking) {
      const position = latLngFromPoint(item.data.position)
      if (!position) return
      applyMapViewPick(position, isCompact, updatePick, setPickPosition, confirmPick)
      return
    }
    if (viewportMode === "bbox-module") markerClick.current = item.id
    onItemClick?.(item)
  }, [confirmPick, isCompact, isPicking, onItemClick, updatePick, viewportMode])
  /** Beendet eine laufende Ortung und raeumt Punkt und Kreis weg. */
  const beendeOrtung = useCallback(() => {
    if (ortungsId.current !== null) {
      navigator.geolocation?.clearWatch(ortungsId.current)
      ortungsId.current = null
    }
    folgt.current = false
    ersterFix.current = true
    kameraFaehrt.current = false
    offenerFix.current = null
    setOrtung("aus")
    if (adapter && hasUserPosition(adapter)) adapter.setUserPosition(null)
  }, [adapter])

  /**
   * Bringt die Kamera zu einem Fix — und laesst sie dabei ausreden.
   *
   * Jede Bewegung gilt als Fahrt; wer waehrend einer Fahrt ankommt, wird
   * gemerkt und beim Halt nachgeholt (siehe `kameraFaehrt`). Bewusst weiter
   * ANIMIERT statt springend: Ein Punkt, der beim Gehen im Ruck ueber die
   * Karte setzt, liest sich als Fehler; und das Warten kostet nichts, weil
   * ohnehin nur der neueste Fix nachgeholt wird.
   */
  const fahreZu = useCallback(
    (position: { lng: number; lat: number; accuracy: number }) => {
      if (!adapter) return
      // Dieselbe Polsterung wie bei jedem anderen Hinfahren: Der Standort
      // gehoert in den SICHTBAREN Rest, nicht hinter das Panel.
      const raender = mapViewFocusInsets(isCompact, panelEdges, kameraKenntSeiten)
      const erste = ersterFix.current
      ersterFix.current = false
      offenerFix.current = null
      kameraFaehrt.current = true
      if (erste && position.accuracy > 0) {
        // Der erste Fix waehlt den AUSSCHNITT, nicht die Stufe: So ist der
        // Genauigkeitskreis ganz zu sehen — er sagt, wie genau das hier gerade
        // ist, und das ist beim ersten Blick die halbe Auskunft.
        //
        // Und zwar IMMER, egal wo die Karte gerade steht: Der Zoom ergibt sich
        // aus dem Ring, nicht aus dem Ausgangszustand. Wer weit draussen
        // stand, blieb sonst auf halbem Weg stehen (Zoom 14) und sah gar
        // keinen Ring.
        adapter.fitBounds(userPositionBounds(position), {
          maxZoom: LOCATE_MAX_ZOOM,
          animate: true,
          ...raender,
        })
        return
      }
      adapter.focusOn([position.lng, position.lat], {
        // Nur der erste Fix ohne Genauigkeit faehrt heran — und auch der nur,
        // wenn die Karte weiter draussen steht. Spaetere Fixe ziehen die
        // Kamera nur nach: Ein Ring, der mit der Genauigkeit waechst und
        // schrumpft, wuerde sonst dauernd nachzoomen und flackern.
        ...(erste && adapter.getView().zoom < LOCATE_ZOOM ? { zoom: LOCATE_ZOOM } : {}),
        animate: true,
        ...raender,
      })
    },
    [adapter, isCompact, kameraKenntSeiten, panelEdges],
  )

  /**
   * Steht die Kamera wieder? Dann den Fix nachholen, der waehrend der Fahrt kam.
   *
   * `observeView` meldet jeden Halt (`moveend`) — auch den nach einer Geste.
   * Das genuegt: Nachgeholt wird nur, wenn ueberhaupt etwas offen ist und die
   * Kamera noch folgen soll.
   */
  useEffect(() => {
    if (!adapter) return
    return adapter.observeView(() => {
      if (!kameraFaehrt.current) return
      kameraFaehrt.current = false
      const offen = offenerFix.current
      offenerFix.current = null
      if (offen && folgt.current) fahreZu(offen)
    })
  }, [adapter, fahreZu])

  /**
   * „Wo bin ich" — ein Umschalter, keine einmalige Frage.
   *
   * Vorbild ist der Standort-Knopf der Utopia Map (leaflet.locatecontrol):
   * Er beantwortet die Frage nicht einmal, er haelt die Antwort aktuell,
   * solange sie gebraucht wird. Ein einzelner Fix veraltet, sobald man
   * losgeht.
   */
  const zeigeStandort = useCallback(() => {
    if (!adapter || !hasGeolocation()) return
    if (ortung !== "aus") {
      beendeOrtung()
      return
    }
    setStandortFehler(null)
    setOrtung("suchend")
    folgt.current = true
    ersterFix.current = true
    kameraFaehrt.current = false
    offenerFix.current = null

    const starte = () => {
      ortungsId.current = navigator.geolocation.watchPosition(
        ({ coords }) => {
          setOrtung("aktiv")
          const position = { lng: coords.longitude, lat: coords.latitude, accuracy: coords.accuracy }
          // Punkt und Genauigkeitskreis, wo der Adapter es kann; sonst bleibt
          // es beim Hinfahren — eine Karte ohne die Faehigkeit soll nicht
          // weniger koennen als vorher.
          if (hasUserPosition(adapter)) adapter.setUserPosition(position)
          if (!folgt.current) return
          // Waehrend eine Fahrt laeuft, wandert nur der Punkt: Der Fix wird
          // gemerkt und danach EINMAL nachgeholt, damit die Kamera nicht auf
          // einer alten Position endet.
          if (kameraFaehrt.current) {
            offenerFix.current = position
            return
          }
          fahreZu(position)
        },
        () => {
          // Kein Konsolen-Rauschen: Eine Ablehnung ist keine Stoerung, sondern
          // eine Antwort — sie gehoert dorthin, wo gefragt wurde.
          beendeOrtung()
          setStandortFehler("Standort nicht verfügbar")
        },
        { enableHighAccuracy: true, timeout: 10_000 },
      )
    }

    // Vorher fragen, wo der Browser es anbietet: Eine abgelehnte Berechtigung
    // beantwortet sich sonst nur ueber den Fehlerpfad — mit Wartezeit.
    const berechtigung = navigator.permissions?.query?.({ name: "geolocation" as PermissionName })
    if (!berechtigung) {
      starte()
      return
    }
    void berechtigung.then(
      (stand) => {
        if (stand.state === "denied") {
          setOrtung("aus")
          folgt.current = false
          setStandortFehler("Standort nicht verfügbar")
          return
        }
        starte()
      },
      () => starte(),
    )
  }, [adapter, beendeOrtung, fahreZu, ortung])

  // Eine Geste beendet das Nachziehen, nicht die Ortung (siehe `folgt`).
  useEffect(() => {
    if (!adapter || !hasUserGesture(adapter)) return
    return adapter.observeUserGesture(() => {
      folgt.current = false
    })
  }, [adapter])

  // Die Karte wird gehalten (`keepMounted`), die Ortung laeuft beim
  // Modulwechsel also weiter — beim Abbau der Flaeche endet sie.
  useEffect(() => () => {
    if (ortungsId.current !== null) navigator.geolocation?.clearWatch(ortungsId.current)
  }, [])

  const markerGroupColor = useCallback((item: Item) => item.id === PICK_MARKER_ID
    ? PICK_MARKER_COLOR
    : resolveGroupColor?.(item) ?? getSpacePrimaryColor("map"), [resolveGroupColor])

  return <div className="relative h-full w-full">
    <MapLens items={lensItems} createAdapter={createAdapter} initialView={initialView} activeItemId={activeItemId}
      selectionFocusVisibleArea={selectionFocusVisibleArea} viewportResetKey={inventoryKey} onItemClick={handleClick}
      clustering={clustering} resolveGroupColor={markerGroupColor} viewportMode={viewportMode} active={active} onAdapterChange={onAdapterChange}
      highlightedItemIds={draftItem && !isPicking ? [draftItem.id] : []}
      nonClickableItemIds={draftItem && !isPicking ? [draftItem.id] : []}
      containerClassName={projection === "globe" ? "rls-globe-sky" : undefined}
      mountKey={mountAttempt} onMountError={() => setMountError(true)} />
    {!adapter && <div className="absolute inset-0 z-10 bg-background/80"><PanelSafeArea className="flex items-center justify-center text-muted-foreground">{mountError ? <div className="flex flex-col items-center gap-3"><span>Karte konnte nicht geladen werden.</span><Button variant="outline" size="sm" onClick={() => { setMountError(false); setMountAttempt((value) => value + 1) }}>Erneut versuchen</Button></div> : <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Karte wird geladen…</>}</PanelSafeArea></div>}
    {isPicking && <PanelSafeArea className="z-30 flex items-start justify-center p-3"><div className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-sm shadow-md"><MapPin className="h-4 w-4" /><span>{pickPosition ? "Position gewählt." : "Tippe auf die Karte, um die Position zu setzen."}</span>{isCompact && pickPosition && <Button size="sm" onClick={confirmPick}>Übernehmen</Button>}<Button size="sm" variant="ghost" onClick={cancelPick}>Abbrechen</Button></div></PanelSafeArea>}
    {/* Der Beitrag der Karte zur Steuerung ihrer Flaeche — WO er steht,
        entscheidet die Flaeche (Suche und Chips schwebend oben, Pille unten).
        `clearsTopLeft`: links oben sitzen die Zoom-Knoepfe. */}
    <ModuleToolbar searchLabel="Karte durchsuchen" clearsTopLeft availableTags={availableTags} availableTypes={MAP_TYPES} trailingActions={hasGeolocation() && !isPicking ? <div className="flex flex-col items-end gap-1"><Button size="icon-sm" variant="outline" aria-label={ortung === "aus" ? "Standort verfolgen" : "Standortverfolgung beenden"} title={ortung === "aus" ? "Standort verfolgen" : "Standortverfolgung beenden"} aria-pressed={ortung === "aktiv"} aria-busy={ortung === "suchend"} onClick={zeigeStandort} className="bg-card!">{ortung === "suchend" ? <Loader2 className="h-4 w-4 animate-spin" /> : <StandortIcon className={cn(ortung === "aktiv" && "text-primary")} />}</Button>{standortFehler && <span role="status" className="rounded-full border bg-card/95 px-2 py-0.5 text-xs text-muted-foreground shadow-sm">{standortFehler}</span>}</div> : undefined} />
    {!isPicking && canCreate && <CreateFab onClick={onCreate!} label="Ort erstellen" />}
  </div>
}
