// Modul-Register — die einzige Quelle fuer die Frage, welche Module es gibt.
//
// Spec: docs/spec/01-app-composition.md → "Modul-Register".
//
// Dieselbe Frage wurde vorher an fuenf Stellen unabhaengig beantwortet:
// Aktivierbarkeit im Space-Dialog, gueltige Modul-Segmente im Routing,
// Anzeigenamen, Dispatch der Flaeche und der Fallback der
// Benachrichtigungs-Navigation. Die Listen sind lautlos auseinandergelaufen —
// `collection` und `graph` fehlten in der Benachrichtigungs-Liste, und ein neu
// gebautes Modul erschien in der Uebersicht, liess sich aber in KEINEM Space
// aktivieren, weil der Eintrag im Dialog fehlte.
//
// Das Muster folgt dem Typ-Register (Spec 06), mit einem Unterschied: Ein
// Modul ist vollstaendig Darstellung. Es braucht darum keine UI-freie Schicht
// in data-interface; das Register lebt hier, und Apps haengen ihre Flaechen
// an die Ids.

import type { ComponentType } from "react"
import type { Group, Item, ModuleHintOptions, ModuleHints } from "@real-life-stack/data-interface"
import { isAggregateVisibleItemType, moduleHintsFor } from "@real-life-stack/data-interface"
import type { SelectionFocusVisibleArea } from "./selection-focus"
import { CalendarModule } from "../modules/calendar-module"
import { CollectionModule } from "../modules/collection-module"
import { FeedModule } from "../modules/feed-module"
import { GraphModule } from "../modules/graph-module"
import { MapModule } from "../modules/map-module"
import {
  Calendar,
  Columns3,
  List,
  Map as MapIcon,
  Newspaper,
  Share2,
  Waves,
  type LucideIcon,
} from "lucide-react"

/** Wie ein Modul den Content-Bereich fuellt (Spec 01, "Content-Bereich"). */
export type ModuleFill = "container" | "bleed"

/**
 * Was mit der Flaeche geschieht, wenn ein Panel offen ist.
 *
 * `inset` (Standard): die Flaeche rueckt zur Seite, das Panel steht daneben.
 * `overlay`: die Flaeche bleibt stehen, das Panel legt sich darueber.
 *
 * Nicht dasselbe wie `fill`: die Liste ist `bleed`, soll aber ausweichen —
 * sonst verdeckt das Panel Eintraege. Die Karte dagegen IST ihre Flaeche;
 * wuerde sie beim Oeffnen eines Details schmaler, zeigte sie weniger Welt.
 * Die schwebenden Controls ruecken in beiden Faellen ein, denn sie lesen
 * `--adaptive-panel-edge-right` selbst.
 */
export type ModulePanelFit = "inset" | "overlay"

/**
 * Props, die jede Modul-Flaeche entgegennimmt. Das Outlet reicht alle durch;
 * ein Modul nimmt, was es braucht. Bewusst ein gemeinsamer Vertrag statt
 * Sonderfaellen im Dispatch — sonst waere der Dispatch wieder eine Liste,
 * die weiss, welches Modul was bekommt.
 */
export interface ModuleViewProps {
  /** Aktiver Space; leer im Aggregat. */
  groupId: string
  /** Ob dieses Modul gerade sichtbar ist — relevant fuer `keepMounted`. */
  active: boolean
  /** Alle sichtbaren Spaces — fuer Module, die spaceuebergreifend zeigen. */
  groups?: readonly Group[]
  /** Sichtbarer Bereich fuer Fokus-Scrolling (siehe selection-focus.ts). */
  selectionFocusVisibleArea?: SelectionFocusVisibleArea
  /**
   * Die Items nach dem Ladevertrag, vom Host geladen und mit dem geteilten
   * Filter (Suche, Tags, Typen) bereits angewendet (Spec 01, Der Modul-Host,
   * Regel 2a): genau das, was der Kopf anzeigt. `undefined`, wenn das Modul
   * selbst laedt (`loads: "module"`) — dann filtert es auch selbst.
   */
  items?: Item[]
  itemsLoading?: boolean
}

