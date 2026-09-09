"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"

import { cn } from "../../lib/utils"
import { TagChip } from "../tag/tag-chip"
import type { FilterBarValue, FilterTypeOption } from "./types"

export interface FilterCardSectionsProps {
  value: FilterBarValue
  onChange: (next: FilterBarValue) => void
  availableTags?: readonly string[]
  availableTypes?: readonly FilterTypeOption[]
  /** Modul-eigene Abschnitte, unter Typ und Tags. */
  extra?: ReactNode
  /** Setzt das ✕ neben die erste Sektion; ohne Handler gibt es keins. */
  onClose?: () => void
}

/** Sektionslabel: 11px, fett, gesperrt, Grossbuchstaben (Board 2g). */
function Sektion({
  label,
  onClose,
  children,
}: {
  label: string
  onClose?: () => void
  children: ReactNode
}) {
  return (
    <div className="px-4 pt-3 first:pt-3 [&+&]:pt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Filter schließen"
            className="-mr-1 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

/**
 * Ein Typ ist gewaehlt, wenn er in `types` steht — ODER wenn dort gar nichts
 * steht.
 *
 * Der leere Wert heisst „kein Filter", gezeigt wird also alles; die Karte
 * malt das ehrlich als „alle aktiv" (Board 2g). Der Vertrag von
 * `FilterBarValue` bleibt davon unberuehrt: leer ist und bleibt leer.
 */
export function isTypeSelected(value: FilterBarValue, id: string): boolean {
  return value.types.length === 0 || value.types.includes(id)
}

/**
 * Der neue `types`-Wert, wenn jemand einen Typ anfasst.
 *
 * Aus „alles aktiv" (leer) wird beim Abwaehlen der REST — das ist der
 * sichtbare Sinn: Ein Typ wird ausgeblendet. Das Abwaehlen des letzten
 * uebrigen fuehrt zurueck auf leer, also wieder auf alles: Eine Auswahl, die
 * nichts zeigt, waere eine Sackgasse.
 *
 * Und wer wieder alle anwaehlt, landet ebenfalls bei leer: Ein Wert, der alle
 * angebotenen Typen aufzaehlt, SIEHT aus wie „kein Filter", zaehlte aber als
 * aktiver (Chip im Kopf) — und blendete stillschweigend Typen aus, die dieses
 * Modul gar nicht anbietet, ein anderes aber schon.
 */
export function toggleTypeSelection(
  value: FilterBarValue,
  id: string,
  alle: readonly FilterTypeOption[],
): string[] {
  const naechste =
    value.types.length === 0
      ? alle.map((t) => t.id).filter((t) => t !== id)
      : value.types.includes(id)
        ? value.types.filter((t) => t !== id)
        : [...value.types, id]
  const angeboten = new Set(alle.map((t) => t.id))
  const alleGewaehlt =
    angeboten.size > 0 && naechste.length >= angeboten.size && [...angeboten].every((t) => naechste.includes(t))
  return alleGewaehlt ? [] : naechste
}

/**
 * Der Inhalt der Filter-Karte: Sektion „Typ", Sektion „Tags", danach die
 * Extras des Moduls.
 *
 * Als eigene Komponente, weil zwei Flaechen sie zeigen: die Pille im
 * gemorphten Zustand (Modulflaeche) und die alte `FilterBar` in ihrem
 * Popover (Stories, eingebettete Ansichten). Zwei Fassungen desselben
 * Inhalts wuerden auseinanderlaufen.
 */
export function FilterCardSections({
  value,
  onChange,
  availableTags,
  availableTypes,
  extra,
  onClose,
}: FilterCardSectionsProps) {
  const typen = availableTypes ?? []
  const tags = [...new Set(availableTags ?? [])].sort()

  return (
    <>
      {typen.length > 0 && (
        <Sektion label="Typ" onClose={onClose}>
          {typen.map((typ) => {
            const aktiv = isTypeSelected(value, typ.id)
            const Icon = typ.icon
            // Dieselbe Farbe wie das Typ-Abzeichen auf der Karte — sie kommt
            // vom Aufrufer, der das Typ-Register ohnehin liest.
            const farbe = typ.badgeClassName
            return (
              <button
                key={typ.id}
                type="button"
                aria-pressed={aktiv}
                onClick={() => onChange({ ...value, types: toggleTypeSelection(value, typ.id, typen) })}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  aktiv
                    ? farbe ?? "border-transparent bg-muted text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {Icon && <Icon className="h-3 w-3" />}
                {typ.label}
              </button>
            )
          })}
        </Sektion>
      )}

      <Sektion label="Tags" onClose={typen.length === 0 ? onClose : undefined}>
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">Keine Tags verfügbar</p>
        ) : (
          tags.map((tag) => {
            const aktiv = value.tags.includes(tag)
            return (
              <TagChip
                key={tag}
                tag={tag}
                size="md"
                selected={aktiv}
                onToggle={() =>
                  onChange({
                    ...value,
                    tags: aktiv ? value.tags.filter((t) => t !== tag) : [...value.tags, tag],
                  })
                }
              />
            )
          })
        )}
      </Sektion>

      {extra && <div className="flex flex-col gap-4 px-4 pt-4">{extra}</div>}
      {/* Abschluss statt `pb-4` an der letzten Sektion: Welche das ist,
          entscheidet der Aufrufer mit seinen Extras. */}
      <div className="pb-4" />
    </>
  )
}
