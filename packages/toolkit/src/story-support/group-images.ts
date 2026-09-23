/**
 * Gruppenbilder fuer die Beispieldaten von Stories und Handbuch: ein Lucide-Symbol
 * auf farbigem Grund als SVG-Data-URI, damit die Beispiele ohne Netz und ohne
 * Bilddateien echte Gruppenbilder zeigen. Pfade aus lucide-react (ISC).
 *
 * Diese Datei gehoert nicht zur Bibliothek; `src/index.ts` exportiert sie nicht.
 */

function iconImage(paths: string[], background: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="6" fill="${background}"/>` +
    `<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(4.5 4.5) scale(.625)">` +
    paths.map((d) => `<path d="${d}"/>`).join("") +
    `</g></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Gemeinschaftsgarten: Sproessling auf Gruen. */
export const GARDEN_IMAGE = iconImage(
  [
    "M7 20h10",
    "M10 20c5.5-2.5.8-6.4 3-10",
    "M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z",
    "M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z",
  ],
  "#2f855a"
)

/** Offene Werkstatt: Schraubenschluessel auf Blau. */
export const WORKSHOP_IMAGE = iconImage(
  [
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  ],
  "#3b5bdb"
)