/** Was der Modul-Host aus `options` liest (Spec 01, Der Modul-Host). */
export interface ModuleHostOptions {
  /** Vorschlag des Plusknopfs. Ein Vorschlag, kein Zaun: das Menue bietet alle Typen (Anton, 20.09.2026). */
  suggestType?: string
  /** Flaeche des Erstellens: `sheet` (Standard) oder `fullscreen` (der Feed). */
  createShell?: "sheet" | "fullscreen"
}

export interface ModuleEntry {
  /** Stabile Identitaet: URL-Segment und Schluessel in `Group.data.modules`. */
  id: string
  label: string
  icon: LucideIcon | ComponentType<{ className?: string }>
  /** Bekommt ein neu angelegter Space dieses Modul? */
  enabledByDefault?: boolean
  /** Standard: "container". */
  fill?: ModuleFill
  /**
   * Breite des Inhalts. Bei `fill: "container"` die des Containers, bei
   * `fill: "bleed"` die, an der sich Kopf UND Inhalt der Flaeche ausrichten —
   * die Lens liest sie aus der Flaeche, statt eine eigene zu fuehren.
   */
  maxWidth?: string
  /** Standard: "inset". */
  panelFit?: ModulePanelFit
  /**
   * Flaeche im Baum halten statt beim Modulwechsel abzubauen. Fuer Module,
   * deren Aufbau teuer ist — die Karte braucht WebGL-Kontext, Worker und
   * einen entfernten Style, zusammen rund eine Sekunde pro Mount.
   */
  keepMounted?: boolean
  /**
   * Item-Felder, die dieses Modul DARSTELLEN kann — die Karte einen Ort, der
   * Kalender ein Datum.
   *
   * Wofuer: Damit ein Datum in der Detailansicht in den Kalender fuehren kann
   * und eine Position auf die Karte, ohne dass die Ansicht die Module kennt.
   * Stuende die Zuordnung dort, waere sie eine zweite Liste neben diesem
   * Register — und die driftet, sobald ein Modul dazukommt oder wegfaellt
   * (Spec 01, Regel 1).
   *
   * Die Richtung ist Absicht: Nicht das Feld sucht sich ein Modul, sondern
   * das Modul erklaert, was es zeigen kann. So bringt eine App ihr eigenes
   * Modul samt Feld mit, ohne dass das Toolkit davon wissen muss.
   */
  presents?: readonly string[]
  /**
   * Wer die Items des Moduls laedt (Spec 01, Ladevertrag Punkt 4): `host`
   * (Standard) leitet den Filter aus `presents` ab; `module` sagt die Karte,
   * die nach Kartenausschnitt laedt — der Host stellt dann KEINE Abfrage.
   */
  loads?: "host" | "module"
  /**
   * Modulspezifische Konfiguration, die in den Ladevertrag eingeht (Kanban:
   * `statusField`) oder die Flaeche parametrisiert (Karte: `initialView`).
   * Heute statisch in der Erweiterung; sobald Module je Space konfigurierbar
   * sind, kommt derselbe Wert aus dem Space.
   */
  options?: ModuleHintOptions & ModuleHostOptions & Record<string, unknown>
  /**
   * Die Flaeche selbst. Fuer die Toolkit-Module liefert sie das Toolkit —
   * vollstaendig, lauffaehig ohne eine Zeile in der App (Spec 01, Der
   * Modul-Host). Eine App DARF sie in ihrer Erweiterung ersetzen oder ein
   * eigenes Modul mit eigener Flaeche hinzufuegen.
   */
  view?: ComponentType<ModuleViewProps>
}

/** Additive Ergaenzung eines VORHANDENEN Eintrags (Spec 01, Regel 2). */
export interface ModuleFragment extends Partial<Omit<ModuleEntry, "id">> {
  id: string
  /**
   * Felder, die diese Erweiterung AUSDRUECKLICH ersetzt (Spec 01, Regel 2):
   * eine App darf die Flaeche eines Toolkit-Moduls austauschen (Anton,
   * 21.09.2026), aber nur, wenn sie es sagt — ein gesetztes Feld ohne diese
   * Nennung bleibt ein Konflikt. Es gibt kein stilles Shadowing.
   */
  replaces?: readonly ModuleScalar[]
}

