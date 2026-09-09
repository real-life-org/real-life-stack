"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Item } from "@real-life-stack/data-interface"

/**
 * Wie ein Klick auf den Kommentar-Hinweis ins Kommentarfeld fuehrt.
 *
 * Wer den Hinweis antippt, will schreiben — nicht erst das Item oeffnen und
 * dann das Feld suchen. Dazwischen liegen aber drei Schritte, die das Toolkit
 * nicht kennt: die Route des Items, das Panel, das sich oeffnet, und das
 * Eingabefeld darin. Also stellt die App die Verbindung her, und die Karte
 * fragt nur: „Fuehrt der Hinweis irgendwohin?"
 *
 * Ohne Provider bleibt er, was er war: eine Auskunft. Ein Knopf, der nichts
 * tut, waere schlimmer als schlichter Text.
 *
 * Schwester von {@link FieldNavigationValue} — dort fuehrt ein FELD zu einer
 * Sicht, hier ein Item zu einer Handlung darin.
 */
export interface CommentNavigationValue {
  /**
   * Die Aktion fuer dieses Item, oder `null`, wenn es keinen Weg gibt (etwa
   * weil man das Item bereits offen hat).
   */
  openComments(item: Item): (() => void) | null
}

const CommentNavigationContext = createContext<CommentNavigationValue | null>(null)

export function CommentNavigationProvider({
  value,
  children,
}: {
  value: CommentNavigationValue
  children: ReactNode
}) {
  return (
    <CommentNavigationContext.Provider value={value}>{children}</CommentNavigationContext.Provider>
  )
}

/** Der Weg ins Kommentarfeld dieses Items — oder `null`. */
export function useCommentLink(item: Item): (() => void) | null {
  const navigation = useContext(CommentNavigationContext)
  return navigation?.openComments(item) ?? null
}
