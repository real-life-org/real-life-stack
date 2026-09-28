"use client"

import * as React from "react"
import { hasItemType, type Item } from "@real-life-stack/data-interface"

import { latLngFromPoint, pointFromLatLng, type GeoJSONPoint } from "@/lib/geo"
import type { Geocoder, ReverseGeocoder } from "@/lib/geocode"
import { targetItemId, targetPointsTo } from "../../preview/use-item-edges"
import { itemRelationDataKey, type ItemRelationFieldConfig } from "../item-relations"
import { useCandidates } from "./item-relation-widget"
import { LocationWidget, type LocationPlaces } from "./location-widget"

/**
 * Das Ort-Feld des Formulars (B4, S4b): EIN Feld für Ort-Item ODER Adresse
 * und Position.
 *
 * Spec: shared-components → Widget-Paare B4 („ein Feld; die
 * Autovervollständigung mischt Ort-Items und Adressen; Karten-Pick daneben")
 * und Location-Widget (Geocoder, Karten-Pick über das Map-Modul).
 *
 * Führt der Typ eine Kante zu einem Ort (beim Event `locatedAt`, siehe
 * `locationEdge`), bietet das Feld Ort-Items des Formular-Space an. Ein
 * gewähltes Ort-Item schreibt die Kante und leert Adresse und Position; eine
 * gewählte Adresse oder ein freier Punkt auf der Karte leert die Kante. Der
 * Karten-Pick nimmt einen Marker als Ort-Item, wenn er einer ist, sonst seine
 * Position.
 */

/** Was das Feld vom Formular braucht. */
export interface LocationFieldData {
  address?: string
  locationName?: string
  position?: GeoJSONPoint
  [key: string]: unknown
}

type PickHandlers = {
  onPick: (pos: { lat: number; lng: number }) => void
  onCancel?: () => void
  onPickItem?: (item: Item) => boolean
}

export interface LocationFieldProps {
  label: string
  data: LocationFieldData
  updateMany: (patch: Record<string, unknown>) => void
  geocode?: Geocoder
  reverseGeocode?: ReverseGeocoder
  requestMapPick?: (handlers: PickHandlers) => void
  /** Die Ort-Kante des Typs (Item-Kanten-Feld mit `location`), sonst reines Adressfeld. */
  placeField?: ItemRelationFieldConfig
  /** Space des Formulars: Ort-Items nur von dort (space-lokales `item:`-Target). */
  spaceId?: string
  /** Das bearbeitete Item — nie sein eigener Ort. */
  itemId?: string
}

export function LocationField(props: LocationFieldProps) {
  return props.placeField ? <WithPlaces {...props} placeField={props.placeField} /> : <LocationCore {...props} places={undefined} />
}

/** Mit Ort-Items: die Kandidaten des Formular-Space und die gewählte Kante. */
function WithPlaces(props: LocationFieldProps & { placeField: ItemRelationFieldConfig }) {
  const { placeField, spaceId, itemId, data, updateMany } = props
  const key = itemRelationDataKey(placeField.predicate)
  const { items: candidates, all, spaceOf } = useCandidates(placeField.targetType, spaceId)
  const choosable = React.useMemo(() => candidates.filter((c) => c.id !== itemId), [candidates, itemId])
  const targets = Array.isArray(data[key]) ? (data[key] as unknown[]).filter((t): t is string => typeof t === "string" && t !== "") : []
  const target = targets[0]
  const selectedItem = target
    ? all.find((c) => targetItemId(target) === c.id && (!spaceOf || targetPointsTo(target, c, spaceId ?? null, spaceOf)))
    : undefined
  // Nimmt das Feld dieses Item als Ort? Typ der Gegenstelle, Space des
  // Formulars, nicht das Item selbst — wie Suche und Modul-Pick der Item-Kanten.
  const accepts = React.useCallback(
    (item: Item) =>
      item.id !== itemId &&
      (!placeField.targetType || hasItemType(item, placeField.targetType)) &&
      choosable.some((c) => c.id === item.id),
    [choosable, itemId, placeField.targetType],
  )
  const choose = React.useCallback(
    (item: Item | null) => {
      // EIN Ort: Item ODER Adresse. Ein Ort-Item leert Adresse und Position.
      if (item) updateMany({ [key]: [`item:${item.id}`], address: undefined, position: undefined, locationName: undefined })
      else updateMany({ [key]: [] })
    },
    [key, updateMany],
  )
  const places: LocationPlaces = {
    selected: target ? { target, ...(selectedItem ? { item: selectedItem } : {}) } : null,
    candidates: choosable,
    onSelect: choose,
  }
  return <LocationCore {...props} places={places} placeKey={key} accepts={accepts} choose={choose} />
}