/**
 * Die Module, die das Toolkit mitliefert. Reihenfolge = Tab-Reihenfolge.
 * Feed, Kalender, Karte, Liste und Graph bringen ihre Flaeche mit (B0–B3);
 * Resonanz und Kanban folgen je in einem eigenen Schritt (B4, B5) und
 * werden bis dahin von der Referenz-App erweitert.
 */
export const TOOLKIT_MODULES: readonly ModuleEntry[] = Object.freeze([
  { id: "feed", label: "Feed", icon: Newspaper, enabledByDefault: true, maxWidth: "max-w-3xl", options: { suggestType: "post", createShell: "fullscreen" }, view: FeedModule },
  { id: "kanban", label: "Kanban", icon: Columns3, enabledByDefault: true, maxWidth: "max-w-5xl", presents: ["status"], options: { suggestType: "task" } },
  { id: "calendar", label: "Kalender", icon: Calendar, enabledByDefault: true, maxWidth: "max-w-5xl", presents: ["start"], options: { suggestType: "event" }, view: CalendarModule },
  { id: "map", label: "Karte", icon: MapIcon, enabledByDefault: true, fill: "bleed", keepMounted: true, panelFit: "overlay", presents: ["position"], loads: "module", options: { suggestType: "place" }, view: MapModule },
  // Opt-in — spec: docs/spec/modules/resonance.md
  { id: "resonance", label: "Resonanz", icon: Waves, maxWidth: "max-w-3xl", presents: ["statement"], options: { suggestType: "statement" } },
  // `maxWidth` auch ohne Container: Sie gilt fuer den Kopf der Flaeche UND
  // fuer den Inhalt — die Lens liest sie aus der Flaeche
  // (`useModuleContentClass`), statt eine eigene zu fuehren. Vorher stand die
  // Zahl fuenfmal im Code, und wer eine davon anfasste, rueckte Kopf und
  // Eintraege gegeneinander.
  { id: "collection", label: "Liste", icon: List, fill: "bleed", maxWidth: "max-w-6xl", view: CollectionModule },
  { id: "graph", label: "Graph", icon: Share2, fill: "bleed", panelFit: "overlay", view: GraphModule },
])

/**
 * Ein Beitrag zum Register: die Definition des Toolkits oder die Erweiterung
 * einer App (Spec 01, Regel 2: das Toolkit definiert, eine App erweitert,
 * Definition vor Erweiterung). Eine Erweiterung DARF eigene Module einfuehren
 * (`definitions`) und vorhandene ergaenzen (`extensions`).
 *
 * Ein Space erweitert das Register nicht (Regel 4): Es steht vor dem ersten
 * Render fest, der Space wechselt zur Laufzeit und WAEHLT (`Group.data.modules`).
 *
 * Bis zum 21.09.2026 hiess das „Schicht" — ein Wort, das Spec 00 gehoert.
 */
export interface ModuleExtension {
  /** Fuer Konfliktmeldungen ("toolkit", "app", …). */
  name: string
  definitions?: readonly ModuleEntry[]
  extensions?: readonly ModuleFragment[]
}

/** Das fertig zusammengesetzte, unveraenderliche Register. */
export type ModuleRegistry = readonly ModuleEntry[]

/** Die Definition des Toolkits — immer der erste Beitrag. */
export const TOOLKIT_DEFINITION: ModuleExtension = Object.freeze({
  name: "toolkit",
  definitions: TOOLKIT_MODULES,
})

const SCALARS = ["label", "icon", "enabledByDefault", "fill", "maxWidth", "keepMounted", "panelFit", "presents", "loads", "options", "view"] as const
export type ModuleScalar = (typeof SCALARS)[number]

/**
 * Setzt Schichten in der Reihenfolge Core → App zusammen und friert
 * das Ergebnis ein.
 *
 * Bewusst eine Funktion statt globaler Mutation: Wer waehrend des Imports
 * registriert und woanders beim Import liest, bekommt je nach
 * Importreihenfolge ein anderes Register — und merkt es nicht. Hier wird
 * einmal komponiert, einmal gesetzt, danach ist es unveraenderlich.
 *
 * Konflikte werden abgelehnt, nicht aufgeloest: Es gibt kein Shadowing,
 * still oder ausdruecklich (Spec 01, Regel 2).
 */
