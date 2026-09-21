import { useMemo } from "react"
import type { User } from "@real-life-stack/data-interface"

import type { ContentComposerProps, PersonOption } from "../components/composer/content-composer"
import { useLocationPick } from "../components/map/location-pick"
import { nominatimGeocode, nominatimReverseGeocode } from "../lib/geocode"

/**
 * Die Laufzeit-Verdrahtung des Composers, geteilt von Erstellen UND
 * Bearbeiten, damit die beiden nie auseinanderlaufen: der Geocoder, die
 * Übergabe an die Karte zum Punkt-Setzen, und die Personen aus den
 * Mitgliedern des aktiven Space. (Dass der Karten-Pick im Bearbeiten fehlte,
 * war genau diese Drift — eine Quelle speist jetzt beide.)
 *
 * Feld- und Widget-Definitionen („Vorlagen") kommen aus dem Typ-Register;
 * hier stehen nur die Rückrufe je Space. Bis zum 21.09.2026 in der
 * Referenz-App (B0, Schritt 3).
 */
export function useItemComposerProps(members: readonly User[]): Partial<ContentComposerProps> {
  const { startPick, canPick } = useLocationPick()
  const peopleOptions = useMemo<PersonOption[]>(
    () => members.map((m) => ({ id: m.id, name: m.displayName ?? m.id })),
    [members],
  )
  return useMemo(
    () => ({
      geocode: nominatimGeocode,
      reverseGeocode: nominatimReverseGeocode,
      // Führt dieser Space keine Karte, wird der Pick gar nicht erst
      // angeboten: Das Widget zeigt den Karten-Knopf nur, wenn er da ist.
      // Ein Ort bleibt trotzdem eingebbar — die Adresssuche setzt die
      // Position, und ein Ort ist ein Datenfeld, keine Ansicht.
      requestMapPick: canPick ? startPick : undefined,
      peopleOptions,
      peopleQuickSuggestions: peopleOptions.slice(0, 10),
    }),
    [startPick, canPick, peopleOptions],
  )
}
