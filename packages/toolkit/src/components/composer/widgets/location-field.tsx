"use client"

import * as React from "react"
import type { Item } from "@real-life-stack/data-interface"

import { latLngFromPoint, pointFromLatLng, type GeoJSONPoint } from "@/lib/geo"
import type { Geocoder, ReverseGeocoder } from "@/lib/geocode"
import { resolveTarget } from "../../../lib/item-targets"
import { useFieldEpoch } from "../../../lib/form-epoch"
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
  const { items: candidates, all, spaceOf, needsSpace, otherSpace } = useCandidates(placeField.targetType, spaceId)
  const choosable = React.useMemo(() => candidates.filter((c) => c.id !== itemId), [candidates, itemId])
  const targets = Array.isArray(data[key]) ? (data[key] as unknown[]).filter((t): t is string => typeof t === "string" && t !== "") : []
  const target = targets[0]
  // Das gewählte Ort-Item bestimmt der Auflöser (06, Verhältnis zu Relations, Regel 6).
  const selectedItem = target ? resolveTarget(target, all, { carrierSpace: spaceId ?? null, spaceOf, otherKind: placeField.targetType }) : undefined
  // Nimmt das Feld dieses Item als Ort? Nur ein wählbarer Kandidat: Typ der
  // Gegenstelle und Space des Formulars prüft schon die Kandidatenmenge.
  const accepts = (item: Item) => choosable.some((c) => c.id === item.id)
  const choose = (item: Item | null) => {
    // EIN Ort: Item ODER Adresse. Ein Ort-Item leert Adresse und Position.
    if (item) updateMany({ [key]: [`item:${item.id}`], address: undefined, position: undefined, locationName: undefined })
    else updateMany({ [key]: [] })
  }
  const places: LocationPlaces = {
    selected: target ? { target, ...(selectedItem ? { item: selectedItem } : {}) } : null,
    candidates: choosable,
    onSelect: choose,
    // Warum keine Ort-Items kommen (Space des Formulars, Regel 7); Adressen gehen immer.
    ...(needsSpace
      ? { unavailable: "Ort-Items erst nach Wahl eines Space – Adressen gehen immer" }
      : otherSpace
        ? { unavailable: "Ort-Items sucht dieser Speicher nur im geöffneten Space – Adressen gehen immer" }
        : {}),
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
  // Die Epoche des Felds (shared-components → Formular-Epoche): Pick-Rückrufe
  // und Rückwärtssuche gelten nur für den Stand, für den sie begannen, und
  // prüfen und schreiben gegen den Stand beim Eintreffen.
  const epoch = useFieldEpoch({ accepts, choose }, { scope: [spaceId ?? null] })
  // Eine Adresse oder ein Punkt ersetzt ein gewähltes Ort-Item.
  const clearPlace = placeKey ? { [placeKey]: [] } : {}
  const wrappedPlaces: LocationPlaces | undefined = places && {
    ...places,
    onSelect: (item) => {
      // Eine neue Ortswahl: eine laufende Rückwärtssuche gilt nicht mehr.
      epoch.invalidate("reverse")
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
        if (v.position) epoch.invalidate("reverse")
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
              // Der ganze Ortszustand vor dem Pick, für „Abbrechen".
              const original = {
                position: data.position,
                address: data.address,
                locationName: data.locationName,
                ...(placeKey ? { [placeKey]: data[placeKey] } : {}),
              }
              const pick = epoch.begin("pick")
              requestMapPick({
                onPick: (pos) => {
                  pick.apply(() => {
                    updateMany({ position: pointFromLatLng(pos.lat, pos.lng), ...clearPlace })
                    if (!reverseGeocode) return
                    const reverse = epoch.begin("reverse")
                    reverseGeocode(pos, { signal: reverse.signal })
                      .then((result) => {
                        if (result) reverse.apply(() => updateMany({ address: result }))
                      })
                      .catch(() => {})
                  })
                },
                // Marker = Ort-Item (B4): nur, wenn das Feld Ort-Items kennt
                // und das Item eines ist, das es JETZT nehmen darf.
                ...(accepts && choose
                  ? {
                      onPickItem: (item: Item) => {
                        let taken = false
                        pick.apply((now) => {
                          if (!now.accepts || !now.choose || !now.accepts(item)) return
                          epoch.invalidate("reverse")
                          now.choose(item)
                          taken = true
                        })
                        return taken
                      },
                    }
                  : {}),
                onCancel: () => {
                  pick.apply(() => {
                    epoch.invalidate("reverse")
                    updateMany(original)
                  })
                },
              })
            }
          : undefined
      }
    />
  )
}
