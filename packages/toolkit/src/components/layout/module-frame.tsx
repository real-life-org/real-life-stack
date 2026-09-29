"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { Item } from "@real-life-stack/data-interface"

import { FilterPill } from "../filter/filter-pill"
import { useOptionalSharedFilter } from "../filter/filter-store"
import { ModuleFilterChips } from "../filter/module-filter-chips"
import { ModuleSearchBar } from "../filter/module-search-bar"
import { useGroupVocabulary } from "../../hooks/use-group-vocabulary"
import { getModule, type ModuleFill, type ModulePanelFit } from "../../lib/module-register"
import { cn } from "../../lib/utils"
import { PanelSafeArea } from "./panel-safe-area"

/**
 * Die Geometrie eines Moduls: Randabstand, Zentrierung, Hoechstbreite.
 *
 * **Eine Funktion fuer beide Teile der Spalte.** Kopf und Scrollbereich sind
 * zwei Elemente, aber eine Geometrie. Der erste Versuch gab jedem seine
 * eigene — die Leiste sass am Fensterrand, waehrend die Karten zentriert
 * standen, und die Scrollleiste verschob die Zentrierung des Inhalts um
 * weitere Pixel gegen den Kopf. Zwei Angaben derselben Sache driften, sobald
 * jemand eine davon anfasst.
 *
 * 16px Randabstand, wie das schwebende Panel: Ein Modul, das weiter vom Rand
 * steht als die Karte daneben, laesst das Fenster schief wirken.
 *
 * KEIN vertikales Polster: Das gehoert dem Kopf und dem Scrollbereich, die es
 * unterschiedlich brauchen (mit Kopf oben 0, ohne Kopf oben 16px).
 *
 * `undefined` fuer randlose Module (`fill: "bleed"`) — dort gibt es keinen
 * Container, das Modul fuellt die Flaeche.
 */
export interface ModuleLayout {
  /** Standard "container". */
  fill: ModuleFill
  /** Standard "inset". */
  panelFit: ModulePanelFit
  /** Breite des Inhalts; ohne Angabe je nach Fuellmodus die Vorgabe unten. */
  maxWidth?: string
}

/**
 * Das Layout einer Flaeche: aus dem Register, wenn eine Id vorliegt, sonst aus
 * dem, was der Aufrufer mitbringt.
 *
 * Zwei Wege, ein Ergebnis: In der App entscheidet der Registereintrag (Spec 01,
 * Regel 1 — es gibt keine zweite Modul-Liste). Eine Flaeche, die AUSSERHALB
 * der App laeuft, hat keine Id und sagt es darum selbst.
 */
export function resolveModuleLayout(
  quelle: { moduleId?: string } & Partial<ModuleLayout>,
): ModuleLayout {
  const eintrag = quelle.moduleId ? getModule(quelle.moduleId) : undefined
  return {
    fill: quelle.fill ?? eintrag?.fill ?? "container",
    panelFit: quelle.panelFit ?? eintrag?.panelFit ?? "inset",
    maxWidth: quelle.maxWidth ?? eintrag?.maxWidth,
  }
}

export function moduleContainerClass(layout: ModuleLayout): string | undefined {
  if (layout.fill === "bleed") return undefined
  return `container mx-auto px-4 ${layout.maxWidth ?? "max-w-3xl"}`
}

/**
 * Die Breite des Inhalts einer randlosen Flaeche (`fill: "bleed"`).
 *
 * Es gibt dort keinen Container, aber sehr wohl eine Breite: Die Liste
 * zentriert ihre Eintraege. Die stand frueher fuenfmal im Code — in der Lens,
 * im Raster, in der Kopfzeile, im Register und in der Netzwerk-App —, und wer
 * eine davon anfasste, rueckte Kopf und Eintraege gegeneinander. Jetzt sagt
 * sie der Registereintrag (`maxWidth`), und alle lesen DIESE Funktion.
 */
export function moduleBleedContentClass(layout: Partial<ModuleLayout>): string {
  return `mx-auto w-full px-4 sm:px-6 ${layout.maxWidth ?? "max-w-6xl"}`
}

