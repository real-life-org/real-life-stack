"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PersonOption {
  id: string
  name: string
}

interface PeopleWidgetProps {
  value: string[]
  onChange: (value: string[]) => void
  label: string
  /** Structured options: widget stores IDs, displays names */
  options?: PersonOption[]
  /** Simple string suggestions (legacy). Ignored when `options` is provided. */
  suggestions?: string[] | ((query: string) => Promise<string[]>)
  /** Quick-select suggestions shown as clickable chips below the input */
  quickSuggestions?: PersonOption[]
  /**
   * Qualifier der Kante (08, Qualifier an Kanten; shared-components,
   * Edit-Regeln 6): Der Chip zeigt ihn klein hinter dem Namen, Antippen
   * wechselt zum nächsten Wert. Eine neue Person bekommt den ersten Wert.
   */
  qualifier?: { key: string; values: readonly { id: string; label: string }[] }
  /** Qualifier je Person-Id. */
  qualifiers?: Record<string, string>
  onQualifiersChange?: (next: Record<string, string>) => void
  /** Beschriftung des leeren Eingabefelds („Einladen…", „Zuweisen…"). */
  placeholder?: string
  /**
   * Zustände aus einer Record-Kante derselben Zeile (Event: `invited` +
   * `attends`, 08 → Teilnahme am Event). Der Chip zeigt „Name · Zustand";
   * Antippen wechselt im Kreis Grundzustand → Werte. `live` ist der
   * geltende Zustand aus den Records (fest, wenn es die eigene Aussage einer
   * anderen Person ist), `changes` die Änderungen dieses Formulars.
   */
  record?: PeopleWidgetRecord
}

export interface PeopleWidgetRecord {
  base: { id: string; label: string }
  values: readonly { id: string; label: string }[]
  live: Record<string, { state: string; locked?: boolean; mine?: boolean; fallback?: string }>
  changes: Record<string, string | null>
  onChangesChange: (next: Record<string, string | null>) => void
}

