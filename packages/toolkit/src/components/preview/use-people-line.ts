"use client"

// Daten der Menschen-Zeile (C1) und der Selbstaktion (C2).
//
// Spec: docs/spec/modules/shared-components.md → „Item-Detail aus dem
// Register" (Detail-Anatomie, Regeln 5 und 7; Modi, Regel 1);
// docs/spec/08-relation-records.md → „Qualifier an Kanten", „Teilnahme am
// Event", Leseregel L1.
//
// Bewusst keine öffentlichen Hooks: Sie bedienen die Flächen des Registers
// und lesen nur über die Capabilities des Connectors.

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react"
import type { DataInterface, Item, RelationRecord } from "@real-life-stack/data-interface"
import {
  hasClaimVerification,
  hasRelationRecords,
  hasRelationRecordWriter,
  isAuthenticatable,
  isWritable,
  selfStatementFields,
} from "@real-life-stack/data-interface"

import { useConnector } from "../../hooks/connector-context"
import { useOptionalCurrentUser } from "../../hooks/use-auth"
import { resolveItemPermissions } from "../../hooks/use-item-permissions"
import { useVerifiedRelationRecords } from "../../hooks/use-votes"
import type { EdgeEntry } from "./field-register"
import { peopleLine, peopleLineGroups, recordPeopleEdges, type PeopleLineEntry } from "./people-line"

const NO_RECORDS: RelationRecord[] = []

/**
 * Die geltenden Records zum Item über die gegebenen Prädikate: beobachtet,
 * dann nach Leseregel L1 gefiltert (nur `valid`/`trusted`, fail closed ab dem
 * ersten Frame). Ohne Prädikate oder ohne `RelationRecordCapable` leer.
 */
export function useItemRecords(item: Item, predicates: readonly string[]): RelationRecord[] {
  const connector = useConnector()
  const canRead = predicates.length > 0 && hasRelationRecords(connector)
  const observable = useMemo(
    () => (canRead ? connector.observeRelationRecords({ to: `item:${item.id}` }) : null),
    [canRead, connector, item.id],
  )
  const [all, setAll] = useState<RelationRecord[]>(observable?.current ?? NO_RECORDS)
  useEffect(() => {
    if (!observable) {
      setAll(NO_RECORDS)
      return
    }
    setAll(observable.current)
    return observable.subscribe((next) => startTransition(() => setAll(next)))
  }, [observable])
  const key = predicates.join(" ")
  const relevant = useMemo(() => {
    const wanted = new Set(key.split(" "))
    const filtered = all.filter((record) => wanted.has(record.predicate))
    return filtered.length > 0 ? filtered : NO_RECORDS
  }, [all, key])
  return useVerifiedRelationRecords(relevant)
}

export interface PeopleLineGroup {
  /** Die Kanten der Zeile; die erste ist die, an deren Stelle die Zeile steht. */
  edges: EdgeEntry[]
  entries: PeopleLineEntry[]
}

/** Die Menschen-Zeilen eines Items aus seinen Personen-Kanten (je Kante eine, `joins` teilt). */
export function usePeopleLines(item: Item, edges: readonly EdgeEntry[] | undefined): PeopleLineGroup[] {
  const groups = useMemo(() => peopleLineGroups(edges), [edges])
  const predicates = useMemo(() => recordPeopleEdges(edges).map((edge) => edge.predicate), [edges])
  const records = useItemRecords(item, predicates)
  return useMemo(
    () => groups.map((group) => ({ edges: group, entries: peopleLine(item, group, records) })),
    [item, groups, records],
  )
}

export interface SelfActionState {
  /** Die Selbstaktion ist hier möglich (Capability, Anmeldung, Schreibrecht). */
  available: boolean
  /**
   * Mein Zustand: bei einer Kante mit Qualifier der Wert meiner eigenen
   * Aussage, sonst `true`, wenn ich an der Kante stehe. `undefined`: neutral.
   */
  mine: string | true | undefined
  /** Setzt meinen Zustand; derselbe Wert noch einmal nimmt die Aussage zurück. */
  act: (value?: string) => Promise<void>
}

/**
 * Selbstaktion an einer Kante (C2). Record-Kanten schreiben den EIGENEN
 * Record über den RelationStore (Absagen schreibt `declined`, der Record
 * bleibt; dieselbe Pill noch einmal löscht ihn — keine Aussage mehr).
 * Eingebettete Kanten schreiben das Trägeritem (jedes Mitglied darf,
 * Entscheidung 14).
 *
 * Nicht verfügbar ohne die nötige Capability — die Pill-Zeile täuscht nichts
 * vor, was der Connector nicht kann (Record: Lesen, Schreiben und
 * Verifikation; sonst zählte die eigene Aussage nie).
 */
