/**
 * Die Texte des WoT-Connectors in der i18n-Laufzeit des Toolkits.
 *
 * Der Connector bringt seine Bildschirme mit und damit auch ihre Texte: beim
 * Laden dieses Moduls trägt er sie per `extendMessages` ein — jede App, die
 * `@real-life/wot-connector/components` importiert, bekommt sie ohne eigenen
 * Aufruf. Eine App kann einzelne Texte danach mit `extendMessages` oder eine
 * Instanz über `config.json: strings` übersteuern (beide stehen in der
 * Vorrangkette über diesem Eintrag).
 */
import { extendMessages, type Message } from "@real-life/toolkit"
import { de, type WotMessageKey } from "./de.js"
import { en } from "./en.js"

export type { WotMessageKey }

/** Typed `t()` für die Connector-Schlüssel — Declaration Merging ins Toolkit-Register. */
type WotMessages = { [K in WotMessageKey]: Message }

declare module "@real-life/toolkit" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AppMessages extends WotMessages {}
}

/** Beide Wörterbücher, z. B. für eigene Prüfungen einer App. */
export const wotMessages = { de, en } as const

/**
 * Trägt die Connector-Texte (erneut) ein. Läuft beim Laden des Moduls; von
 * Hand nur nötig nach `resetI18nForTests`, das auch Erweiterungen verwirft.
 */
export function registerWotMessages(): void {
  extendMessages(wotMessages)
}

registerWotMessages()