export function PeopleWidget({
  value,
  onChange,
  label,
  options,
  suggestions,
  quickSuggestions,
  qualifier,
  qualifiers,
  onQualifiersChange,
  placeholder,
  record,
}: PeopleWidgetProps) {
  const [query, setQuery] = React.useState("")
  const [filtered, setFiltered] = React.useState<PersonOption[]>([])
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  // Build a lookup map from options for resolving display names
  const optionMap = React.useMemo(() => {
    if (!options) return null
    const map = new Map<string, string>()
    for (const o of options) map.set(o.id, o.name)
    return map
  }, [options])

  const resolveLabel = React.useCallback(
    (id: string) => optionMap?.get(id) ?? id,
    [optionMap],
  )

  React.useEffect(() => {
    const q = query.trim().toLowerCase()

    if (options) {
      // Show all non-selected options when query is empty, filter by name otherwise
      setFiltered(
        options.filter(
          (o) =>
            (!q || o.name.toLowerCase().includes(q)) &&
            !value.includes(o.id),
        ),
      )
    } else if (!q) {
      // Legacy string suggestions: no query means no suggestions
      setFiltered([])
    } else if (Array.isArray(suggestions)) {
      setFiltered(
        suggestions
          .filter(
            (s) =>
              s.toLowerCase().includes(q) &&
              !value.includes(s),
          )
          .map((s) => ({ id: s, name: s })),
      )
    } else if (typeof suggestions === "function") {
      let cancelled = false
      suggestions(query).then((results) => {
        if (!cancelled) {
          setFiltered(
            results
              .filter((s) => !value.includes(s))
              .map((s) => ({ id: s, name: s })),
          )
        }
      })
      return () => {
        cancelled = true
      }
    }
  }, [query, options, suggestions, value])

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const addPerson = (id: string) => {
    const trimmed = id.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
      const first = qualifier?.values[0]
      if (first && onQualifiersChange) onQualifiersChange({ ...(qualifiers ?? {}), [trimmed]: first.id })
    }
    setQuery("")
    setShowSuggestions(false)
  }

  const removePerson = (id: string) => {
    onChange(value.filter((p) => p !== id))
    // Eine eigene Aussage über die Person geht mit (keine Aussage mehr).
    if (record && (record.live[id]?.mine || (record.changes[id] ?? null) !== null)) {
      record.onChangesChange({ ...record.changes, [id]: null })
    }
    if (qualifier && onQualifiersChange && qualifiers && id in qualifiers) {
      const { [id]: _removed, ...rest } = qualifiers
      onQualifiersChange(rest)
    }
  }

  // Zustände: Grundzustand, dann die Werte der Record-Kante.
  const states = record ? [record.base, ...record.values] : []
  // Angezeigt wird, was nach dem Speichern gälte (Codex Runde 2, Befund 3):
  // eine fremde Selbstaussage gewinnt immer; nehme ich meine Aussage zurück,
  // gilt die verbleibende fremde oder der Grundzustand.
  const stateOf = (id: string) => {
    if (!record) return undefined
    const live = record.live[id]
    const changed = record.changes[id]
    let stateId: string
    if (live?.locked) stateId = live.state
    else if (changed === undefined) stateId = live?.state ?? record.base.id
    else if (changed === null || changed === record.base.id) stateId = live?.fallback ?? record.base.id
    else stateId = changed
    return states.find((s) => s.id === stateId) ?? record.base
  }
  // Der Zyklus folgt der lokalen Auswahl, nicht der Anzeige (Codex Runde 3):
  // eine verbleibende fremde Aussage darf den Kreis nicht festhalten.
  const cycleState = (id: string) => {
    if (!record || record.live[id]?.locked) return
    const changed = record.changes[id]
    const selected = changed === undefined ? (record.live[id]?.state ?? record.base.id) : (changed ?? record.base.id)
    const index = states.findIndex((s) => s.id === selected)
    const next = states[(index + 1) % states.length]
    record.onChangesChange({ ...record.changes, [id]: next.id })
  }

  // Wer eine geltende Aussage hat, steht im Feld, auch ohne Einladung —
  // außer das Formular nimmt die eigene Aussage gerade zurück.
  const shown = record
    ? [...value, ...Object.keys(record.live).filter((id) => !value.includes(id) && (record.changes[id] !== null || !!record.live[id].fallback || !!record.live[id].locked))]
    : value

  const qualifierOf = (id: string) => qualifier?.values.find((v) => v.id === qualifiers?.[id])

  // Im Kreis der erlaubten Werte; ohne Wert zum ersten.
  const cycleQualifier = (id: string) => {
    if (!qualifier || !onQualifiersChange || qualifier.values.length === 0) return
    const index = qualifier.values.findIndex((v) => v.id === qualifiers?.[id])
    const next = qualifier.values[(index + 1) % qualifier.values.length]
    onQualifiersChange({ ...(qualifiers ?? {}), [id]: next.id })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (filtered.length > 0) {
        addPerson(filtered[0].id)
      }
    }
    if (e.key === "Backspace" && !query && value.length > 0) {
      removePerson(value[value.length - 1])
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
        {shown.map((personId) => (
          <span
            key={personId}
            data-person-chip={personId}
            // Wie im Design: neutraler Chip, Zustand gedämpft dahinter.
            className="inline-flex items-center gap-0.5 rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-foreground"
          >
            {resolveLabel(personId)}
            {record && <span aria-hidden className="px-0.5 text-muted-foreground">·</span>}
            {record && (
              <button
                type="button"
                data-qualifier-toggle
                disabled={!!record.live[personId]?.locked}
                onClick={() => cycleState(personId)}
                title={record.live[personId]?.locked ? "Eigene Aussage der Person — nur sie ändert sie" : undefined}
                aria-label={`${resolveLabel(personId)}: ${stateOf(personId)?.label} — ${record.live[personId]?.locked ? "eigene Aussage, fest" : "wechseln"}`}
                className="rounded-sm px-0.5 font-normal text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default disabled:no-underline"
              >
                {stateOf(personId)?.label}
              </button>
            )}
            {qualifier && <span aria-hidden className="px-0.5 text-muted-foreground">·</span>}
            {qualifier && (
              <button
                type="button"
                data-qualifier-toggle
                onClick={() => cycleQualifier(personId)}
                aria-label={`${resolveLabel(personId)}: ${qualifierOf(personId)?.label ?? "ohne Angabe"} — wechseln`}
                className="rounded-sm px-0.5 font-normal text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {qualifierOf(personId)?.label ?? "…"}
              </button>
            )}
            {/* Entfernen, wo es etwas zurückzunehmen gibt: die Einladung oder
                meine eigene Aussage, auch wenn sie gerade überstimmt ist. */}
            {(value.includes(personId) || !record?.live[personId]?.locked || !!record?.live[personId]?.mine) && (
              <button
                type="button"
                aria-label={`${resolveLabel(personId)} entfernen`}
                onClick={() => removePerson(personId)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          // Eine eigene Beschriftung („Einladen…") bleibt stehen, wie im Design.
          placeholder={placeholder ?? (value.length === 0 ? "Hinzufuegen..." : "")}
          className="min-w-[60px] flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute top-full z-10 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {filtered.slice(0, 8).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => addPerson(option.id)}
              className={cn(
                "w-full rounded-sm px-2 py-1.5 text-left text-sm",
                "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
      {record && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Chip antippen wechselt: {states.map((s) => s.label).join(" · ")}
        </p>
      )}
      {quickSuggestions && quickSuggestions.filter((s) => !shown.includes(s.id)).length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {quickSuggestions
            .filter((s) => !shown.includes(s.id))
            .map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => addPerson(person.id)}
                className="inline-flex cursor-pointer items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 opacity-70 transition-opacity hover:opacity-100 dark:bg-sky-900/30 dark:text-sky-300"
              >
                {person.name}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