export function useSelfAction(item: Item, edge: EdgeEntry): SelfActionState {
  const connector = useConnector()
  const { data: me } = useOptionalCurrentUser()
  const meId = me?.id
  const isRecord = edge.storage === "record"
  const records = useItemRecords(item, isRecord ? [edge.predicate] : [])

  const available = useMemo(() => {
    if (!meId || !isWritable(connector) || !isAuthenticatable(connector)) return false
    if (isRecord) {
      return edge.itemRole === "to" && !!edge.qualifier && hasRelationRecords(connector) && hasRelationRecordWriter(connector) && hasClaimVerification(connector)
    }
    return edge.itemRole === "from" && resolveItemPermissions(connector, item, meId).canEdit
  }, [connector, edge, isRecord, item, meId])

  const persisted: string | true | undefined = useMemo(() => {
    if (!meId) return undefined
    const self = `global:${meId}`
    if (isRecord) {
      const own = records.find((record) => record.createdBy === meId && record.from === self)
      const value = own?.fields?.[edge.qualifier?.key ?? ""]
      return typeof value === "string" ? value : undefined
    }
    const relation = (item.relations ?? []).find((r) => r.predicate === edge.predicate && r.target === self)
    if (!relation) return undefined
    const value = edge.qualifier ? relation.meta?.[edge.qualifier.key] : undefined
    return typeof value === "string" ? value : true
  }, [edge, isRecord, item.relations, meId, records])

  // Optimistische Anzeige bis der Connector den Schreibvorgang zurückmeldet.
  const [pending, setPending] = useState<{ value: string | true | undefined } | null>(null)
  useEffect(() => {
    if (pending && pending.value === persisted) setPending(null)
  }, [pending, persisted])
  const mine = pending ? pending.value : persisted

  const chain = useRef<Promise<void>>(Promise.resolve())
  const act = useCallback(
    (value?: string) => {
      const run = async () => {
        if (!available || !meId) return
        const next = mine === (value ?? true) ? undefined : (value ?? true)
        setPending({ value: next })
        try {
          if (isRecord) await writeOwnRecord(connector, item, edge, meId, value)
          else await writeEmbedded(connector, item, edge, meId, value)
        } catch {
          setPending(null)
        }
      }
      const next = chain.current.then(run)
      chain.current = next.catch(() => undefined)
      return next
    },
    [available, connector, edge, isRecord, item, meId, mine],
  )

  return { available, mine, act }
}

async function writeOwnRecord(connector: DataInterface, item: Item, edge: EdgeEntry, meId: string, value: string | undefined) {
  if (!hasRelationRecords(connector) || !hasRelationRecordWriter(connector) || !edge.qualifier || !value) return
  const key = edge.qualifier.key
  const from = `global:${meId}`
  const to = `item:${item.id}`
  // Die Entscheidung liest frisch, nicht aus dem letzten Render: Doppelklicks
  // laufen gegen den wahren Stand.
  const fresh = await connector.getRelationRecords({ predicate: edge.predicate, from, to })
  const own = fresh.find((record) => record.createdBy === meId)
  const fields = selfStatementFields(edge.predicate, key, value, item)
  if (own) {
    if (own.fields?.[key] === value) {
      await connector.deleteRelationRecord(own.id)
      return
    }
    await connector.updateRelationRecord(own.id, { fields: { ...(own.fields ?? {}), ...fields } })
    return
  }
  const created = await connector.createRelationRecord({ predicate: edge.predicate, from, to, fields })
  // Idempotentes Anlegen gibt einen vorhandenen kanonischen Record unverändert
  // zurück — auch einen mit anderem Wert. Dann den eigenen angleichen.
  if (created.fields?.[key] !== value) {
    await connector.updateRelationRecord(created.id, { fields: { ...(created.fields ?? {}), ...fields } })
  }
}

async function writeEmbedded(connector: DataInterface, item: Item, edge: EdgeEntry, meId: string, value: string | undefined) {
  if (!isWritable(connector)) return
  const current = (await connector.getItem(item.id)) ?? item
  const target = `global:${meId}`
  const relations = current.relations ?? []
  const existing = relations.find((r) => r.predicate === edge.predicate && r.target === target)
  const key = edge.qualifier?.key
  let next
  if (existing && (!key || !value || existing.meta?.[key] === value)) {
    // Dieselbe Pill noch einmal: ich trete von der Kante zurück.
    next = relations.filter((r) => r !== existing)
  } else if (existing && key && value) {
    next = relations.map((r) => (r === existing ? { ...r, meta: { ...(r.meta ?? {}), [key]: value } } : r))
  } else {
    next = [...relations, { predicate: edge.predicate, target, ...(key && value ? { meta: { [key]: value } } : {}) }]
  }
  await connector.updateItem(item.id, { relations: next })
}
