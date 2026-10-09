import type { Message, ToolkitMessageKey } from "./de"

/**
 * Englisches Wörterbuch — gegen die Schlüssel von `de.ts` getypt.
 *
 * `satisfies` statt Typannotation: die Werte bleiben literal, und ein
 * fehlender ODER überzähliger Schlüssel ist ein Compilerfehler genau hier.
 */
export const en = {
  "userMenu.profile": "Profile",
  "userMenu.contacts": "Contacts",
  "userMenu.verify": "Verify",
  "userMenu.settings": "Settings",
  "userMenu.logout": "Log out",
  "userMenu.language": "Language",

  "build.title": "Version · commit · channel — tap to copy",
  "build.ariaLabel": "Build {build}, tap to copy",
  "build.copied": "copied",

  "time.justNow": "just now",
  "time.until": "until",
  "time.allDay": "All day",

  "item.editedBy": "Edited by {name} on {date}",
  "item.edited": "edited",
} satisfies Record<ToolkitMessageKey, Message>
