// Die Menschen-Zeile (C1, Lesen) — rein, ohne React.
//
// Spec: docs/spec/modules/shared-components.md → „Item-Detail aus dem
// Register", Detail-Anatomie, Regel 5 und Zustand „Viele";
// docs/spec/08-relation-records.md → „Qualifier an Kanten", Regeln 6, 9, 10,
// und „Teilnahme am Event".
//
// Eine Zeile je Personen-Kante der Meta-Box (`widget: "people"`, `pos:
// "meta"`). Eine Kante mit `joins` teilt die Zeile der genannten Kante: So
// führt das Event Eingeladene (`invited`, eingebettet) und Zusagen
// (`attends`, Record) zusammen. Je Person steht ein Chip; eine geltende
// Record-Aussage schlägt die eingebettete Kante (08, Teilnahme am Event,
// Regel 5).

import { onePerSubjectWinners, type Item, type RelationRecord } from "@real-life-stack/data-interface"
import type { EdgeEntry, FieldOption } from "./field-register"

const PERSON_PREFIX = "global:"

/** Der Qualifier, der eine Person nie in der Zeile zeigt, nur in „Alle" (Regel 5). */
export const HIDDEN_QUALIFIER = "declined"

/** Ab mehr als so vielen sichtbaren Personen fasst die Zeile zusammen (Zustand „Viele"). */
export const PEOPLE_SUMMARY_THRESHOLD = 6

export interface PeopleLineEntry {
  userId: string
  /** Die Kante, aus der der Chip stammt. */
  edge: EdgeEntry
  /** Der Qualifier am Chip: deklarierter Wert, oder die Kante selbst, wenn die Zeile mehrere Kanten führt. */
  qualifier?: { id: string; label: string }
  /** Sprecher einer Aussage über diese Person — nur, wenn er nicht sie selbst ist (08, Regel 9). */
  speakerId?: string
  /** `declined`: nicht in der Zeile, nur in „Alle". */
  hidden: boolean
}

/** Die Kanten, die in die Menschen-Zeile fließen, in Register-Reihenfolge. */
export function peopleLineEdges(edges: readonly EdgeEntry[] | undefined): EdgeEntry[] {
  return (edges ?? []).filter((edge) => edge.widget === "people" && edge.pos === "meta")
}

/**
 * Die Menschen-Zeilen eines Typs: je Personen-Kante eine, Kanten mit `joins`
 * in der Zeile ihrer Zielkante. In Register-Reihenfolge der ersten Kante.
 */
export function peopleLineGroups(edges: readonly EdgeEntry[] | undefined): EdgeEntry[][] {
  const all = peopleLineEdges(edges)
  const groups: EdgeEntry[][] = []
  for (const edge of all) {
    if (edge.joins && all.some((e) => e.predicate === edge.joins && !e.joins)) continue
    groups.push([edge, ...all.filter((e) => e.joins === edge.predicate && !edge.joins)])
  }
  return groups
}

/** Record-Kanten der Zeile: Aussagen, die über eine Abfrage kommen. */
export function recordPeopleEdges(edges: readonly EdgeEntry[] | undefined): EdgeEntry[] {
  return peopleLineEdges(edges).filter((edge) => edge.storage === "record" && edge.itemRole === "to")
}

function personId(target: string): string | undefined {
  return target.startsWith(PERSON_PREFIX) && target.length > PERSON_PREFIX.length
    ? target.slice(PERSON_PREFIX.length)
    : undefined
}

function declared(edge: EdgeEntry, value: unknown): FieldOption | undefined {
  if (typeof value !== "string") return undefined
  return edge.qualifier?.values.find((option) => option.id === value)
}

/**
 * Der Anzeigetext eines Qualifier-Werts an einer Kante: nur ein deklarierter
 * Wert hat einen; ein fehlender (default) und ein unbekannter zeigen keinen
 * (Spec 06, Regel 7).
 */
export function qualifierLabel(edge: Pick<EdgeEntry, "qualifier"> | undefined, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  return edge?.qualifier?.values.find((option) => option.id === value)?.label
}

/** Ein Wort ohne Qualifier: die Beschriftung der Kante, klein wie ein Qualifier („eingeladen"). */
function edgeWord(edge: EdgeEntry): string {
  return edge.label.charAt(0).toLocaleLowerCase("de") + edge.label.slice(1)
}

