/**
 * Typtests für den Schlüsselvertrag der i18n-Laufzeit (rls#614).
 *
 * Läuft nicht in vitest, sondern im Typecheck des Toolkits
 * (`tsc -p tsconfig.typetest.json`, Teil von `pnpm typecheck`). Jede
 * `@ts-expect-error`-Zeile MUSS einen Fehler treffen — ein unbenutztes
 * `@ts-expect-error` ist selbst ein Fehler (TS2578). Genau so fiel auf, dass
 * `t` vorher jeden String annahm.
 *
 * Importiert wird über den Paketnamen, wie eine App es tut: die
 * Erweiterung unten ist dieselbe Deklarationsverschmelzung, die eine App für
 * ihre eigenen Schlüssel schreibt.
 */
import { extendMessages, getI18n, type MessageKey } from "@real-life/toolkit"

declare module "@real-life/toolkit" {
  interface AppMessages {
    "typeTest.greeting": string
    "typeTest.groups": string
  }
}

const i18n = getI18n()

// --- Toolkit-Schlüssel: geprüft ---
i18n.t("userMenu.contacts")
// @ts-expect-error — Tippfehler in einem Toolkit-Schlüssel ist ein Compilerfehler
i18n.t("userMenu.contatcs")
// @ts-expect-error — ein beliebiger String ist kein Schlüssel
i18n.t("irgendwas" as string)

// --- App-Schlüssel über das erweiterbare Register: ebenso geprüft ---
i18n.t("typeTest.greeting")
// @ts-expect-error — Tippfehler in einem App-Schlüssel
i18n.t("typeTest.greting")

extendMessages({
  de: { "typeTest.greeting": "Hallo", "typeTest.groups": { one: "{count} Gruppe", other: "{count} Gruppen" } },
  en: { "typeTest.greeting": "Hello" },
})
extendMessages({
  // @ts-expect-error — extendMessages prüft die Schlüssel gegen das Register
  de: { "typeTest.unbekannt": "x" },
})

const key: MessageKey = "typeTest.groups"
i18n.t(key, { count: 2 })

// --- Wirklich zur Laufzeit berechnete Schlüssel: nur über tDynamic ---
const moduleId: string = "kanban"
i18n.tDynamic(`module.${moduleId}.label`)
i18n.tDynamic("userMenu.contacts", {})
