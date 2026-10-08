"use client"

import { useState, type ReactNode } from "react"
import type { Item, User } from "@real-life/data-interface"
import { ArrowLeft, ArrowRight, Calendar, CircleDot, Contact, Globe, Hash, Layers, Link2, List, Mail, MapPin, Phone, Users } from "lucide-react"

import { useMembers } from "../../hooks/use-groups"
import { useOptionalCurrentUser } from "../../hooks/use-auth"
import { useUserNameResolver } from "../../hooks/use-user-names"
import { cn } from "../../lib/utils"
import { useFieldLink } from "../navigation/field-navigation"
import { ItemAssignees } from "./item-assignees"
import { formatEventRange } from "./item-meta-row"
import { groupNumberFields, metaRowOrder, type EdgeEntry, type FieldEntry, type ListEntry, type MetaRow } from "./field-register"
import { chipValues, contactHref, contactKind, formatNumber, optionTone, parseNumberInput, safeHref, urlLabel } from "../../lib/field-values"
import { ToneDot, toneSoftClass } from "./value-tone"
import { useFittingTags } from "./use-fitting-tags"
import { ItemRefValue, ItemRelationChips, LabeledChips, itemRefId } from "./item-relation-row"
import { isItemEdge, useItemEdges, type EdgeTarget } from "./use-item-edges"
import type { PeopleLineEntry } from "./people-line"
import { PeopleLineRow } from "./people-line-row"
import { usePeopleLines } from "./use-people-line"

/**
 * `RegisterMeta` — die Meta-Box eines Items aus seiner Feld- und Kantenliste.
 *
 * Spec: `docs/spec/modules/shared-components.md` → „Item-Detail aus dem
 * Register", Detail-Anatomie, Regeln 2–4.
 *
 * Eine Zeile je Feld oder Kante, jede mit Icon, in der Reihenfolge Menschen →
 * Zeit → Ort → Item-Kanten → Werte. Ein leeres Feld erzeugt keine Zeile; ohne
 * eine einzige Zeile rendert die Komponente `null`, damit die Box entfällt.
 * Verzweigt wird über das Widget des Eintrags, nie über den Typ des Items.
 *
 * Stand S4a: Lesen können `people` (eingebettete Kanten und Record-Kanten in
 * EINER Menschen-Zeile, mit Qualifier), `date`, `location`, Item-Kanten
 * (`item-relation`, C3: eingebettet, ausgehend und eingehend), Felder mit
 * Item-Verweis (`item-ref`, B15) — diese nur, wenn keine Liste des Typs sie
 * abdeckt (`covers`) — und die einfachen Wert-Widgets: `status` (B6) und
 * `select` (B8) als Chip in der Farbe des Space, `number` (B7) als Text mit Einheit, `url` (B9) als
 * sicherer Link, `chips` (B10) als Chip-Reihe, `contact` (B12) mit Sprung.
 */
export interface RegisterMetaProps {
  item: Item
  fields?: readonly FieldEntry[]
  edges?: readonly EdgeEntry[]
  /** Listen des Typs: deren `covers` nimmt Felder aus der Meta-Box (06, Regel 11). */
  lists?: readonly ListEntry[]
  /** Klassen der Typfarbe (Typ-Badge): Ton einer Option ohne Rolle und ohne `tone`. */
  typeTone?: string
  className?: string
}