export function composeModules(beitraege: readonly ModuleExtension[]): ModuleRegistry {
  const order: string[] = []
  const byId = new Map<string, ModuleEntry>()
  /** Wer hat welches skalare Feld gesetzt — fuer die Konfliktmeldung. */
  const owner = new Map<string, Map<string, string>>()

  for (const layer of beitraege) {
    // Definitionen und Erweiterungen werden PRO SCHICHT abgearbeitet, nicht
    // erst alle Definitionen und dann alle Erweiterungen: Sonst koennte eine
    // fruehe Schicht ein Modul ergaenzen, das erst eine spaetere einfuehrt —
    // die Reihenfolge Core → App waere dann nur noch Dekoration.
    for (const def of layer.definitions ?? []) {
      if (byId.has(def.id)) {
        throw new Error(
          `[rls] Modul "${def.id}": Beitrag "${layer.name}" definiert es erneut. ` +
            `Ein vorhandenes Modul wird ergaenzt (extensions), nicht neu definiert.`,
        )
      }
      byId.set(def.id, { ...def })
      order.push(def.id)
      const fields = new Map<string, string>()
      for (const k of SCALARS) if (def[k] !== undefined) fields.set(k, layer.name)
      owner.set(def.id, fields)
    }

    for (const frag of layer.extensions ?? []) {
      const base = byId.get(frag.id)
      if (!base) {
        throw new Error(
          `[rls] Modul "${frag.id}": Beitrag "${layer.name}" will es ergaenzen, ` +
            `aber kein Eintrag fuehrt diese Id ein.`,
        )
      }
      const fields = owner.get(frag.id)!
      for (const k of SCALARS) {
        const value = frag[k]
        if (value === undefined) continue
        const held = fields.get(k)
        if (held !== undefined && !frag.replaces?.includes(k)) {
          throw new Error(
            `[rls] Modul "${frag.id}": "${k}" ist bereits von "${held}" gesetzt, ` +
              `Beitrag "${layer.name}" wuerde es ueberschreiben — ein Ersatz muss ausdruecklich sein: replaces: ["${k}"] (Spec 01, Regel 2).`,
          )
        }
        ;(base as unknown as Record<string, unknown>)[k] = value
        fields.set(k, layer.name)
      }
    }
  }

  return Object.freeze(order.map((id) => Object.freeze(byId.get(id)!)))
}

// Das aktive Register. Vor `setModuleRegistry` gilt allein die Core-Schicht,
// damit Toolkit-Flaechen (Storybook, Tests) ohne App-Bootstrap funktionieren.
let active: ModuleRegistry = composeModules([TOOLKIT_DEFINITION])
// Was zuletzt uebergeben wurde — nicht was gespeichert ist: Beim Binden
// wird eingefroren, also entsteht eine Kopie, und ein Identitaetsvergleich
// gegen `active` wuerde dasselbe Register faelschlich als anderes lesen.
let boundSource: ModuleRegistry | null = null

/**
 * Bindet das komponierte Register. **Genau einmal**, vor dem ersten Render.
 *
 * Ein zweiter Aufruf wird abgelehnt statt still zu ersetzen: Wer nach dem
 * ersten Render neu bindet, laesst Flaechen mit unterschiedlichen Registern
 * weiterlaufen — je nachdem, wann sie zuletzt gelesen haben. Das ist genau
 * die Importreihenfolgen-Abhaengigkeit, die dieses Design abschafft.
 */
export function setModuleRegistry(registry: ModuleRegistry): void {
  if (boundSource !== null && registry !== boundSource) {
    throw new Error(
      "[rls] Das Modul-Register ist bereits gebunden. Es wird einmal vor dem " +
        "ersten Render gesetzt; ein spaeterer Wechsel wuerde Flaechen mit " +
        "unterschiedlichen Registern zuruecklassen.",
    )
  }
  // Dieselbe Quelle erneut zu binden ist ein No-op — NICHT ein erneutes
  // Einfrieren: Wer das Quell-Array zwischendurch veraendert und nochmal
  // bindet, brachte die Aenderung sonst doch noch durch.
  if (boundSource === registry) return
  // Einfrieren statt darauf zu vertrauen, dass komponiert wurde: Ein normales
  // Array liesse sich nach dem Binden weiter veraendern, und die Zusicherung
  // "unveraenderlich" waere nur eine Absichtserklaerung. Kopiert wird flach,
  // damit spaetere Mutationen der Quelle nicht durchschlagen.
  active = Object.freeze(registry.map((m) => Object.freeze({ ...m })))
  boundSource = registry
}

