import type { Item } from "@real-life-stack/data-interface"
import { isPersonProjection } from "@real-life-stack/data-interface"
import type { OpenProfileOptions } from "@real-life-stack/toolkit"

/**
 * Wohin ein Klick auf einen Autor-Avatar führt.
 *
 * Seit Spec 04 §Profile erscheint jedes Mitglied des aktiven Space als
 * `person`-Item im Item-Strom, mit der Nutzer-Id als Item-Id. Für Mitglieder
 * gibt es damit EINEN Weg: das Detail-Panel, in dem die Person ohnehin steht.
 *
 * Der Profil-Dialog bleibt für die beiden Fälle, die das Item nicht abdeckt:
 * Menschen, die im aktiven Space kein Mitglied sind (Autor eines Items aus
 * einem anderen Space, Kontakt aus der Kontaktliste), und die Flächen, die es
 * nur dort gibt — eigener Editor, Kontakt- und Verifikationsaktionen. Die
 * ruft der Aufrufer mit `surface: "dialog"` ausdrücklich auf.
 */
export type ProfilZiel = { flaeche: "item"; itemId: string } | { flaeche: "dialog" }

export function waehleProfilZiel(
  userId: string,
  items: readonly Item[],
  options?: OpenProfileOptions,
): ProfilZiel {
  if (options?.surface === "dialog") return { flaeche: "dialog" }
  // Nur die PROJEKTION zählt: Ein Platzhalter trägt eine fremde Id und kann
  // gar nicht kollidieren, aber die Regel steht hier ausdrücklich, damit sie
  // es auch bliebe, wenn jemand einmal Ids vergibt (Spec 04 §Profile,
  // Regel 5 — unterschieden wird allein an `data.did`).
  const projektion = items.find((item) => item.id === userId && isPersonProjection(item))
  return projektion ? { flaeche: "item", itemId: projektion.id } : { flaeche: "dialog" }
}