/**
 * Die Chips der Menschen-Zeile, in ihrer Reihenfolge, mit den verborgenen
 * (`hidden`) für „Alle".
 *
 * `records` sind die GELTENDEN Records zum Item (Leseregel L1: nur nach
 * positivem Verdikt) — die Auswahl je Person trifft `one-per-subject` (08).
 * Nur Personen-Targets (`global:`) werden gezeigt.
 */
export function peopleLine(item: Item, edges: readonly EdgeEntry[], records: readonly RelationRecord[]): PeopleLineEntry[] {
  const multi = edges.length > 1
  const byUser = new Map<string, PeopleLineEntry & { rank: number; order: number }>()
  let order = 0
  // Rang: Record-Kanten zuerst (sie tragen die stärkere Aussage), je Wert in
  // Register-Reihenfolge; danach die eingebetteten Kanten.
  const rankOf = (edgeIndex: number, edge: EdgeEntry, valueId?: string) => {
    // Ohne Wert hinter allen Werten der Kante.
    const values = edge.qualifier?.values ?? []
    const found = valueId ? values.findIndex((v) => v.id === valueId) : -1
    const valueIndex = found >= 0 ? found : values.length
    return (edge.storage === "record" ? 0 : 1000) + edgeIndex * 100 + valueIndex
  }

  edges.forEach((edge, edgeIndex) => {
    if (edge.storage === "record") {
      if (edge.itemRole !== "to") return
      const own = records.filter((record) => record.predicate === edge.predicate && record.to === `item:${item.id}`)
      // Zählregel `one-per-subject` (08, Regel 10). `collect-accepted` lehnt
      // das Register für Personen-Kanten ab, bis es die Annahmeprüfung gibt.
      if (edge.count === "collect-accepted") return
      for (const [from, record] of onePerSubjectWinners(own, `item:${item.id}`)) {
        const userId = personId(from)
        if (!userId) continue
        const option = edge.qualifier ? declared(edge, record.fields?.[edge.qualifier.key]) : undefined
        const entry = {
          userId,
          edge,
          qualifier: option ? { id: option.id, label: option.label } : undefined,
          speakerId: record.createdBy !== userId ? record.createdBy : undefined,
          hidden: option?.id === HIDDEN_QUALIFIER,
          rank: rankOf(edgeIndex, edge, option?.id),
          order: order++,
        }
        // Eine geltende Aussage schlägt jede eingebettete Kante zur selben Person.
        const existing = byUser.get(userId)
        if (!existing || existing.edge.storage !== "record") byUser.set(userId, entry)
      }
      return
    }
    if (edge.itemRole !== "from") return
    for (const relation of item.relations ?? []) {
      if (relation.predicate !== edge.predicate) continue
      const userId = personId(relation.target)
      if (!userId || byUser.has(userId)) continue
      const option = edge.qualifier ? declared(edge, relation.meta?.[edge.qualifier.key]) : undefined
      const qualifier = option
        ? { id: option.id, label: option.label }
        : multi && !edge.qualifier
          ? { id: edge.predicate, label: edgeWord(edge) }
          : undefined
      byUser.set(userId, {
        userId,
        edge,
        qualifier,
        hidden: option?.id === HIDDEN_QUALIFIER,
        rank: rankOf(edgeIndex, edge, option?.id),
        order: order++,
      })
    }
  })

  return [...byUser.values()]
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(({ rank: _rank, order: _order, ...entry }) => entry)
}

export interface PeopleSummaryGroup {
  /** Qualifier-Wort, leer ohne Qualifier. */
  label: string
  count: number
  /** Die ersten drei, für die Avatare. */
  entries: PeopleLineEntry[]
}

/**
 * Zustand „Viele": je Qualifier drei Avatare und die Zahl („12 zugesagt"), in
 * der Reihenfolge der Zeile. `null` bis zur Schwelle — dann stehen die Chips
 * einzeln. Verborgene zählen nicht mit.
 */
export function summarizePeople(line: readonly PeopleLineEntry[]): PeopleSummaryGroup[] | null {
  const visible = line.filter((entry) => !entry.hidden)
  if (visible.length <= PEOPLE_SUMMARY_THRESHOLD) return null
  const groups = new Map<string, PeopleSummaryGroup>()
  for (const entry of visible) {
    const label = entry.qualifier?.label ?? ""
    const group = groups.get(label) ?? { label, count: 0, entries: [] }
    group.count += 1
    if (group.entries.length < 3) group.entries.push(entry)
    groups.set(label, group)
  }
  return [...groups.values()]
}
