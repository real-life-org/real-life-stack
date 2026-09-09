/**
 * Die Stapelordnung der schwebenden Flaechen — an einer Stelle, weil sie sich
 * nur gemeinsam verstehen laesst.
 *
 * Spec: `docs/spec/01-app-composition.md` → Overlay-Flaechen.
 *
 * Der Fehler, den das verhindert: Der Emoji-Waehler lag auf 50 und damit unter
 * dem Detail-Panel (59–64). Im Feed war er sichtbar, im geoeffneten Panel nicht
 * — ein Klick, auf den nichts folgte.
 */

/** Unterste Ebene der Panel-Familie (Sidebar, schwebende Karte, Drawer). */
export const PANEL_Z_INDEX_BASE = 59
/** Oberste Ebene, die ein Panel-Stapel einnehmen darf. */
export const PANEL_Z_INDEX_CEILING = 64
/** Dialoge liegen ueber jedem Panel. */
export const DIALOG_Z_INDEX = 65
/**
 * Kurzlebige Auswahlflaechen, die an einem Element haengen: Emoji-Waehler,
 * Menues, Tooltips.
 *
 * Sie liegen ueber ALLEM, weil sie zu dem gehoeren, was sie geoeffnet hat —
 * und das kann im Feed stehen, im Panel oder im Dialog. Sie leben nur, solange
 * jemand sie benutzt; eine feinere Staffelung waere ein Vertrag ohne Fall.
 */
export const FLOATING_CHOICE_Z_INDEX = 66