/** Nur fuer Tests. */
export function resetModuleRegistryForTests(): void {
  active = composeModules([TOOLKIT_DEFINITION])
  boundSource = null
}

/**
 * Alle Module. IMMER aufrufen, nie das Ergebnis auf Modulebene festhalten:
 * `const IDS = moduleIds()` neben dem Import ist ein Schnappschuss, der eine
 * spaeter gebundene App-Schicht nicht mehr sieht.
 */
export function getModules(): ModuleRegistry {
  return active
}

export function getModule(id: string): ModuleEntry | undefined {
  return active.find((m) => m.id === id)
}

/** Alle bekannten Ids. Jede Flaeche, die Module aufzaehlt, leitet hieraus ab. */
export function moduleIds(): string[] {
  return active.map((m) => m.id)
}

/** Was ein neu angelegter Space fuehrt. */
export function defaultModuleIds(): string[] {
  return active.filter((m) => m.enabledByDefault).map((m) => m.id)
}

/** Kennt das Register diese Id? */
export function isKnownModule(id: string): boolean {
  return active.some((m) => m.id === id)
}

/**
 * Die Teilmenge einer gespeicherten `data.modules`-Liste, die diese App
 * darstellen kann — Reihenfolge bleibt erhalten, die Eingabe unveraendert.
 *
 * Eine unbekannte Id ist KEIN Fehler: Sie stammt aus einer anderen
 * App-Version. Sie bleibt gespeichert und wird nur nicht gezeigt. Wer
 * Garantien zaehlt ("mindestens ein Modul bleibt aktiv") oder ein Modul
 * AUSWAEHLT (Routing, Default-Tab), MUSS diese Liste nehmen und nicht die
 * rohe — sonst landet der Nutzer auf einem Modul, das diese App nicht
 * darstellen kann (rls#249).
 */
export function displayableModules(stored: readonly string[]): string[] {
  return stored.filter((id) => isKnownModule(id))
}

/**
 * Welche Module ein Space fuehrt — die EINE Stelle, an der aus einer
 * gespeicherten Liste eine benutzbare wird.
 *
 * Zuvor kombinierte jede Aufrufstelle `displayableModules` und Fallback
 * unterschiedlich: Routing mit Leer-Fallback, Space-Wechsel und
 * Benachrichtigungen ohne. Bei einem Space, dessen Liste nur fremde Ids
 * enthaelt, blieb dort eine leere Menge — und die feldbasierte Wahl fiel auf
 * das erstbeste Modul zurueck, statt der Position eines Items zu folgen.
 *
 * Ergebnis ist NIE leer: Bleibt nach dem Filtern nichts uebrig, gilt der
 * volle Satz. Ein Space ganz ohne Tab waere schlimmer als einer mit den
 * Vorgaben.
 */
export function resolveSpaceModules(stored?: readonly string[]): string[] {
  const displayable = displayableModules(stored ?? moduleIds())
  return displayable.length > 0 ? displayable : moduleIds()
}

/**
 * Das aktive Modul fuer einen Space — der Kandidat, wenn dieser Space ihn
 * fuehrt und das Register ihn kennt, sonst sein erstes Modul.
 *
 * Jede Stelle, die ein aktives Modul WAEHLT (URL ohne Modul, Space-Wechsel,
 * Sprung aus einer Benachrichtigung, gespeicherte Vorauswahl), benutzt
 * diese Funktion — damit dieselbe Frage nicht an vier Stellen unterschiedlich
 * beantwortet wird.
 */
export function resolveActiveModule(
  candidate: string | undefined,
  stored?: readonly string[],
): string {
  const available = resolveSpaceModules(stored)
  return candidate && available.includes(candidate) ? candidate : available[0]
}