export function RegisterMeta({ item, fields, edges, lists, typeTone, className }: RegisterMetaProps) {
  // Personen werden hier aufgelöst, nicht erst in der Zeile: Ob eine Zeile
  // entsteht, muss feststehen, bevor die Box sich zeichnet — sonst bliebe bei
  // lauter unbekannten Personen ein leerer grauer Kasten stehen. Über die
  // Vereinigung aller bekannten Mitglieder (`null`), damit eine Person auch
  // außerhalb des aktuellen Space erscheint; dazu die angemeldete Person, die
  // im eigenen Space nicht unter den Mitgliedern steht.
  const { data: members } = useMembers(null)
  const { data: currentUser } = useOptionalCurrentUser()
  const resolveName = useUserNameResolver()
  const resolveUser = (id: string): User | undefined =>
    members.find((m) => m.id === id) ?? (currentUser?.id === id ? currentUser : undefined)
  const lines = usePeopleLines(item, edges)
  const peopleFor = (edge: EdgeEntry) =>
    (lines.find((line) => line.edges[0] === edge)?.entries ?? []).filter((entry) => resolveUser(entry.userId))

  // Eine Zeile je Menschen-Zeile: Kanten, die per `joins` eine andere teilen,
  // stehen an deren Stelle (shared-components, Detail-Anatomie, Regel 5).
  const itemEdges = useItemEdges(item, edges)
  const covered = new Set((lists ?? []).flatMap((list) => list.covers ?? []))

  // Zahlenfelder mit gleicher Beschriftung stehen in EINER Zeile (B7).
  const rows = groupNumberFields(
    metaRowOrder(fields, edges).map((row) => ({ widget: row.entry.widget, label: row.entry.label, row })),
  )
    .map((group): MetaRow | NumberRow =>
      group.length > 1 ? { kind: "numbers", entries: group.map((g) => g.row.entry as FieldEntry) } : group[0]!.row,
    )
    .filter((row) => {
      if (row.kind === "numbers") return row.entries.some((entry) => hasFieldValue(entry, item))
      if (!hasReader(row)) return false
      if (row.kind === "edge") {
        if (isItemEdge(row.entry)) return (itemEdges.get(row.entry)?.length ?? 0) > 0
        return peopleFor(row.entry).length > 0
      }
      if (row.entry.widget === "item-ref") return !covered.has(row.entry.key) && itemRefId(item, row.entry) !== null
      return hasFieldValue(row.entry, item)
    })
  if (rows.length === 0) return null
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {rows.map((row) =>
        row.kind === "numbers" ? (
          <NumberRowView key={`n:${row.entries[0]!.key}`} entries={row.entries} item={item} />
        ) : row.kind === "edge" ? (
          isItemEdge(row.entry) ? (
            <ItemEdgeRow key={rowKey(row)} edge={row.entry} targets={itemEdges.get(row.entry) ?? []} />
          ) : (
            <PeopleRow key={rowKey(row)} edge={row.entry} entries={peopleFor(row.entry)} resolveUser={resolveUser} resolveName={resolveName} currentUserId={currentUser?.id} />
          )
        ) : (
          <MetaRowView key={rowKey(row)} row={row} item={item} typeTone={typeTone} />
        ),
      )}
    </div>
  )
}

/**
 * Item-Kante (C3, Lesen): Label aus dem Register, Chips in Typfarbe, „+N".
 * Das Icon sagt die Richtung (ausgehend, eingehend), nicht den Typ.
 */
function ItemEdgeRow({ edge, targets }: { edge: EdgeEntry; targets: readonly EdgeTarget[] }) {
  const Icon = edge.itemRole === "to" ? ArrowLeft : ArrowRight
  return (
    <Row id={`${edge.predicate}:${edge.itemRole}`} icon={<Icon className="h-3.5 w-3.5" />}>
      <LabeledChips label={edge.label}>
        <ItemRelationChips targets={targets} />
      </LabeledChips>
    </Row>
  )
}

type ResolveUser = (id: string) => User | undefined

/**
 * Die Personen-Kanten eines Items als ein Avatar-Stapel — für Karten, die
 * „Avatar-Stack" aus dem Register zeigen (shared-components, Item-Detail aus
 * dem Register, Regel 9). Dieselbe Menschen-Zeile wie im Detail, ohne die
 * Verborgenen (`declined`). `null`, wenn niemand aufzulösen ist.
 */
