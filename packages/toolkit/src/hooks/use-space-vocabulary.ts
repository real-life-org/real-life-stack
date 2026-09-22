"use client"

import { useEffect, useMemo, useState } from "react"
import { isAggregateVisibleItemType, type Item, itemTypes } from "@real-life-stack/data-interface"

import { resolveTypePresentation } from "../components/preview/type-presentation"
import type { FilterTypeOption } from "../components/filter/types"
import { useOptionalConnector } from "./connector-context"

export interface SpaceVocabulary {
  /** Alle Tags des Space, alphabetisch. */
  tags: readonly string[]
  /** Alle Typen des Space, mit Beschriftung, Symbol und Farbe aus dem Register. */
  types: readonly FilterTypeOption[]
}

/**
 * Die reine Ableitung — ohne React, damit sie ohne Fläche testbar ist.
 *
 * Systemtypen fallen raus (`isAggregateVisibleItemType`): Nach „Reaktion" oder
 * „Beziehung" filtert niemand, sie sind keine eigenen Einträge.
 */
export function spaceVocabulary(items: readonly Item[]): SpaceVocabulary {
  const tags = new Set<string>()
  const typen = new Set<string>()
  for (const item of items) {
    if (!isAggregateVisibleItemType(item.type)) continue
    for (const t of itemTypes(item)) typen.add(t)
    for (const tag of item.tags ?? []) tags.add(tag)
  }
  return {
    tags: [...tags].sort(),
    types: [...typen].sort().map((id) => {
      const darstellung = resolveTypePresentation(id)
      // Symbol und Farbe kommen mit: Der Chip im Filter sieht damit aus wie
      // das Abzeichen auf der Karte, ohne dass die Filterschicht das
      // Typ-Register kennen muss.
      return {
        id,
        label: darstellung.label,
        icon: darstellung.badge?.icon,
        badgeClassName: darstellung.badge?.className,
      }
    }),
  }
}

/**
 * Das Vokabular des Space: welche Tags und Typen es hier überhaupt gibt.
 *
 * **Es gehört der Fläche, nicht dem Modul** — nach derselben Regel wie die
 * Suche (Spec 01, Regel 2a): Was sich Module teilen können, gehört der Fläche.
 * Der Filterwert überdauert ohnehin den Modulwechsel; böte jedes Modul eine
 * andere Auswahl an, könnte ein Filter aktiv sein, den die Karte im aktuellen
 * Modul gar nicht anzeigt und den man dort deshalb nicht mehr loswird.
 *
 * Bis zum 20.09.2026 leitete jedes Modul es selbst ab: `availableTags` stand
 * siebenmal im Code, `availableTypes` viermal — und die Kopien liefen
 * auseinander. Kanban sortierte nicht, der Kalender gab weder Symbol noch
 * Farbe mit, und die Karte nannte den Typ „event" kurzerhand „Events", während
 * überall sonst das Typ-Register die Beschriftung bestimmte.
 *
 * Ohne Connector zählt `fallbackItems`: Eine freistehende Ansicht bekommt ihre
 * Items als Prop und ist die einzige, die sie kennt. **Nur dann** — unter einem
 * Connector gilt der ganze Space, nicht die Auswahl eines einzelnen Moduls.
 * Sonst böte der Kalender nur die Typen seiner Termine an, und ein im Feed
 * gesetzter Filter wäre dort nicht mehr abwählbar. Ohne beides ist es leer,
 * statt zu werfen (Test).
 *
 * **Zwischenstand, nicht Ziel.** Heute leitet der Haken das Vokabular aus den
 * vorhandenen Items ab. Filter und Item-Typen sollen später **pro Space
 * konfigurierbar** sein (Anton, 20.09.2026); dann kommt die Liste aus der
 * Konfiguration des Space, und diese Ableitung bleibt höchstens der Rückfall
 * für einen Space ohne eigene. Dass es überhaupt nur EINE Ableitung gibt, ist
 * die Voraussetzung dafür: Es gibt genau eine Stelle umzustellen.
 */
export function useSpaceVocabulary(fallbackItems?: readonly Item[]): SpaceVocabulary {
  const connector = useOptionalConnector()
  // Nicht über `useItems`: Das besteht auf einem Connector, und der Haken hier
  // muss auch ohne einen laufen. Bedingt aufrufen dürfte man ihn nicht.
  const observable = useMemo(() => connector?.observe({}) ?? null, [connector])
  const [items, setItems] = useState<readonly Item[]>(() => observable?.current ?? [])
  useEffect(() => {
    if (!observable) {
      setItems([])
      return
    }
    setItems(observable.current)
    return observable.subscribe(setItems)
  }, [observable])
  // Ohne Connector zaehlt, was der Aufrufer mitbringt: Eine freistehende
  // Ansicht (Story, eingebetteter Kalender) bekommt ihre Items als Prop und
  // ist die einzige, die sie kennt. Sonst verlöre sie Tag- und Typfilter, die
  // sie vor dem 20.09.2026 selbst ableitete (Codex-Review zu #407, rls#408).
  const quelle = observable ? items : (fallbackItems ?? [])
  return useMemo(() => spaceVocabulary(quelle), [quelle])
}
