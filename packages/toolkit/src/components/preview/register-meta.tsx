"use client"

import type { ReactNode } from "react"
import type { Item, User } from "@real-life-stack/data-interface"
import { ArrowLeft, ArrowRight, Calendar, Link2, MapPin, Users } from "lucide-react"

import { useMembers } from "../../hooks/use-groups"
import { useOptionalCurrentUser } from "../../hooks/use-auth"
import { useUserNameResolver } from "../../hooks/use-user-names"
import { cn } from "../../lib/utils"
import { useFieldLink } from "../navigation/field-navigation"
import { ItemAssignees } from "./item-assignees"
import { formatEventRange } from "./item-meta-row"
import { metaRowOrder, type EdgeEntry, type FieldEntry, type ListEntry, type MetaRow } from "./field-register"
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
 * Stand S3: Lesen können `people` (eingebettete Kanten und Record-Kanten in
 * EINER Menschen-Zeile, mit Qualifier), `date`, `location`, Item-Kanten
 * (`item-relation`, C3: eingebettet, ausgehend und eingehend) und Felder mit
 * Item-Verweis (`item-ref`, B15) — diese nur, wenn keine Liste des Typs sie
 * abdeckt (`covers`). Die Wert-Widgets (Status, Zahl, Auswahl, Link …)
 * folgen mit S4; bis dahin erzeugen sie keine Zeile.
 */
export interface RegisterMetaProps {
  item: Item
  fields?: readonly FieldEntry[]
  edges?: readonly EdgeEntry[]
  /** Listen des Typs: deren `covers` nimmt Felder aus der Meta-Box (06, Regel 11). */
  lists?: readonly ListEntry[]
  className?: string
}

export function RegisterMeta({ item, fields, edges, lists, className }: RegisterMetaProps) {
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

  const rows = metaRowOrder(fields, edges).filter((row) => {
    if (!hasReader(row)) return false
    if (row.kind === "edge") {
      if (isItemEdge(row.entry)) return (itemEdges.get(row.entry)?.length ?? 0) > 0
      return peopleFor(row.entry).length > 0
    }
    if (row.entry.widget === "item-ref") return !covered.has(row.entry.key) && itemRefId(item, row.entry) !== null
    return hasValue(row, item)
  })
  if (rows.length === 0) return null
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {rows.map((row) =>
        row.kind === "edge" ? (
          isItemEdge(row.entry) ? (
            <ItemEdgeRow key={rowKey(row)} edge={row.entry} targets={itemEdges.get(row.entry) ?? []} />
          ) : (
            <PeopleRow key={rowKey(row)} edge={row.entry} entries={peopleFor(row.entry)} resolveUser={resolveUser} resolveName={resolveName} currentUserId={currentUser?.id} />
          )
        ) : (
          <MetaRowView key={rowKey(row)} row={row} item={item} />
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
  return row.entry.widget === "date" || row.entry.widget === "location" || row.entry.widget === "item-ref"
}

const data = (item: Item) => (item.data ?? {}) as Record<string, unknown>

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined
}

/** Der Ort als Text: der Name eines Ortes schlägt seine Adresse (wie ItemMetaRow). */
function placeText(item: Item, field: FieldEntry): string | undefined {
  const d = data(item)
  return text(d.locationName) ?? text(d.address) ?? text(d[field.key])
}

function hasValue(row: MetaRow & { kind: "field" }, item: Item): boolean {
  if (row.entry.widget === "date") return !!text(data(item)[row.entry.key])
  return !!placeText(item, row.entry)
}

function MetaRowView({ row, item }: { row: MetaRow & { kind: "field" }; item: Item }) {
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
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-foreground">{children}</div>
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