/**
 * Welches Modul kann dieses Item-Feld darstellen?
 *
 * Die Detailansicht fragt hier nach, statt selbst zu wissen, dass ein Datum in
 * den Kalender fuehrt und eine Position auf die Karte. Sonst stuende in ihr
 * eine zweite Modul-Liste (Spec 01, Regel 1).
 *
 * `verfuegbar` grenzt auf die Module ein, die der aktuelle Space fuehrt —
 * ohne Karte im Space bleibt der Ort schlicht Text. Ein Verweis auf eine
 * Flaeche, die es hier nicht gibt, waere schlimmer als gar keiner.
 *
 * Bei mehreren Kandidaten gewinnt der erste in Registerreihenfolge; die ist
 * zugleich die Tab-Reihenfolge und damit die Rangfolge, die der Nutzer sieht.
 */
export function findModulePresenting(
  field: string,
  verfuegbar?: readonly string[],
): ModuleEntry | undefined {
  const erlaubt = verfuegbar ? new Set(verfuegbar) : null
  return getModules().find(
    (modul) => modul.presents?.includes(field) && (!erlaubt || erlaubt.has(modul.id)),
  )
}

/**
 * Welches Feld ein Modul auswählt, wenn ein Item mehrere trägt.
 *
 * Entschieden mit Anton: Der Ort schlägt die Zeit — ein Termin an einem Ort
 * öffnet auf der Karte. Eine Aussage (Schema `statement/v1`, Spec 06) hat kein
 * eigenes Feld und geht trotzdem vor, weil der Feed sie nicht einzeln listet.
 *
 * Dieselbe Regel stand vorher viermal im Monorepo: in `resolveDefaultModule`
 * und `moduleCanDisplay` der Referenz-App und in `lensForHints` und
 * `lensCanDisplay` der Netzwerk-App. Die vier kannten verschiedene Module —
 * die eine kannte `resonance` nicht, die andere `marketplace` nicht.
 */
export const PRESENT_PRIORITY = ["statement", "position", "start", "status"] as const

/** `position` → `hasPosition`: so heißt das Feld im Hinweis-Objekt. */
function hintKey(field: string): keyof ModuleHints {
  return `has${field[0].toUpperCase()}${field.slice(1)}` as keyof ModuleHints
}

/**
 * Welches Modul zeigt dieses Item, wenn der Link keines nennt?
 *
 * `verfuegbar` sind die Module, die diese Fläche anbietet. Trägt das Item kein
 * Feld, das eines davon auswählt, kommt `undefined` zurück — den Rückfall
 * wählt die Anwendung, nicht die Regel: die Referenz-App den Feed, die
 * Netzwerk-App die Liste. Ein erstes-aus-der-Liste wäre hier falsch, es hat
 * einen Beitrag auf der Karte geöffnet.
 */
export function moduleForItem(
  itemOrHints: Item | ModuleHints,
  verfuegbar: readonly string[],
): string | undefined {
  const hints = moduleHintsFor(itemOrHints)
  for (const field of PRESENT_PRIORITY) {
    if (!hints[hintKey(field)]) continue
    const modul = findModulePresenting(field, verfuegbar)
    if (modul) return modul.id
  }
  return undefined
}

/**
 * Kann dieses Modul ein Item mit diesen Hinweisen überhaupt zeigen?
 *
 * Ein Modul, das ein Feld darstellt, braucht dieses Feld. Der Feed ist die
 * aggregierende Sicht: Er zeigt alles, was eine eigene Karte hat — welche
 * Typen das sind, sagt `isAggregateVisibleItemType`, nicht eine zweite Liste.
 * Module ohne `presents` (Sammlung, Graph) zeigen alles.
 */
export function modulePresentsItem(
  moduleId: string,
  itemOrHints: Item | ModuleHints | undefined,
  itemType?: string,
): boolean {
  if (moduleId === "feed") return itemType === undefined || isAggregateVisibleItemType(itemType)
  const modul = getModules().find((m) => m.id === moduleId)
  const felder = modul?.presents
  if (!felder?.length) return true
  if (!itemOrHints) return false
  const hints = moduleHintsFor(itemOrHints)
  return felder.some((field) => Boolean(hints[hintKey(field)]))
}
