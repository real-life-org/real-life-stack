"use client"

import * as React from "react"
import type { Item } from "@real-life-stack/data-interface"
import { Loader2, MapPin } from "lucide-react"
import { Input } from "@/components/primitives/input"
import { Button } from "@/components/primitives/button"
import { cn } from "@/lib/utils"
import type { Geocoder, GeocodeResult } from "@/lib/geocode"
import { ItemRefChip, MissingRefText } from "../../preview/item-ref-chip"
import { itemTitle } from "../item-relations"
import type { FieldAccess } from "../../../lib/form-state"
import { pointFromLatLng } from "../../../lib/geo"
import type { LocationValue } from "../form-fields"
import { FieldNotice } from "./field-notice"

/**
 * Der Prüfstand des Ort-Felds beim Eintreffen eines Karten-Picks
 * (Formularzustand, Regel 3): Ist ein Marker ein Ort-Item, und darf das
 * Feld es JETZT nehmen?
 */
export interface LocationChecks {
  isPlace: (item: Item) => boolean
  accepts: (item: Item) => boolean
}

/**
 * Ort-Items im Ort-Feld (B4, S4b): EIN Feld, das entweder ein Ort-Item oder
 * eine Adresse trägt. Nur, wenn der Typ eine Kante zu einem Ort führt (beim
 * Event `locatedAt`).
 */
export interface LocationPlaces {
  /** Das gewählte Ort-Item: das Target und, wenn auflösbar, das Item. */
  selected: { target: string; item?: Item } | null
  /** Wählbare Ort-Items (Formular-Space). */
  candidates: readonly Item[]
  /** Ein Ort-Item wählen, oder mit `null` die Wahl zurücknehmen. */
  onSelect: (item: Item | null) => void
  /** Warum gerade keine Ort-Items angeboten werden; steht klein unter dem Feld. */
  unavailable?: string
}

interface LocationWidgetProps {
  /**
   * Der Feldzugang des Ort-Felds (Formularzustand): Wert, Schreibweg für
   * Eingaben und die Arbeit „Adresssuche" (Hintergrund).
   */
  field: FieldAccess<LocationValue, LocationChecks | undefined>
  label: string
  /**
   * Optional address geocoder. When provided, typing an address shows
   * debounced suggestions; picking one sets `position`. Without it the address
   * stays free text (no position from the address).
   */
  geocode?: Geocoder
  /**
   * When provided, shows a compact "pick on map" button next to the address
   * input. The pick itself is a work of the field (LocationField); this
   * widget only triggers it.
   */
  onPickOnMap?: () => void
  /**
   * Ort-Items (B4): Die Autovervollständigung zeigt passende Ort-Items oben,
   * darunter die Adressen des Geocoders. Ist eins gewählt, steht es als Chip
   * statt der Eingabe; ✕ nimmt es zurück.
   */
  places?: LocationPlaces
}

const GEOCODE_DEBOUNCE_MS = 500
const GEOCODE_MIN_CHARS = 3
/** Höchstens so viele Ort-Items stehen über den Adressen. */
const MAX_PLACE_OPTIONS = 5

type Option = { kind: "place"; item: Item } | { kind: "address"; result: GeocodeResult }

/** Ort-Items, deren Titel die Eingabe enthält, in der Reihenfolge der Kandidaten. */
function matchingPlaces(candidates: readonly Item[], query: string): Item[] {
  const q = query.trim().toLocaleLowerCase("de")
  if (!q) return []
  return candidates.filter((c) => itemTitle(c).toLocaleLowerCase("de").includes(q)).slice(0, MAX_PLACE_OPTIONS)
}