export function RegisterPeopleStack({ item, edges }: { item: Item; edges?: readonly EdgeEntry[] }) {
  const { data: members } = useMembers(null)
  const { data: currentUser } = useOptionalCurrentUser()
  const resolveUser: ResolveUser = (id) =>
    members.find((m) => m.id === id) ?? (currentUser?.id === id ? currentUser : undefined)
  const lines = usePeopleLines(item, edges)
  const seen = new Set<string>()
  const users = lines
    .flatMap((line) => line.entries)
    .filter((entry) => !entry.hidden && !seen.has(entry.userId) && !!seen.add(entry.userId))
    .map((entry) => resolveUser(entry.userId))
    .filter((user): user is User => !!user)
  return users.length > 0 ? <ItemAssignees users={users} /> : null
}

function rowKey(row: MetaRow): string {
  return row.kind === "field" ? `f:${row.entry.key}` : `e:${row.entry.predicate}:${row.entry.itemRole}`
}

/** Welche Einträge die Meta-Box lesen kann. */
function hasReader(row: MetaRow): boolean {
  if (row.kind === "edge") {
    // Personen-Kanten: eingebettete, die das Item trägt, und Record-Kanten,
    // die auf das Item zeigen (attends). Item-Kanten (C3): eingebettet, in
    // beide Richtungen.
    const edge = row.entry
    if (isItemEdge(edge)) return true
    return edge.widget === "people" && ((edge.storage === "embedded" && edge.itemRole === "from") || (edge.storage === "record" && edge.itemRole === "to"))
  }
  return FIELD_READERS.has(row.entry.widget)
}

const FIELD_READERS: ReadonlySet<string> = new Set(["date", "location", "item-ref", "status", "select", "number", "url", "chips", "contact"])

/** Mehrere Zahlenfelder mit gleicher Beschriftung in einer Zeile (B7). */
type NumberRow = { kind: "numbers"; entries: FieldEntry[] }

const data = (item: Item) => (item.data ?? {}) as Record<string, unknown>

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined
}

/** Der Ort als Text: der Name eines Ortes schlägt seine Adresse (wie ItemMetaRow). */
function placeText(item: Item, field: FieldEntry): string | undefined {
  const d = data(item)
  return text(d.locationName) ?? text(d.address) ?? text(d[field.key])
}

/** Ein Wert, der eine Zeile trägt (Detail-Anatomie, Regel 2: leer erzeugt keine). */
function hasFieldValue(field: FieldEntry, item: Item): boolean {
  const value = data(item)[field.key]
  switch (field.widget) {
    case "location":
      return !!placeText(item, field)
    case "number":
      return numberOf(value) !== undefined
    case "chips":
      return chipValues(value).length > 0
    default:
      return !!text(value)
  }
}

/** Eine gespeicherte Zahl, oder undefined (auch für Unlesbares). */
function numberOf(value: unknown): number | undefined {
  const n = parseNumberInput(value)
  return n === undefined || Number.isNaN(n) ? undefined : n
}

function MetaRowView({ row, item, typeTone }: { row: MetaRow & { kind: "field" }; item: Item; typeTone?: string }) {
  const field = row.entry
  const value = data(item)[field.key]
  switch (field.widget) {
    case "status":
    case "select":
      return (
        <Row id={field.key} icon={field.widget === "status" ? <CircleDot className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />} label={field.label ?? (field.widget === "status" ? "Status" : undefined)}>
          <OptionChip field={field} value={value as string} typeTone={typeTone} />
        </Row>
      )
    case "number":
      return <NumberRowView entries={[field]} item={item} />
    case "url":
      return <UrlRow field={field} value={value as string} />
    case "chips":
      return (
        <Row id={field.key} icon={<List className="h-3.5 w-3.5" />}>
          <LabeledChips label={field.label}>
            <ValueChips values={chipValues(value)} />
          </LabeledChips>
        </Row>
      )
    case "contact":
      return <ContactRow field={field} value={value as string} />
  }
  if (row.entry.widget === "date") return <DateRow item={item} field={row.entry} />
  if (row.entry.widget === "item-ref") {
    return (
      <Row id={row.entry.key} icon={<Link2 className="h-3.5 w-3.5" />}>
        <LabeledChips label={row.entry.label}>
          <ItemRefValue item={item} field={row.entry} />
        </LabeledChips>
      </Row>
    )
  }
  return <LocationRow item={item} field={row.entry} />
}