/**
 * Die Geometrie des Kopfes.
 *
 * Fuer Module mit Container ist es dieselbe wie fuer den Inhalt — genau darum
 * geht es (siehe oben). Randlose Module nehmen die Breite ihres Inhalts, aus
 * derselben Funktion wie der Inhalt selbst.
 */
function moduleHeadClass(layout: ModuleLayout): string {
  if (layout.fill !== "bleed") return moduleContainerClass(layout) ?? "px-4"
  return moduleBleedContentClass(layout)
}

/**
 * Das aufgeloeste Layout der umgebenden Modulflaeche — `null`, wenn es keine
 * gibt (Story, Test, eingebettete Ansicht ohne Huelle).
 */
const ModuleLayoutContext = createContext<ModuleLayout | null>(null)

/**
 * Which geometry does the module surface prescribe?
 *
 * @answers `ModuleLayout | null`
 * @without null
 * @group surface
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useModuleLayout(): ModuleLayout | null {
  return useContext(ModuleLayoutContext)
}

/**
 * In which width does the content stand?
 *
 * Die Breite, in der der Inhalt dieser Flaeche steht.
 *
 * Fuer Lenses: Sie zentrieren ihre Eintraege damit auf dieselbe Kante wie der
 * Kopf darueber. Ohne Flaeche gilt die Vorgabe — dann bestimmt die Lens ihre
 * Breite selbst, weil niemand sonst es tut.
 *
 * @answers `string`
 * @without value — default
 * @group surface
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useModuleContentClass(): string {
  return moduleBleedContentClass(useModuleLayout() ?? {})
}

/**
 * Die Slots, in die ein Modul seine Steuerung reicht: rechts NEBEN der Suche
 * (eigene Knoepfe), darunter die Chip-Zeile, und die Filterkarte.
 *
 * Die schwebende Ecke UNTEN LINKS ist KEIN Slot: Sie gehoert der Filter-Pille,
 * gegenueber steht der Erstellen-Knopf (rls#567). Knoepfe eines Moduls gehen
 * in den Kopf (Spec 01, Regel 2).
 *
 * Die Suche selbst ist KEIN Slot — sie gehoert der Flaeche und wird von ihr
 * gerendert (Anton, 19.09.2026).
 *
 * Beide Elemente werden immer gerendert, auch leer: Sie sind die Portal-Ziele,
 * und ein Ziel, das erst entsteht, wenn jemand hineinportalt, gibt es nie.
 * Sichtbar ist der Kopf nur mit Beitrag (Spec 01, Regel 4) — die Pille haengt
 * nicht daran, sie steht auch ueber einer Flaeche ohne Kopf.
 */
interface ModuleHeadValue {
  /** Die Chip-Zeile unter der Suche. */
  element: HTMLElement | null
  /**
   * Der rechtsbuendige Platz NEBEN der Suche, fuer die Steuerelemente des
   * Moduls (Ansichtswechsel, „Heute", Ortungsknopf).
   *
   * Die Suche selbst gehoert der Flaeche und steht links davon; das Modul
   * portalt nur seine eigenen Knoepfe hierher.
   */
  actionsElement: HTMLElement | null
  /** Eigene Chips des Moduls, rechts neben den aktiven Filtern. */
  chipsElement: HTMLElement | null
  /** Eigene Abschnitte des Moduls in der Filterkarte. */
  drawerElement: HTMLElement | null
  /**
   * Hat die FLAECHE einen Filter-Besitzer ueber sich?
   *
   * Nicht dasselbe wie „sieht das Modul einen": Steht ein `FilterScope`
   * innerhalb des Frames, hat das Modul einen und die Flaeche keinen — dann
   * fehlen Suche, Chips und Pille, und die `ModuleToolbar` meldet die
   * Fehlverschachtelung (rls#570).
   */
  hatFilterBesitzer: boolean
  /** Meldet einen Kopf-Beitrag an; die Rueckgabe meldet ihn wieder ab. */
  anmelden(): () => void
  /**
   * Meldet an, dass das Modul die Ecke OBEN LINKS selbst belegt (die
   * Zoom-Knoepfe der Karte); die Rueckgabe gibt sie wieder frei. Die
   * schwebende Kopfzeile rueckt dann daneben, statt sie zu verdecken.
   *
   * **Unabhaengig vom Kopf-Beitrag.** Ob das Modul dort Knoepfe hat, ist eine
   * Aussage ueber seine eigene Flaeche und hat nichts damit zu tun, ob es
   * gerade etwas in den Kopf reicht. Bis zum 20.09.2026 hing beides an einer
   * Anmeldung: Seit die Suche der Flaeche gehoert und nicht mehr als
   * Kopf-Beitrag zaehlt, blieb bei einer Karte ohne Ortungsknopf und ohne
   * aktive Filter die Anmeldung aus — und die Suche lag auf den Zoom-Knoepfen
   * (Codex-Review zu #405).
   */
  raeumeObenLinks(): () => void
}

