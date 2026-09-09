"use client"

import type { ReactNode } from "react"

import { cn } from "../../lib/utils"

export interface ModuleToolbarProps {
  children: ReactNode
  className?: string
}

/**
 * Die Steuerleiste eines Moduls — Filter, Suche, Ansichtswechsel.
 *
 * **Sie bleibt oben stehen.** Mitscrollen hiess: Wer weit unten in einer langen
 * Liste filtern will, muss erst zurueck nach oben.
 *
 * **Warum klebend und nicht ausserhalb des Scrollbereichs.** Erst lag sie in
 * einem eigenen Kopf der Modulflaeche — dann aber ausserhalb des
 * Modul-Containers, der Randabstand, Zentrierung und Hoechstbreite setzt. Die
 * Leiste sass am Fensterrand, waehrend die Karten zentriert standen, und die
 * Scrollleiste verschob die Zentrierung des Inhalts um weitere Pixel gegen den
 * Kopf. Beides zu flicken hiesse, dieselbe Geometrie an zwei Orten zu pflegen.
 *
 * Hier steht sie im selben Container wie der Inhalt und erbt seine Geometrie —
 * es gibt keine zweite, die abweichen koennte.
 *
 * `-mx-4 px-4` zieht den Hintergrund ueber den Rand des Containers hinaus:
 * sonst schiene der Inhalt links und rechts daneben durch, waehrend er darunter
 * wegscrollt.
 */
export function ModuleToolbar({ children, className }: ModuleToolbarProps) {
  return (
    <div
      data-module-toolbar
      className={cn(
        // Der Abstand nach unten gehoert der Leiste allein — `mb-0!` nimmt den
        // Abstand weg, den der Container ihr sonst gibt (`space-y-*` setzt in
        // Tailwind v4 ein `margin-bottom` auf jedes Kind ausser dem letzten).
        //
        // Warum: Im Ruhezustand zaehlten beide zusammen, beim Kleben nur die
        // eigene Polsterung — der Inhalt rueckte also beim Scrollen naeher
        // heran. Und weil die Module unterschiedliche Container-Abstaende
        // haben (`space-y-4` im Feed, `space-y-3` im Kalender), waere jede
        // Rechnung mit ihnen ohnehin eine, die driftet.
        "sticky top-0 z-20 -mx-4 bg-background px-4 pb-4 mb-0!",
        // Der Container gibt oben 16px; die uebernimmt die Leiste, damit beim
        // Kleben kein Inhalt in dieser Luecke durchscheint.
        "-mt-4 pt-4",
        className,
      )}
    >
      {children}
    </div>
  )
}