function Row({ id, icon, label, children }: { id: string; icon: ReactNode; label?: string; children: ReactNode }) {
  return (
    <div data-meta-row={id} className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      {label && <span className="sr-only">{label}</span>}
      {/* flex-1: Die Zeile nimmt die ganze Breite, sonst misst eine gekappte
          Chip-Reihe (C3, B10) nur ihren eigenen gekappten Inhalt. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-foreground">{children}</div>
    </div>
  )
}

/** Menschen (C1, Lesen): eine Zeile, Chips mit Qualifier, „Alle". */
function PeopleRow({
  edge,
  entries,
  resolveUser,
  resolveName,
  currentUserId,
}: {
  edge: EdgeEntry
  entries: readonly PeopleLineEntry[]
  resolveUser: ResolveUser
  resolveName: (id: string) => string
  currentUserId?: string
}) {
  return (
    <Row id={edge.predicate} icon={<Users className="h-3.5 w-3.5" />} label="Menschen">
      <PeopleLineRow entries={entries} resolveUser={resolveUser} resolveName={resolveName} currentUserId={currentUserId} />
    </Row>
  )
}

/** Zeit (B3, Lesen): Text mit Sprung in die Sicht, die das Feld darstellt. */
function DateRow({ item, field }: { item: Item; field: FieldEntry }) {
  const d = data(item)
  const start = text(d[field.key])
  // Der Datenvertrag des Datums-Widgets ist start/end/rrule: Das Ende gehört
  // zum Feld `start`.
  const end = field.key === "start" ? text(d.end) : undefined
  const zumDatum = useFieldLink(field.key, item)
  if (!start) return null
  return (
    <Row id={field.key} icon={<Calendar className="h-3.5 w-3.5" />} label={field.label}>
      <Sprung onClick={zumDatum}>{formatEventRange(start, end)}</Sprung>
    </Row>
  )
}

/** Ort (B4, Lesen): Adresse als Text mit Sprung auf die Karte, wenn es Koordinaten gibt. */
function LocationRow({ item, field }: { item: Item; field: FieldEntry }) {
  const ortsziel = useFieldLink("position", item)
  const place = placeText(item, field)
  // Die Karte braucht Koordinaten; ein nur benannter Ort bleibt Text.
  const zumOrt = data(item).position ? ortsziel : null
  if (!place) return null
  return (
    <Row id={field.key} icon={<MapPin className="h-3.5 w-3.5" />} label={field.label}>
      <Sprung onClick={zumOrt}>{place}</Sprung>
    </Row>
  )
}

// ---------------------------------------------------------------------------
// Wert-Widgets (S4a; shared-components → Widget-Paare B6–B10, B12)

const CHIP = "inline-flex max-w-full items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium"

function ValueChip({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span data-value-chip className={cn(CHIP, className)}>
      <span className="truncate">{children}</span>
    </span>
  )
}

function optionLabel(field: FieldEntry, value: string): string {
  // Ein Wert, den das Register nicht kennt, erscheint als er selbst, nie verworfen.
  return field.options?.find((o) => o.id === value)?.label ?? value
}

/**
 * Chip eines status- oder select-Werts (B6, B8; Design 27.09.): Punkt,
 * Pastellgrund, Schrift und Rand im Ton — wie die gewählte Pille. Ton der
 * Option, sonst der Rolle, sonst die Typfarbe; ein unbekannter Wert neutral.
 */
function OptionChip({ field, value, typeTone }: { field: FieldEntry; value: string; typeTone?: string }) {
  const tone = optionTone(field.widget, field.options?.find((o) => o.id === value))
  return (
    <span
      data-value-chip
      data-tone={tone}
      className={cn("inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold", toneSoftClass(tone, typeTone))}
    >
      <ToneDot tone={tone} typeTone={typeTone} />
      <span className="truncate">{optionLabel(field, value)}</span>
    </span>
  )
}

/** Zahlen mit Einheit, mehrere mit „ · " („Aufwand 12 h · 300 €", B7). */
function NumberRowView({ entries, item }: { entries: readonly FieldEntry[]; item: Item }) {
  const parts = entries.flatMap((field) => {
    const n = numberOf(data(item)[field.key])
    return n === undefined ? [] : [formatNumber(n, field.unit)]
  })
  if (parts.length === 0) return null
  const label = entries[0]!.label
  return (
    <Row id={entries[0]!.key} icon={<Hash className="h-3.5 w-3.5" />}>
      {label && <span className="shrink-0 text-xs text-muted-foreground">{label}</span>}
      <span className="tabular-nums">{parts.join(" · ")}</span>
    </Row>
  )
}

/** Link mit Globus (B9): nur http/https, neuer Tab ohne Opener; sonst Text. */
function UrlRow({ field, value }: { field: FieldEntry; value: string }) {
  const href = safeHref(value)
  return (
    <Row id={field.key} icon={<Globe className="h-3.5 w-3.5" />} label={field.label}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="min-w-0 truncate text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {urlLabel(href)}
        </a>
      ) : (
        <span className="min-w-0 break-all">{value}</span>
      )}
    </Row>
  )
}

/** Telefon oder E-Mail mit Sprung (B12); Unerkanntes bleibt Text. */
function ContactRow({ field, value }: { field: FieldEntry; value: string }) {
  const kind = contactKind(value)
  const href = contactHref(value)
  const Icon = kind === "email" ? Mail : kind === "phone" ? Phone : Contact
  return (
    <Row id={field.key} icon={<Icon className="h-3.5 w-3.5" />} label={field.label}>
      <span className="min-w-0 break-all">{value.trim()}</span>
      {href && (
        <a
          href={href}
          onClick={(event) => event.stopPropagation()}
          className="shrink-0 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {kind === "email" ? "E-Mail schreiben" : "Anrufen"}
        </a>
      )}
    </Row>
  )
}

/** Chip-Reihe (B10), gekappt nach Platz wie die Tags, „+N" zeigt alle. */
function ValueChips({ values }: { values: readonly string[] }) {
  const [all, setAll] = useState(false)
  // Ohne Messung (Server, jsdom) drei, dann „+N".
  const { visible, measuring, rowRef, measureRef } = useFittingTags(values, 3, 0)
  const shown = all ? values.length : Math.min(Math.max(visible, 1), values.length)
  const hidden = values.length - shown
  const chip = (v: string) => <ValueChip className="border-border bg-background text-foreground">{v}</ValueChip>
  return (
    <div ref={rowRef} className={cn("relative flex min-w-0 flex-1 items-center gap-1.5", all ? "flex-wrap" : "flex-nowrap")}>
      {values.slice(0, shown).map((v) => (
        <span key={v} className="min-w-0">
          {chip(v)}
        </span>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          data-more={hidden}
          aria-label={`${hidden} weitere zeigen`}
          onClick={(event) => {
            event.stopPropagation()
            setAll(true)
          }}
          className="shrink-0 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          +{hidden}
        </button>
      )}
      {measuring && !all && (
        <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex gap-1.5 whitespace-nowrap">
          {values.map((v) => (
            <span key={v} data-measure="tag-chip">
              <span className={cn(CHIP, "border-border")}>{v}</span>
            </span>
          ))}
          <span data-measure="tag-plus" className="rounded-full border px-2 py-0.5 text-xs">+{values.length}</span>
        </div>
      )}
    </div>
  )
}

/** Ein Wert, der irgendwohin führt — sonst schlichter Text (01, Ein Feld führt zu seiner Sicht). */
function Sprung({ onClick, children }: { onClick: (() => void) | null; children: ReactNode }) {
  if (!onClick) return <span>{children}</span>
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className="rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {children}
    </button>
  )
}