const ModuleHeadContext = createContext<ModuleHeadValue | null>(null)

/**
 * Where does a module portal its toolbar?
 *
 * Der Kopf der umgebenden Modulflaeche — `null`, wenn es keine gibt.
 *
 * @answers `… | null`
 * @without null
 * @group surface
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useOptionalModuleHead(): ModuleHeadValue | null {
  return useContext(ModuleHeadContext)
}

export interface ModuleFrameProps extends Partial<ModuleLayout> {
  /**
   * Id im Modul-Register — sie entscheidet Geometrie, Fuellmodus und
   * Panel-Regel. In der App der Normalfall; eine eingebettete Flaeche hat
   * keine Id und gibt `fill`/`panelFit`/`maxWidth` direkt an.
   */
  moduleId?: string
  /**
   * Beschriftung des Suchfelds — sie benennt, was die Suche durchsucht.
   *
   * Nicht das Modul, sondern die Flaeche: Die Suche zieht sich durch alle
   * Module, also heisst sie sinnvollerweise nach dem Space und nicht nach dem
   * Modul, in dem man gerade steht.
   */
  searchLabel?: string
  /**
   * Items, aus denen das Vokabular abgeleitet wird, wenn es **keinen**
   * Connector gibt — der Fall einer freistehenden Ansicht (Story,
   * eingebetteter Kalender). Unter einem Connector gilt der ganze Space.
   */
  fallbackItems?: readonly Item[]
  children: ReactNode
}

/**
 * Die Modulflaeche als Spalte: fester Kopf, darunter der Scrollbereich
 * (Spec 01 → „Die Modulflaeche ist eine Spalte").
 *
 * **Warum Kopf statt klebender Leiste im Modul.** Vorher klebte die
 * Steuerleiste `sticky` im Scrollbereich. Das kostete zweierlei: Die
 * Scrollleiste lief hinter der Leiste bis zur Navbar hoch, obwohl dort nichts
 * mehr scrollt, und jedes Modul loeste das Kleben selbst — mit eigenen
 * Ausgleichs-Raendern (`-mx-4 -mt-4 pt-4 pb-4 mb-0!`) gegen den jeweiligen
 * Container-Abstand. Die Loesungen liefen auseinander (Spec 01, Regel 2).
 * Jetzt besitzt die FLAECHE den Kopf; das Modul reicht nur noch hinein.
 *
 * Kopf und Scrollbereich reservieren beide dieselbe Scrollleistenbreite
 * (`scrollbar-gutter: stable`, der Kopf mit `overflow: hidden`, damit die
 * Reservierung greift, ohne dass er scrollt). Sonst zentriert der Kopf auf
 * die volle Breite und der Inhalt auf die um die Leiste verminderte — die
 * halbe Leistenbreite Versatz, sichtbar an jeder Kartenkante.
 */
