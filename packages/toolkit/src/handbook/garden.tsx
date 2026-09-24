import { HostWorld } from '../story-support/host-world'
import { seed } from './garden-data'

/**
 * Der Gemeinschaftsgarten: die Beispiel-App des Handbuchs. Was hier steht,
 * ist alles, was eine App stellt — einen Bestand (`garden-data.ts`), einen
 * Space und den Rahmen. Module, Panel, Erstellen, Detail und Karte kommen aus
 * dem Toolkit, über dieselbe Story-Welt wie alle App-Stories.
 *
 * Bis zum 24.09.2026 war der Garten ein Nachbau aus Bausteinen (eigenes
 * Panel, eigene Kartenansicht, eigene Tabs) und wich darum von der App ab:
 * Abdunkelung über der Karte, Marker nicht über dem Drawer zentriert. Ein
 * Nachbau kann nichts beweisen — der echte Rahmen schon.
 */
export function GardenDemo({
  readOnly = false,
  module = 'feed',
}: {
  /** Nur lesen: kein Plusknopf, kein Bearbeiten, alles sichtbar. */
  readOnly?: boolean
  /** Modul beim Start: `feed`, `calendar` oder `map`. */
  module?: string
}) {
  return <HostWorld seed={seed} group="garden" module={module} readOnly={readOnly} />
}
