/**
 * Deutsches Wörterbuch — die REFERENZ für alle Schlüssel.
 *
 * `ToolkitMessageKey` wird aus dieser Datei abgeleitet; `en.ts` ist dagegen
 * getypt. Ein Schlüssel, der hier fehlt, ist ein Compilerfehler beim Aufrufer
 * von `t` (rls#614 — `t` nimmt keinen freien String an); einer, der in `en.ts`
 * fehlt, ein Compilerfehler dort. Es gibt keinen Zustand, in dem eine Sprache
 * still hinterherhinkt.
 *
 * Flache Schlüssel (`bereich.name`), Werte sind Strings oder Plural-Objekte
 * nach den Kategorien von `Intl.PluralRules` (`one`/`other` reicht für DE/EN;
 * weitere Sprachen bringen ihre Kategorien mit, ohne dass sich das Format
 * ändert). Platzhalter in geschweiften Klammern: `{name}`, `{count}`.
 *
 * Bewusst 1:1 nach JSON übersetzbar: sollte später ein Übersetzungswerkzeug
 * oder i18next andocken, sind diese Dateien der Bestand — nur die Laufzeit
 * würde getauscht.
 */
export const de = {
  // --- Nutzermenü ---
  "userMenu.profile": "Profil",
  "userMenu.contacts": "Kontakte",
  "userMenu.verify": "Verifizieren",
  "userMenu.settings": "Einstellungen",
  "userMenu.logout": "Abmelden",
  "userMenu.language": "Sprache",

  // --- Build-Zeile im Nutzermenü ---
  "build.title": "Version · Commit · Kanal — antippen kopiert",
  "build.ariaLabel": "Build {build}, antippen kopiert",
  "build.copied": "kopiert",

  // --- Zeit ---
  "time.justNow": "gerade eben",
  "time.until": "bis",
  "time.allDay": "Ganztägig",

  // --- Item-Karte ---
  "item.editedBy": "Bearbeitet von {name} am {date}",
  "item.edited": "bearbeitet",
} as const

/** Ein Eintrag: fester Text oder Plural-Formen nach `Intl.PluralRules`. */
export type Message = string | (Partial<Record<Intl.LDMLPluralRule, string>> & { other: string })

/** Die Schlüssel, die das Toolkit selbst mitbringt. */
export type ToolkitMessageKey = keyof typeof de

/**
 * Das erweiterbare Register der App-Schlüssel (rls#614).
 *
 * Leer im Toolkit; eine App trägt ihre Schlüssel per Deklarations-
 * verschmelzung ein und bekommt damit dieselbe Compilerprüfung für `t` und
 * `extendMessages` wie das Toolkit selbst:
 *
 * ```ts
 * declare module "@real-life/toolkit" {
 *   interface AppMessages {
 *     "myApp.greeting": string
 *   }
 * }
 * ```
 *
 * Nur die Schlüssel zählen, der Werttyp ist Doku. Für Schlüssel, die erst zur
 * Laufzeit entstehen (Register-Ids, Instanz-Texte), gibt es `tDynamic`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppMessages {}

/** Jeder Schlüssel, den `t` annimmt: Toolkit plus App-Register. */
export type MessageKey = ToolkitMessageKey | Extract<keyof AppMessages, string>