export function ModuleFrame({ moduleId, searchLabel, fallbackItems, children, ...vorgaben }: ModuleFrameProps) {
  const layout = resolveModuleLayout({ moduleId, ...vorgaben })
  const bleed = layout.fill === "bleed"
  const overlay = layout.panelFit === "overlay"
  const geometrie = moduleContainerClass(layout)

  const [kopfElement, setKopfElement] = useState<HTMLElement | null>(null)
  const [actionsElement, setActionsElement] = useState<HTMLElement | null>(null)
  const [chipsElement, setChipsElement] = useState<HTMLElement | null>(null)
  const [drawerElement, setDrawerElement] = useState<HTMLElement | null>(null)
  const [leisten, setLeisten] = useState(0)
  // Zaehler, kein Schalter: Sonst bliebe der Versatz stehen, wenn das Modul
  // mit den Knoepfen verschwindet.
  const [obenLinks, setObenLinks] = useState(0)
  // Der Kopf steht, sobald es die Suche gibt — sie zieht sich ausnahmslos
  // durch alle Module (Anton, 19.09.2026). Ohne Filter-Besitzer rendert die
  // Suche nichts; dann entscheiden wieder allein die Beitraege der Module, ob
  // der Kopf ueberhaupt eine Zeile bekommt (Spec 01, Regel 4).
  const hatSuche = !!useOptionalSharedFilter()
  const kopf = useMemo<ModuleHeadValue>(
    () => ({
      hatFilterBesitzer: hatSuche,
      element: kopfElement,
      actionsElement,
      chipsElement,
      drawerElement,
      anmelden() {
        setLeisten((n) => n + 1)
        return () => setLeisten((n) => n - 1)
      },
      raeumeObenLinks() {
        setObenLinks((n) => n + 1)
        return () => setObenLinks((n) => n - 1)
      },
    }),
    [hatSuche, kopfElement, actionsElement, chipsElement, drawerElement],
  )

  // Tags und Typen des Space: eine Ableitung fuer alle Module (Spec 01,
  // Regel 2a). Vorher leitete sie jedes Modul selbst ab, siebenmal fuer Tags
  // und viermal fuer Typen, mit auseinanderlaufenden Ergebnissen.
  const vokabular = useGroupVocabulary(fallbackItems)
  const hatKopf = hatSuche || leisten > 0
  const raeumtObenLinks = obenLinks > 0

  // Der Platz fuer die Steuerelemente des Moduls (`trailingActions`). Er
  // haengt NICHT an der Suche: Mit Besitzer steht er rechts neben ihr, ohne
  // allein (rls#570, Spec 01, Regel 3).
  const aktionsPlatz = (
    <div
      data-module-head-actions
      ref={setActionsElement}
      className="ml-auto flex shrink-0 items-center gap-2 empty:hidden"
    />
  )
  const kopfSlot = (klasse?: string) => (
    <div data-module-head-content className={cn("flex flex-col gap-2", klasse)}>
      {hatSuche ? (
        <ModuleSearchBar searchLabel={searchLabel} trailing={aktionsPlatz} />
      ) : (
        // Ohne Besitzer gibt es keine Suche, der Platz fuer die Aktionen des
        // Moduls steht trotzdem: rechtsbuendig in einer eigenen Zeile. Er war
        // bis rls#570 das `trailing` der Suche und verschwand mit ihr — die
        // Aktionen gingen still verloren, der Kopf blieb angemeldet und leer.
        <div className="flex items-center gap-2 has-[>:empty]:hidden">{aktionsPlatz}</div>
      )}
      <div data-module-head-slot ref={setKopfElement}>
        {/* Die Chips lesen den geteilten Filter — ohne Besitzer gibt es sie
            nicht, genau wie die Suche. Der Platz des Moduls bleibt trotzdem
            stehen: Er ist das Portal-Ziel und muss existieren, bevor jemand
            hineinreicht. */}
        {hatSuche ? (
          <ModuleFilterChips
            availableTypes={vokabular.types}
            chipsExtra={<span data-module-head-chips ref={setChipsElement} className="contents" />}
          />
        ) : (
          <span data-module-head-chips ref={setChipsElement} className="contents" />
        )}
      </div>
    </div>
  )
  const controlsSlot = (
    <div data-module-controls>
      {hatSuche && (
        <FilterPill
          availableTags={vokabular.tags}
          availableTypes={vokabular.types}
          drawerExtra={<span data-module-drawer ref={setDrawerElement} className="contents" />}
        />
      )}
    </div>
  )

  // Ueberlagerte Flaechen tragen DIESELBE Steuerung, nur schwebend (Spec 01,
  // Regel 5): Die Flaeche IST hier der Inhalt — ein Kopf im Fluss naehme der
  // Karte Welt weg. Gehostet wird sie trotzdem hier: Zwei Wirte fuer dieselben
  // Bausteine liefen auseinander, und genau das ist passiert (im Graphen fehlte
  // die Chip-Zeile, weil das Modul sie selbst haette bauen muessen).
  if (overlay) {
    return (
      <ModuleLayoutContext.Provider value={layout}>
      <ModuleHeadContext.Provider value={kopf}>
        <div
          data-module-frame
          className={cn(
            "relative h-full w-full",
            ECKE_ZEILE,
            raeumtObenLinks ? ECKE_UEBER_BOTTOM_NAV : ECKE_RAND,
          )}
        >
          {children}
          <PanelSafeArea
            className={cn("z-20 flex items-start p-4", raeumtObenLinks && "pl-16")}
          >
            <div
              data-module-head
              hidden={!hatKopf}
              // Das Suchfeld bekommt eine deckende Flaeche: Auf einer Karte
              // gibt es keinen ruhigen Untergrund. Die Chips brauchen keine
              // zweite Huelle, sie sind selbst Pillen mit Flaeche; ein Rahmen
              // um die Zeile wirkte wie ein Fremdkoerper (Anton, 09.09.).
              className={cn(
                "[&_input]:bg-card!",
                // Kein eigener Abstand nach oben: Den gibt die Spalte (`gap-2`) schon,
                // genau wie im Kopf der Container-Module. Ein zweiter Rand
                // machte ihn ueber der Karte doppelt so gross (Anton, 10.09.).
                "[&_[data-filter-chips]]:w-fit",
              )}
            >
              {kopfSlot()}
            </div>
          </PanelSafeArea>
          <SchwebendeEcke>{controlsSlot}</SchwebendeEcke>
        </div>
      </ModuleHeadContext.Provider>
      </ModuleLayoutContext.Provider>
    )
  }

  return (
    <ModuleLayoutContext.Provider value={layout}>
    <ModuleHeadContext.Provider value={kopf}>
      {/* `relative`: Die schwebende Ecke unten links misst sich an der
          Modulflaeche, nicht am Fenster (Board, Abschnitt „Positionen"). */}
      <div data-module-frame className={cn("relative flex h-full min-h-0 flex-col", ECKE_ZEILE, ECKE_GRUNDLINIE)}>
        <div
          data-module-head
          hidden={!hatKopf}
          // Dieselbe Rinne wie unter ihm — beim Container der Scrollbereich
          // des Frames, bei randlosen Modulen der Scrollbereich des Moduls
          // (die Lens reserviert sie ebenfalls). Ohne die Reservierung
          // zentriert der Kopf auf die volle Breite und der Inhalt auf die um
          // die Scrollleiste verminderte: ein halber Leistenversatz an jeder
          // Kartenkante.
          className="shrink-0 overflow-hidden bg-background [scrollbar-gutter:stable]"
        >
          {kopfSlot(cn(moduleHeadClass(layout), "py-4"))}
        </div>

        {bleed ? (
          // Das Modul fuellt die Flaeche und scrollt selbst (Liste).
          <div data-module-fill className="min-h-0 flex-1">
            {children}
          </div>
        ) : (
          <div
            data-module-scroll
            className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
          >
            {/* Oben polstert der Kopf, wenn es einen gibt — sonst der Inhalt
                selbst; unten immer, sonst endet die Seite mit der letzten
                Karte (am Desktop ohne untere Navigation sichtbar). */}
            <div className={cn(geometrie, hatKopf ? "pb-4" : "py-4")}>{children}</div>
          </div>
        )}

        {/* Die schwebende Steuerung gehoert der Flaeche wie der Kopf: Sie
            weicht dem Panel aus (PanelSafeArea) und liegt ueber dem Inhalt,
            statt ihm eine Zeile wegzunehmen. Unten polstert sie so weit wie
            der Erstellen-Knopf gegenueber. */}
        <SchwebendeEcke>{controlsSlot}</SchwebendeEcke>
      </div>
    </ModuleHeadContext.Provider>
    </ModuleLayoutContext.Provider>
  )
}

