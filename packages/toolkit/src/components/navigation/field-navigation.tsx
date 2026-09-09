"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Item } from "@real-life-stack/data-interface"

/**
 * Wie ein Feld zu der Sicht fuehrt, die es darstellen kann: ein Datum in den
 * Kalender, eine Position auf die Karte.
 *
 * **Warum als Vertrag und nicht als Funktion im Toolkit.** Drei Dinge muessen
 * dafuer zusammenkommen, und nur eines davon gehoert dem Toolkit:
 *
 *   - WELCHES Modul ein Feld zeigt, steht im Modul-Register
 *     (`findModulePresenting`) — Toolkit.
 *   - WELCHE Module dieser Space fuehrt, weiss die App.
 *   - WIE man dorthin navigiert (Route, Fokus, Panel-Zustand), weiss ebenfalls
 *     die App.
 *
 * Also stellt die App die Verbindung her, und Flaechen wie `ItemMetaRow`
 * fragen nur: „Fuehrt dieses Feld irgendwohin?" Ohne Provider fuehrt es
 * nirgendwohin, und alles bleibt Text — kein toter Link, keine Ausnahme im
 * Aufrufer.
 */
export interface FieldNavigationValue {
  /**
   * Die Aktion fuer ein Feld dieses Items, oder `null`, wenn es dafuer keine
   * Sicht gibt: kein Modul, das es darstellt, oder eines, das dieser Space
   * nicht fuehrt.
   */
  openField(field: string, item: Item): (() => void) | null
}

const FieldNavigationContext = createContext<FieldNavigationValue | null>(null)

export function FieldNavigationProvider({
  value,
  children,
}: {
  value: FieldNavigationValue
  children: ReactNode
}) {
  return <FieldNavigationContext.Provider value={value}>{children}</FieldNavigationContext.Provider>
}

/**
 * Die Aktion fuer ein Feld — oder `null`. Aufrufer machen den Wert genau dann
 * anklickbar, wenn hier etwas zurueckkommt.
 */
export function useFieldLink(field: string, item: Item): (() => void) | null {
  const navigation = useContext(FieldNavigationContext)
  return navigation?.openField(field, item) ?? null
}