export function LocationWidget({
  field,
  label,
  geocode,
  onPickOnMap,
  places,
}: LocationWidgetProps) {
  const value = field.value
  const address = value.address ?? ""

  // Geocoding is driven by what the user actually *types*, not by every
  // external `address` change — so opening an editor with a prefilled address
  // does not auto-search, and picking a suggestion (which sets address = label)
  // does not re-search. `null` means "no pending user query".
  const [userQuery, setUserQuery] = React.useState<string | null>(null)
  const [results, setResults] = React.useState<GeocodeResult[]>([])
  const [listOpen, setListOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const [failed, setFailed] = React.useState(false)
  const blurTimer = React.useRef<number | null>(null)
  // Die Adresssuche ist Hintergrundarbeit des Felds (Formularzustand,
  // Regel 10): Nur die letzte Suche für den aktuellen Stand setzt Treffer;
  // den Spinner liest das Widget aus dem Warte-Zustand des Formulars.
  const loading = field.busy("geocode")
  const listId = React.useId()
  // Fokus über den Wechsel Eingabe ↔ Chip hinweg (Codex R3/2): Nach der Wahl
  // eines Ort-Items steht der Fokus auf dessen ✕, nach dem Entfernen wieder in
  // der Eingabe — nie auf dem Body.
  const rootRef = React.useRef<HTMLDivElement>(null)
  const pendingFocus = React.useRef<"chip" | "input" | null>(null)

  React.useEffect(() => {
    if (!geocode || userQuery === null) return
    const q = userQuery.trim()
    if (q.length < GEOCODE_MIN_CHARS) {
      setResults([])
      setActiveIndex(-1)
      setFailed(false)
      return
    }
    // Die Arbeit beginnt beim Einplanen: Ein Wechsel von Space oder Typ
    // während der Wartezeit verwirft schon den Start.
    const planned = field.begin("geocode-plan", "background", "Adresssuche")
    const timer = window.setTimeout(() => {
      if (!planned.valid()) return
      planned.finish()
      // Die Suche selbst: ihren Warte-Zustand (Spinner) führt der Formularzustand.
      const search = field.begin("geocode", "background", "Adresssuche")
      geocode(q, { signal: search.signal })
        .then((hits) => {
          search.apply(() => {
            setResults(hits)
            setFailed(false)
          })
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === "AbortError") return
          search.apply(() => {
            setResults([])
            setFailed(true)
          })
        })
        .finally(() => search.finish())
    }, GEOCODE_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      // Eine überholte Suche gilt nicht mehr; ihr Warte-Zustand endet mit ihr.
      field.cancel("geocode-plan")
      field.cancel("geocode")
    }
    // Der Feldzugang ist je Render neu; Start und Verwerfen gehören dem
    // Formularzustand und sind nicht an einen Render gebunden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userQuery, geocode])

  // Clear a pending blur-close timer on unmount.
  React.useEffect(
    () => () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current)
    },
    [],
  )

  // Ort-Items oben (sofort, ohne Geocoder), darunter die Adressen.
  const placeOptions = places && userQuery !== null ? matchingPlaces(places.candidates, userQuery) : []
  const options: Option[] = [
    ...placeOptions.map((item): Option => ({ kind: "place", item })),
    ...results.map((result): Option => ({ kind: "address", result })),
  ]
  const open = listOpen && options.length > 0
  // Ändert sich die Liste, darf der Index nicht über ihr Ende zeigen.
  const active = activeIndex < options.length ? activeIndex : -1

  const closeSoon = () => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current)
    // Delay so a mouse click on a suggestion registers before the list closes.
    blurTimer.current = window.setTimeout(() => setListOpen(false), 120)
  }

  const reset = () => {
    setUserQuery(null) // not a user query → no re-search
    setResults([])
    setListOpen(false)
    setActiveIndex(-1)
  }

  const selectOption = (option: Option) => {
    if (option.kind === "place") {
      pendingFocus.current = "chip"
      places?.onSelect(option.item)
    } else {
      const r = option.result
      // Eine gewählte Adresse ersetzt ein Ort-Item und eine laufende Rückwärtssuche.
      field.cancel("reverse")
      field.set({ ...value, address: r.label, position: pointFromLatLng(r.lat, r.lng), place: [] })
    }
    reset()
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setListOpen(false)
      setActiveIndex(-1)
      return
    }
    if (options.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setListOpen(true)
      setActiveIndex((i) => (i + 1) % options.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setListOpen(true)
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1))
    } else if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault()
      selectOption(options[active]!)
    }
  }

  const selected = places?.selected ?? null
  const removePlace = () => {
    pendingFocus.current = "input"
    places!.onSelect(null)
  }
  React.useEffect(() => {
    const want = pendingFocus.current
    if (!want || !rootRef.current) return
    const target =
      want === "chip"
        ? rootRef.current.querySelector<HTMLElement>("[data-place-chip] button")
        : rootRef.current.querySelector<HTMLElement>('input[role="combobox"]')
    if (target) {
      target.focus()
      pendingFocus.current = null
    }
  })

  return (
    <div ref={rootRef} className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {selected ? (
            // Ein Ort-Item statt der Adresse: der Chip in seiner Typfarbe, ✕
            // nimmt ihn zurück; dann ist das Feld wieder eine Eingabe.
            <div
              data-place-chip={selected.item?.id ?? selected.target}
              className="flex min-h-9 items-center rounded-md border bg-background px-2 py-1"
            >
              {selected.item ? (
                <ItemRefChip item={selected.item} inert onRemove={removePlace} />
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5">
                  <MissingRefText text="nicht verfügbarer Ort" />
                  <button
                    type="button"
                    aria-label="Nicht verfügbaren Ort entfernen"
                    onClick={removePlace}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
          ) : (
            <>
              <Input
                value={address}
                onChange={(e) => {
                  field.set({ ...value, address: e.target.value })
                  setUserQuery(e.target.value)
                  setListOpen(true)
                  setActiveIndex(-1)
                }}
                onFocus={() => {
                  if (options.length > 0) setListOpen(true)
                }}
                onBlur={closeSoon}
                onKeyDown={onInputKeyDown}
                placeholder={places ? "Ort-Item oder Adresse" : "Adresse eingeben..."}
                className="text-sm"
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={open && active >= 0 ? `${listId}-opt-${active}` : undefined}
              />
              {loading && (
                <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {open && (
                <ul
                  id={listId}
                  role="listbox"
                  className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md"
                >
                  {options.map((option, i) => {
                    const id = `${listId}-opt-${i}`
                    const common = {
                      type: "button" as const,
                      // Keep the input focused so onBlur does not close the list
                      // before the click lands.
                      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
                      onClick: () => selectOption(option),
                      onMouseEnter: () => setActiveIndex(i),
                      className: cn("block w-full px-2 py-1.5 text-left hover:bg-accent", i === active && "bg-accent"),
                    }
                    if (option.kind === "place") {
                      return (
                        <li key={`place:${option.item.id}`} id={id} role="option" aria-selected={i === active} data-place-option={option.item.id}>
                          <button {...common}>
                            <ItemRefChip item={option.item} inert />
                          </button>
                        </li>
                      )
                    }
                    const r = option.result
                    // Der erste Adresstreffer nach den Ort-Items trennt sich
                    // mit einer Linie ab: oben Items, unten Adressen.
                    const first = i === placeOptions.length && placeOptions.length > 0
                    return (
                      <li
                        key={`${r.lat},${r.lng},${i}`}
                        id={id}
                        role="option"
                        aria-selected={i === active}
                        data-address-option
                        className={cn(first && "border-t")}
                      >
                        <button {...common}>
                          {r.label}
                          {/* Die lange Form nur, wenn sie mehr sagt: Zwei
                              gleichnamige Strassen sind sonst nicht zu
                              unterscheiden — gespeichert wird trotzdem die kurze. */}
                          {r.detail && r.detail !== r.label && (
                            <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>
        {onPickOnMap && (
          <Button
            type="button"
            variant={value.position || selected ? "default" : "outline"}
            size="icon"
            onClick={onPickOnMap}
            className="h-9 w-9 shrink-0"
            aria-label={value.position || selected ? "Position auf Karte ändern" : "Position auf Karte wählen"}
            title={value.position || selected ? "Position auf Karte ändern" : "Position auf Karte wählen"}
          >
            <MapPin className="h-4 w-4" />
          </Button>
        )}
      </div>
      {places?.unavailable && !selected && (
        <p data-places-unavailable className="px-1 text-[11px] text-muted-foreground">
          {places.unavailable}
        </p>
      )}
      {field.notice && <FieldNotice text={field.notice} onDismiss={field.dismissNotice} />}
      {failed && !loading && !selected && (
        <p className="px-1 text-[11px] text-muted-foreground">
          Adresssuche gerade nicht verfügbar.
        </p>
      )}
    </div>
  )
}
