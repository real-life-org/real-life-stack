"use client"

import * as React from "react"
import type { Item } from "@real-life-stack/data-interface"

import { pointFromLatLng } from "@/lib/geo"
import type { Geocoder, ReverseGeocoder } from "@/lib/geocode"
import type { FieldAccess } from "../../../lib/form-state"
import { resolveTarget } from "../../../lib/item-targets"
import type { ItemRelationFieldConfig } from "../item-relations"
import type { LocationValue } from "../form-fields"
import { useCandidates } from "./item-relation-widget"
import { LocationWidget, type LocationChecks, type LocationPlaces } from "./location-widget"

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

type PickHandlers = {
  onPick: (pos: { lat: number; lng: number }) => void
  onCancel?: () => void
  onPickItem?: (item: Item) => boolean
}

export interface LocationFieldProps {
  label: string
  /**
   * Der Feldzugang (shared-components → Formularzustand): Adresse,
   * Position und die Ort-Kante. Pick und Rückwärtssuche sind Arbeiten
   * dieses Felds; einen anderen Schreibweg hat das Widget nicht.
   */
  field: FieldAccess<LocationValue, LocationChecks | undefined>
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
  const { placeField, spaceId, itemId, field } = props
  const { items: candidates, all, scope, needsSpace, otherSpace } = useCandidates(placeField.targetType, spaceId)
  const choosable = React.useMemo(() => candidates.filter((c) => c.id !== itemId), [candidates, itemId])
  const target = field.value.place.find((t) => t !== "")
  // Das gewählte Ort-Item bestimmt der Auflöser (06, Verhältnis zu Relations, Regel 6).
  const selectedItem = target ? resolveTarget(target, scope, all) : undefined
  // Der Prüfstand für einen Marker beim Eintreffen (Regel 3): Typ der
  // Gegenstelle, und ob er JETZT ein wählbarer Kandidat ist (Space des
  // Formulars prüft schon die Kandidatenmenge).
  field.track({
    isPlace: (item) => !placeField.targetType || item.type === placeField.targetType,
    accepts: (item) => choosable.some((c) => c.id === item.id),
  })
  const places: LocationPlaces = {
    selected: target ? { target, ...(selectedItem ? { item: selectedItem } : {}) } : null,
    candidates: choosable,
    // EIN Ort: Item ODER Adresse. Ein Ort-Item leert Adresse und Position.
    onSelect: (item) => {
      // Eine neue Ortswahl: eine laufende Rückwärtssuche gilt nicht mehr.
      field.cancel("reverse")
      field.set(item ? { place: [`item:${item.id}`] } : { ...field.value, place: [] })
    },
    // Warum keine Ort-Items kommen (Space des Formulars, Regel 7); Adressen gehen immer.
    ...(needsSpace
      ? { unavailable: "Ort-Items erst nach Wahl eines Space – Adressen gehen immer" }
      : otherSpace
        ? { unavailable: "Ort-Items sucht dieser Speicher nur im geöffneten Space – Adressen gehen immer" }
        : {}),
  }
  return <LocationCore {...props} places={places} />
}

function LocationCore({
  label,
  field,
  geocode,
  reverseGeocode,
  requestMapPick,
  places,
}: LocationFieldProps & { places: LocationPlaces | undefined }) {
  // Der Karten-Pick ist Nutzerarbeit des Felds (Formularzustand, Regeln 6
  // und 10): Er beginnt, bevor die Rückrufe an die Karte gehen; jeder
  // Rückruf wendet über diese Arbeit an, gegen den Stand JETZT. Ein Space-
  // oder Typwechsel verwirft ihn nicht; passt ein Ergebnis nicht mehr, sagt
  // das Feld es. Die Rückwärtssuche ist Hintergrundarbeit, die im Rückruf
  // startet.
  const startPick = () => {
    if (!requestMapPick) return
    // Der Ortszustand vor dem Pick und der Schreibweg für Eingaben dieses
    // Stands, für „Abbrechen" (Regel 6): nach einem Wechsel schreibt er nichts.
    const original = field.value
    const restore = field.set
    const pick = field.begin("pick", "user", "Ort")
    requestMapPick({
      onPick: (pos) => {
        const taken = pick.apply((now) => {
          field.cancel("reverse")
          now.set({ ...now.value, position: pointFromLatLng(pos.lat, pos.lng), place: [] })
        })
        if (!taken || !reverseGeocode) return
        const reverse = field.begin("reverse", "background", "Adresse")
        reverseGeocode(pos, { signal: reverse.signal })
          .then((result) => {
            if (result) reverse.apply((now) => now.set({ ...now.value, address: result }))
          })
          .catch(() => {})
          .finally(() => reverse.finish())
      },
      // Marker = Ort-Item (B4): `true`, wenn das Feld ihn nimmt — oder ihn
      // sichtbar ablehnt. `false` heißt: kein Ort-Item, seine Position zählt.
      ...(places
        ? {
            onPickItem: (item: Item) => {
              let handled = false
              pick.apply((now) => {
                if (!now.checks?.isPlace(item)) return
                handled = true
                if (!now.checks.accepts(item)) {
                  now.refuse("liegt nicht im Space des Formulars")
                  return
                }
                field.cancel("reverse")
                now.set({ place: [`item:${item.id}`] })
              })
              return handled
            },
          }
        : {}),
      onCancel: () => {
        if (!pick.valid()) return
        pick.finish()
        field.cancel("reverse")
        restore(original)
      },
    })
  }
  return (
    <LocationWidget
      field={field}
      label={label}
      geocode={geocode}
      places={places}
      onPickOnMap={requestMapPick ? startPick : undefined}
    />
  )
}
