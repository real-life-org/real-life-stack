import { Store } from "lucide-react"
import { itemTypes, registerModuleHint } from "@real-life-stack/data-interface"
import { TOOLKIT_DEFINITION, composeModules, setModuleRegistry, type ModuleExtension } from "@real-life-stack/toolkit"

import { MarketplaceModule } from "./modules/marketplace-module"

/** Wo das DWeb Camp 2026 stattfand — der Ausschnitt, in dem die Karte aufgeht. */
export const DWEB_CAMP_VIEW = { center: [12.4066, 52.1183] as [number, number], zoom: 16 }
/** Die Woche des Camps — wo der Kalender aufgeht, wenn kein Termin den Blick lenkt. */
export const DWEB_CAMP_WEEK = "2026-07-08T12:00:00+02:00"

// Der Hinweis des Marktplatzes, beide Richtungen in einer Zeile (Spec 01,
// Der Ladevertrag, Punkt 1): Eine Ressource ist eine KLASSE, kein Feld.
registerModuleHint("resource", {
  test: (item) => itemTypes(item).includes("resource"),
  filter: () => ({ type: ["resource"] }),
})

/**
 * Was die Netzwerk-App dem Register hinzufügt (Spec 01, Regel 2): ein eigenes
 * Modul, der Marktplatz, und für Karte und Kalender die Konfiguration ihrer
 * Daten — ausdrücklich ersetzt, weil `options` ein Feld des Eintrags ist.
 * Alles andere kommt vollständig aus dem Toolkit. Bis zum 21.09.2026 baute
 * die App jede Linse selbst, mit eigenem Detail, eigener Auswahl und ohne
 * Adresse (Spec 01, Der Modul-Host, Regel 5).
 */
export const NETWORK_EXTENSION: ModuleExtension = {
  name: "network",
  definitions: [
    {
      id: "marketplace",
      label: "Marktplatz",
      icon: Store,
      fill: "bleed",
      maxWidth: "max-w-6xl",
      presents: ["resource"],
      options: { suggestType: "resource" },
      view: MarketplaceModule,
    },
  ],
  extensions: [
    { id: "map", options: { suggestType: "place", initialView: DWEB_CAMP_VIEW }, replaces: ["options"] },
    { id: "calendar", options: { suggestType: "event", initialVisibleDate: DWEB_CAMP_WEEK }, replaces: ["options"] },
  ],
}

setModuleRegistry(composeModules([TOOLKIT_DEFINITION, NETWORK_EXTENSION]))