/*
 * Die Ecke unten links und die Hoehe, die sie belegt (rls#567).
 *
 * Der Frame meldet sie als `--module-controls-block` an seiner Wurzel
 * (`[data-module-frame]`): Abstand vom unteren Rand der Flaeche bis zur
 * Oberkante der Zeile aus Filter-Pille und Erstellen-Knopf. Wer eine Flaeche
 * einpasst oder unten polstert, liest diese Variable, statt zu schaetzen.
 *
 * Die Angabe setzt sich aus zwei Variablen zusammen, und das Polster der Ecke
 * liest dieselbe: Zwei Zahlen fuer eine Sache liefen auseinander.
 *
 *   - `--module-controls-inset` — Abstand der Zeile zum unteren Rand
 *   - `--module-controls-row` — Hoehe der Zeile, also ihres hoechsten
 *     Bewohners. Unter md der Erstellen-Knopf (`CreateFab` h-13 = 52px; die
 *     Pille 44px + Rand), ab md die Pille (48px + 2px Rand = 50px; der Knopf
 *     48px). Gemessen in der Reference-App, Telefon 390 und Desktop 1440.
 *
 * Literale Klassen, keine zusammengesetzten: Tailwind findet nur, was
 * woertlich im Quelltext steht.
 */
const ECKE_ZEILE =
  "[--module-controls-row:3.25rem] md:[--module-controls-row:calc(3rem+2px)] " +
  "[--module-controls-block:calc(var(--module-controls-inset)+var(--module-controls-row))]"