function LocationCore({
  label,
  spaceId,
  data,
  updateMany,
  geocode,
  reverseGeocode,
  requestMapPick,
  places,
  placeKey,
  accepts,
  choose,
}: LocationFieldProps & {
  places: LocationPlaces | undefined
  placeKey?: string
  accepts?: (item: Item) => boolean
  choose?: (item: Item | null) => void
}) {
  // Bricht die vorige Rückwärtssuche ab: bei neuer Wahl auf der Karte und bei
  // jeder anderen Ortswahl — eine späte Adresse darf ein danach gewähltes
  // Ort-Item nicht wieder zur Adresse machen (Codex R1/2).
  const reverseAbortRef = React.useRef<AbortController | null>(null)
  const cancelReverse = () => reverseAbortRef.current?.abort()
  // Der Karten-Pick läuft über Modulwechsel hinweg; sein Rückruf liest den
  // AKTUELLEN Stand (Kandidaten des Formular-Space, Kante), nicht den beim
  // Start (Codex R1/1).
  const latest = React.useRef({ accepts, choose, spaceId })
  latest.current = { accepts, choose, spaceId }
  // Eine Adresse oder ein Punkt ersetzt ein gewähltes Ort-Item.
  const clearPlace = placeKey ? { [placeKey]: [] } : {}
  const wrappedPlaces: LocationPlaces | undefined = places && {
    ...places,
    onSelect: (item) => {
      cancelReverse()
      places.onSelect(item)
    },
  }
  return (
    <LocationWidget
      value={{
        address: data.address,
        position: data.position ? latLngFromPoint(data.position) ?? undefined : undefined,
      }}
      onChange={(v) => {
        if (v.position) cancelReverse()
        updateMany({
          address: v.address || undefined,
          position: v.position ? pointFromLatLng(v.position.lat, v.position.lng) : undefined,
          ...(v.position ? clearPlace : {}),
        })
      }}
      label={label}
      geocode={geocode}
      places={wrappedPlaces}
      onPickOnMap={
        requestMapPick
          ? () => {
              // Der ganze Ortszustand vor dem Pick, für „Abbrechen" (Codex R1/3).
              const original = {
                position: data.position,
                address: data.address,
                locationName: data.locationName,
                ...(placeKey ? { [placeKey]: data[placeKey] } : {}),
              }
              // Ein Ort-Item ist space-lokal (04): Wechselt der Formular-Space
              // während des Picks, kommt es beim Abbrechen nicht zurück (Codex R2/1).
              const startSpace = spaceId
              requestMapPick({
                onPick: (pos) => {
                  updateMany({ position: pointFromLatLng(pos.lat, pos.lng), ...clearPlace })
                  // Reverse-geocode (aborting the previous one) to fill the address.
                  cancelReverse()
                  if (reverseGeocode) {
                    const controller = new AbortController()
                    reverseAbortRef.current = controller
                    reverseGeocode(pos, { signal: controller.signal })
                      .then((result) => {
                        if (result && !controller.signal.aborted) updateMany({ address: result })
                      })
                      .catch(() => {})
                  }
                },
                // Marker = Ort-Item (B4): nur, wenn das Feld Ort-Items kennt
                // und das Item eines ist, das es JETZT nehmen darf.
                ...(accepts && choose
                  ? {
                      onPickItem: (item: Item) => {
                        const now = latest.current
                        if (!now.accepts || !now.choose || !now.accepts(item)) return false
                        cancelReverse()
                        now.choose(item)
                        return true
                      },
                    }
                  : {}),
                onCancel: () => {
                  // Abort a pending reverse-geocode so its late result can't
                  // overwrite the restored address.
                  cancelReverse()
                  const sameSpace = latest.current.spaceId === startSpace
                  updateMany(placeKey && !sameSpace ? { ...original, [placeKey]: [] } : original)
                },
              })
            }
          : undefined
      }
    />
  )
}
