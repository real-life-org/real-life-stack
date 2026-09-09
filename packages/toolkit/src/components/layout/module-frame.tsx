"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { getModule } from "../../lib/module-register"
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
export function moduleContainerClass(id: string): string | undefined {
  const mod = getModule(id)
  if (mod?.fill === "bleed") return undefined
  return `container mx-auto px-4 ${mod?.maxWidth ?? "max-w-3xl"}`
}

/**
 * Die Geometrie des Kopfes.
 *
 * Fuer Module mit Container ist es dieselbe wie fuer den Inhalt — genau darum
 * geht es (siehe oben). Randlose Module (`fill: "bleed"`) haben keinen
 * Container, aber ihr Inhalt hat trotzdem eine Breite: Die Liste zentriert bei
 * `max-w-6xl`. Woher der Kopf sie nimmt, sagt der Registereintrag
 * (`maxWidth`) — nicht der Frame, der sonst wuesste, was die Liste tut.
 */
function moduleHeadClass(id: string): string {
  const mod = getModule(id)
  if (mod?.fill !== "bleed") return moduleContainerClass(id) ?? "px-4"
  return `mx-auto w-full px-4 sm:px-6 ${mod.maxWidth ?? "max-w-6xl"}`
}

/**
 * Die zwei Slots, in die ein Modul seine Steuerung reicht: die Zeile OBEN
 * (Suche, Modul-Aktionen) und die schwebende Ecke UNTEN LINKS (Filter-Pille).
 *
 * Beide Elemente werden immer gerendert, auch leer: Sie sind die Portal-Ziele,
 * und ein Ziel, das erst entsteht, wenn jemand hineinportalt, gibt es nie.
 * Sichtbar ist der Kopf nur mit Beitrag (Spec 01, Regel 4) — die Pille haengt
 * nicht daran, sie steht auch ueber einer Flaeche ohne Kopf.
 */
interface ModuleHeadValue {
  element: HTMLElement | null
  /** Die schwebende Ecke unten links. */
  controlsElement: HTMLElement | null
  /**
   * Meldet einen Kopf-Beitrag an; die Rueckgabe meldet ihn wieder ab.
   *
   * `raeumtObenLinks`: Das Modul hat dort eigene Bedienelemente (die
   * Zoom-Knoepfe der Karte). Die schwebende Kopfzeile rueckt dann daneben,
   * statt sie zu verdecken — als Angabe des Moduls, nicht als zweite Fassung
   * des Kopfes.
   */
  anmelden(optionen?: { raeumtObenLinks?: boolean }): () => void
}

const ModuleHeadContext = createContext<ModuleHeadValue | null>(null)

/** Der Kopf der umgebenden Modulflaeche — `null`, wenn es keine gibt. */
export function useOptionalModuleHead(): ModuleHeadValue | null {
  return useContext(ModuleHeadContext)
}

export interface ModuleFrameProps {
  /** Id im Modul-Register — sie entscheidet Geometrie, Fuellmodus, Panel-Regel. */
  moduleId: string
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
export function ModuleFrame({ moduleId, children }: ModuleFrameProps) {
  const mod = getModule(moduleId)
  const bleed = mod?.fill === "bleed"
  const overlay = mod?.panelFit === "overlay"
  const geometrie = moduleContainerClass(moduleId)

  const [kopfElement, setKopfElement] = useState<HTMLElement | null>(null)
  const [controlsElement, setControlsElement] = useState<HTMLElement | null>(null)
  const [leisten, setLeisten] = useState(0)
  const [raeumtObenLinks, setRaeumtObenLinks] = useState(false)
  const kopf = useMemo<ModuleHeadValue>(
    () => ({
      element: kopfElement,
      controlsElement,
      anmelden(optionen) {
        setLeisten((n) => n + 1)
        if (optionen?.raeumtObenLinks) setRaeumtObenLinks(true)
        return () => setLeisten((n) => n - 1)
      },
    }),
    [kopfElement, controlsElement],
  )

  const hatKopf = leisten > 0

  const kopfSlot = (klasse?: string) => (
    <div data-module-head-slot ref={setKopfElement} className={cn(klasse)} />
  )
  const controlsSlot = <div data-module-controls ref={setControlsElement} />

  // Ueberlagerte Flaechen tragen DIESELBE Steuerung, nur schwebend (Spec 01,
  // Regel 5): Die Flaeche IST hier der Inhalt — ein Kopf im Fluss naehme der
  // Karte Welt weg. Gehostet wird sie trotzdem hier: Zwei Wirte fuer dieselben
  // Bausteine liefen auseinander, und genau das ist passiert (im Graphen fehlte
  // die Chip-Zeile, weil das Modul sie selbst haette bauen muessen).
  if (overlay) {
    return (
      <ModuleHeadContext.Provider value={kopf}>
        <div data-module-frame className="relative h-full w-full">
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
                "[&_[data-filter-chips]]:mt-2 [&_[data-filter-chips]]:w-fit",
              )}
            >
              {kopfSlot()}
            </div>
          </PanelSafeArea>
          <ModuleControls className={cn(raeumtObenLinks && "pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-4")}>
            {controlsSlot}
          </ModuleControls>
        </div>
      </ModuleHeadContext.Provider>
    )
  }

  return (
    <ModuleHeadContext.Provider value={kopf}>
      {/* `relative`: Die schwebende Ecke unten links misst sich an der
          Modulflaeche, nicht am Fenster (Board, Abschnitt „Positionen"). */}
      <div data-module-frame className="relative flex h-full min-h-0 flex-col">
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
          {kopfSlot(cn(moduleHeadClass(moduleId), "py-4"))}
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
        <ModuleControls>{controlsSlot}</ModuleControls>
      </div>
    </ModuleHeadContext.Provider>
  )
}

export interface ModuleControlsProps {
  children: ReactNode
  className?: string
}

/**
 * Die schwebende Ecke unten links einer Modulflaeche — Heimat der
 * Filter-Pille (Design-Board: `bottom:16px; left:16px`).
 *
 * Sie liegt in einer `PanelSafeArea`, damit sie wie jedes schwebende
 * Bedienelement dem offenen Panel ausweicht (Spec 01 → Content-Bereich,
 * Pflicht 2). Ueberlagerte Module (Karte, Graph) setzen sie selbst, weil ihre
 * Flaeche der Inhalt ist und sie ohnehin schon eine Schutzzone fuehren.
 */
export function ModuleControls({ children, className }: ModuleControlsProps) {
  return (
    <PanelSafeArea className={cn("z-30 flex items-end p-4", className)}>{children}</PanelSafeArea>
  )
}