/**
 * Ohne Ueberlagerung: dieselbe Grundlinie wie der Erstellen-Knopf (5.25rem +
 * Schutzzone ueber der Bottom-Nav). Die Shell polstert schon 5rem, also nur
 * noch 0.25rem; mit 1rem stand der Filter 12px hoeher als der Plusknopf. Ab md
 * gibt es keine Bottom-Nav, dort gilt der normale Rand.
 */
const ECKE_GRUNDLINIE = "[--module-controls-inset:0.25rem] md:[--module-controls-inset:1rem]"

/**
 * Karte (`clearsTopLeft`): Ihre Flaeche reicht unter die Bottom-Nav, die Ecke
 * traegt den ganzen Abstand selbst.
 */
const ECKE_UEBER_BOTTOM_NAV =
  "[--module-controls-inset:calc(5.25rem+env(safe-area-inset-bottom))] md:[--module-controls-inset:1rem]"

/** Uebrige ueberlagerte Flaechen: der normale Rand. */
const ECKE_RAND = "[--module-controls-inset:1rem]"

/**
 * Die schwebende Ecke unten links einer Modulflaeche — Heimat der
 * Filter-Pille (Design-Board: `bottom:16px; left:16px`).
 *
 * Sie liegt in einer `PanelSafeArea`, damit sie wie jedes schwebende
 * Bedienelement dem offenen Panel ausweicht (Spec 01 → Content-Bereich,
 * Pflicht 2).
 *
 * **Intern seit rls#567.** Bis dahin war sie als `ModuleControls` exportiert,
 * und jeder Aufruf legte eine EIGENE Schutzzone an: Wer darin Knoepfe
 * einhaengte, stapelte sie auf die Pille. Die Ecke gehoert jetzt der Pille und
 * dem Erstellen-Knopf gegenueber; Knoepfe eines Moduls gehen ueber
 * `ModuleToolbar.trailingActions` in den Kopf (Spec 01, Regel 2), eigene
 * Filter-Abschnitte ueber `drawerExtra` in die Filterkarte.
 */
function SchwebendeEcke({ children }: { children: ReactNode }) {
  return (
    <PanelSafeArea className="z-30 flex items-end px-4 pt-4 pb-(--module-controls-inset)">{children}</PanelSafeArea>
  )
}
