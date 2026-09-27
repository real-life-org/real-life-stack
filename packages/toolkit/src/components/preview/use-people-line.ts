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
import { onePerSubjectWinners } from "@real-life-stack/data-interface"
import {
  hasAuthorization,
  hasClaimVerification,
  hasItemGroups,
  hasRelationRecords,
  hasRelationRecordWriter,
  isAuthenticatable,
  isWritable,
} from "@real-life-stack/data-interface"

import { useConnector } from "../../hooks/connector-context"
import { useOptionalCurrentUser } from "../../hooks/use-auth"
import { resolveCanCreate, resolveItemPermissions } from "../../hooks/use-item-permissions"
import { writeOwnStatement } from "../../lib/own-statement"
import { useVerifiedRelationRecords } from "../../hooks/use-votes"
import { doneValue, type EdgeEntry, type FieldEntry } from "./field-register"
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

/**
 * Kann ich hier eigene Aussagen an Record-Kanten schreiben — und sehen, dass
 * sie gelten? Lesen, Schreiben und Verifikation (Leseregel L1), angemeldet,
 * schreibbar, und mit Autorisierungsmodell `item/create` für Relation-Items
 * im Space des Items (beim Anlegen: im aktuellen Space).
 */
export function canWriteStatements(connector: DataInterface, item: Item | null, meId: string | undefined, spaceId?: string | null): boolean {
  if (!meId || !isWritable(connector) || !isAuthenticatable(connector)) return false
  if (!(hasRelationRecords(connector) && hasRelationRecordWriter(connector) && hasClaimVerification(connector))) return false
  if (!hasAuthorization(connector)) return true
  const space = item && hasItemGroups(connector) ? connector.getItemGroupId(item.id) : (spaceId ?? null)
  return resolveCanCreate(connector, space, "relation")
}

const NEW_ITEM: Item = { id: "__new__", type: "", createdAt: "", createdBy: "", data: {} }

/** Zustand einer Person im Personenfeld mit Record-Kante. */
export interface FormPersonState {
  /** Der geltende Zustand (Gewinner nach one-per-subject). */
  state: string
  /** Die eigene Aussage einer anderen Person: sie gewinnt immer, nur sie ändert sie. */
  locked?: boolean
  /** Ich habe eine Aussage über die Person — gleich ob sie gerade gilt. */
  mine?: boolean
  /** Was gälte ohne meine Aussage (die geltende fremde); fehlt: Grundzustand. */
  fallback?: string
}

/**
 * Geltende Zustände der Personenfelder mit Record-Kante für das Formular
 * (Event: `invited` + `attends` in einem Feld), je Prädikat des Feldes, aus
 * den verifizierten Records (Leseregel L1). Ohne Schreibmöglichkeit kein
 * Eintrag — das Feld zeigt dann keine Zustände. `spaceId` ist der Space im
 * Kopf des Formulars, solange es kein Item gibt.
 */
export function usePeopleFormStates(
  item: Item | null,
  edges: readonly EdgeEntry[] | undefined,
  spaceId?: string | null,
): Record<string, { live: Record<string, FormPersonState> }> {
  const connector = useConnector()
  const { data: me } = useOptionalCurrentUser()
  const meId = me?.id
  const groups = useMemo(() => peopleLineGroups(edges), [edges])
  const predicates = useMemo(() => recordPeopleEdges(edges).map((edge) => edge.predicate), [edges])
  const records = useItemRecords(item ?? NEW_ITEM, item ? predicates : [])
  return useMemo(() => {
    const out: Record<string, { live: Record<string, FormPersonState> }> = {}
    if (!canWriteStatements(connector, item, meId, spaceId)) return out
    const to = `item:${item?.id ?? NEW_ITEM.id}`
    for (const group of groups) {
      const recordEdge = group.find((edge) => edge.storage === "record" && edge.qualifier)
      if (!recordEdge || !recordEdge.qualifier) continue
      const key = recordEdge.qualifier.key
      const allowed = new Set(recordEdge.qualifier.values.map((v) => v.id))
      const valueOf = (record: RelationRecord | undefined) => {
        const value = record?.fields?.[key]
        return typeof value === "string" && allowed.has(value) ? value : undefined
      }
      const own = records.filter((record) => record.predicate === recordEdge.predicate && record.to === to)
      const winners = onePerSubjectWinners(own, to)
      const withoutMine = onePerSubjectWinners(own.filter((record) => record.createdBy !== meId), to)
      const live: Record<string, FormPersonState> = {}
      for (const [from, winner] of winners) {
        if (!from.startsWith("global:")) continue
        const userId = from.slice("global:".length)
        const state = valueOf(winner)
        if (!state) continue
        const selfStatement = winner.createdBy === userId
        const mine = own.some((record) => record.from === from && record.createdBy === meId)
        const fallback = valueOf(withoutMine.get(from))
        live[userId] = {
          state,
          ...(selfStatement && userId !== meId ? { locked: true } : {}),
          ...(mine ? { mine: true } : {}),
          ...(fallback ? { fallback } : {}),
        }
      }
      out[group[0].predicate] = { live }
    }
    return out
  }, [connector, groups, item, meId, records, spaceId])
}

export interface SelfActionState {
  /** Die Selbstaktion ist hier möglich (Capability, Anmeldung, Schreibrecht). */
  available: boolean
  /**
   * Mein Zustand: bei einer Kante mit Qualifier der Wert meiner eigenen,
   * GELTENDEN Aussage, sonst `true`, wenn ich an der Kante stehe.
   * `undefined`: neutral.
   */
  mine: string | true | undefined
  /** Setzt meinen Zustand; derselbe Wert noch einmal nimmt die Aussage zurück. */
  act: (value?: string) => Promise<void>
  /** Nimmt meine Aussage zurück — idempotent („✓ Übernommen" zurückgeben). */
  withdraw: (guard?: (current: Item) => boolean) => Promise<void>
  /** Ein Schreibvorgang läuft. */
  busy: boolean
  /** Der letzte Schreibversuch scheiterte (Ablehnung des Connectors). */
  error: string | null
}

/**
 * Selbstaktion an einer Kante (C2). Record-Kanten schreiben den EIGENEN
 * Record über den RelationStore (Absagen schreibt `declined`, der Record
 * bleibt; dieselbe Pill noch einmal löscht ihn — keine Aussage mehr).
 * Eingebettete Kanten schreiben das Trägeritem (jedes Mitglied darf,
 * Entscheidung 14).
 *
 * Nicht verfügbar ohne die nötige Capability oder Berechtigung — die
 * Pill-Zeile täuscht nichts vor (Record: Lesen, Schreiben, Verifikation und
 * `item/create` für Relation-Items im Space des Items; eingebettet:
 * Bearbeiten des Trägeritems). Modi, Regel 1.
 *
 * Entschieden wird gegen den GELTENDEN Zustand (verifizierte eigene Aussage,
 * Leseregel L1) plus die noch laufende Absicht, nie gegen ungeprüfte Records:
 * Ein eigener Record ohne gültigen Claim wird über das Anlegen repariert,
 * nicht gelöscht.
 */
export function useSelfAction(item: Item, edge: EdgeEntry): SelfActionState {
  const connector = useConnector()
  const { data: me } = useOptionalCurrentUser()
  const meId = me?.id
  const isRecord = edge.storage === "record"
  const records = useItemRecords(item, isRecord ? [edge.predicate] : [])

  const available = useMemo(() => {
    if (!meId || !isWritable(connector) || !isAuthenticatable(connector)) return false
    if (isRecord) return edge.itemRole === "to" && !!edge.qualifier && canWriteStatements(connector, item, meId)
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

  // Optimistische Anzeige, gebunden an Item, Person und Connector. Sie endet,
  // sobald der geltende Zustand sie einholt, oder — nach Abschluss aller
  // Schreibvorgänge — mit der nächsten Meldung der Quelle.
  const context = `${item.id}|${meId ?? ""}`
  const [pending, setPending] = useState<{ value: string | true | undefined; context: string; settledAt?: unknown } | null>(null)
  const source = isRecord ? records : item
  const active = pending && pending.context === context ? pending : null
  useEffect(() => {
    if (!pending) return
    if (pending.context !== context) setPending(null)
    else if (pending.value === persisted) setPending(null)
    else if (pending.settledAt !== undefined && pending.settledAt !== source) setPending(null)
  }, [pending, persisted, context, source])
  const mine = active ? active.value : persisted

  // Die Absicht der laufenden Kette: Zwei Klicks vor dem nächsten Render
  // entscheiden gegeneinander, nicht beide gegen denselben alten Zustand.
  const intent = useRef<{ value: string | true | undefined; context: string } | null>(null)
  const mineRef = useRef(mine)
  mineRef.current = mine
  const sourceRef = useRef(source)
  sourceRef.current = source
  const queued = useRef(0)
  const [error, setError] = useState<string | null>(null)

  const chain = useRef<Promise<void>>(Promise.resolve())
  const [busy, setBusy] = useState(false)
  const act = useCallback(
    (value?: string, mode: "toggle" | "withdraw" = "toggle", guard?: (current: Item) => boolean) => {
      queued.current += 1
      setBusy(true)
      const run = async () => {
        try {
          if (!available || !meId) return
          const current = intent.current && intent.current.context === context ? intent.current.value : mineRef.current
          const wanted = value ?? true
          const next = mode === "withdraw" ? undefined : current === wanted ? undefined : wanted
          // Zurücknehmen ohne eigene Aussage: nichts zu tun (Doppelklick auf meinen Zustand).
          if (mode === "withdraw" && current === undefined) return
          intent.current = { value: next, context }
          setPending({ value: next, context })
          setError(null)
          try {
            let written = true
            if (isRecord) {
              // Die Bedingung gilt für das Trägeritem (etwa: noch offen); der
              // Record liegt daneben.
              const carrier = guard ? await connector.getItem(item.id) : null
              if (guard && (!carrier || !guard(carrier))) written = false
              else await writeOwnStatement(connector, item, { predicate: edge.predicate, from: `global:${meId}`, key: edge.qualifier!.key, value: typeof next === "string" ? next : null })
            } else {
              written = await writeEmbedded(connector, item, edge, meId, next, guard)
            }
            if (!written) {
              // Nichts geschrieben: die Zeile folgt wieder dem geltenden Stand.
              intent.current = null
              setPending(null)
            }
          } catch (err) {
            intent.current = null
            setPending(null)
            setError(err instanceof Error ? err.message : String(err))
          }
        } finally {
          queued.current -= 1
          if (queued.current === 0) {
            setBusy(false)
            intent.current = null
            setPending((p) => (p ? { ...p, settledAt: sourceRef.current } : p))
          }
        }
      }
      const next = chain.current.then(run)
      chain.current = next.catch(() => undefined)
      return next
    },
    [available, connector, context, edge, isRecord, item, meId],
  )

  const withdraw = useCallback((guard?: (current: Item) => boolean) => act(undefined, "withdraw", guard), [act])
  return { available, mine, act: (value?: string) => act(value), withdraw, busy, error }
}

/** Die eingebettete Kante: ich stehe daran (mit Wert) oder nicht (`undefined`). */
async function writeEmbedded(connector: DataInterface, item: Item, edge: EdgeEntry, meId: string, next: string | true | undefined, guard?: (current: Item) => boolean): Promise<boolean> {
  if (!isWritable(connector)) throw new Error("Dieser Speicher ist nur lesbar")
  const current = (await connector.getItem(item.id)) ?? item
  // Die Bedingung gegen DENSELBEN Stand, aus dem die neuen Relationen entstehen.
  if (guard && !guard(current)) return false
  const target = `global:${meId}`
  const relations = current.relations ?? []
  const key = edge.qualifier?.key
  const others = relations.filter((r) => !(r.predicate === edge.predicate && r.target === target))
  if (next === undefined) {
    // Nichts zurückzunehmen: nicht schreiben (die Kante fehlt schon, #531).
    if (others.length === relations.length) return false
    await connector.updateItem(item.id, { relations: others })
    return true
  }
  const existing = relations.find((r) => r.predicate === edge.predicate && r.target === target)
  const meta = { ...(existing?.meta ?? {}), ...(key && typeof next === "string" ? { [key]: next } : {}) }
  const mine = { predicate: edge.predicate, target, ...(Object.keys(meta).length > 0 ? { meta } : {}) }
  // An ihrer Stelle, damit die Reihenfolge der Kanten bleibt.
  const nextRelations = existing ? relations.map((r) => (r === existing ? mine : r)) : [...relations, mine]
  await connector.updateItem(item.id, { relations: nextRelations })
  return true
}

export interface FollowUpState {
  /** Schreibrecht am Item (Modi, Regel 1): Status ändern heißt das Item schreiben. */
  available: boolean
  busy: boolean
  error: string | null
  /** Schreibt den Erledigt-Wert (`complete`); zurück geht es nur über Bearbeiten oder das Modul. */
  run: (id: "complete") => Promise<void>
}

/**
 * Folgeaktionen einer Selbstaktion am Status-Feld (Entscheidung 27):
 * „Erledigt" schreibt den Wert, den das Register als erledigt markiert;
 * zurückgenommen wird er nicht (nur über Bearbeiten oder das Modul). Geschrieben wird das Trägeritem nach
 * dessen Rechten; das übrige `data` bleibt.
 */
export function useFollowUps(item: Item, statusField: FieldEntry | undefined, defaultStatus?: string, edge?: EdgeEntry): FollowUpState {
  const connector = useConnector()
  const { data: me } = useOptionalCurrentUser()
  const meId = me?.id
  const available = useMemo(
    () => !!statusField && !!meId && isWritable(connector) && resolveItemPermissions(connector, item, meId).canEdit,
    [connector, item, meId, statusField],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(
    async (id: "complete") => {
      if (!available || !statusField || !isWritable(connector)) return
      const value = id === "complete" ? doneValue(statusField) : undefined
      if (value === undefined) return
      setBusy(true)
      setError(null)
      try {
        // #531: gegen den GELTENDEN Stand entscheiden, nicht gegen den Render.
        // Bin ich nicht mehr an der Kante, oder passt der Status nicht mehr zur
        // Aktion, wird nichts geschrieben; die Zeile folgt dem lebenden Item.
        // Ein fremder Edit zwischen Lesen und Schreiben bleibt möglich (kein
        // bedingtes Schreiben im DataInterface); das betrifft nur die Semantik
        // der Folgeaktion, Mitglieder dürfen den Status ohnehin ändern.
        const current = await connector.getItem(item.id)
        if (!current || !meId) return
        const status = (current.data as Record<string, unknown> | undefined)?.[statusField.key]
        const isDone = status === doneValue(statusField)
        if (isDone) return
        if (edge && !(await stillMine(connector, current, edge, meId))) return
        await connector.updateItem(item.id, { data: { ...(current.data ?? {}), [statusField.key]: value } })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(false)
      }
    },
    [available, connector, defaultStatus, edge, item, meId, statusField],
  )
  return { available, busy, error, run }
}

/** Stehe ich (noch) an der Kante? Eingebettet am Item, als Record über den RelationStore. */
async function stillMine(connector: DataInterface, current: Item, edge: EdgeEntry, meId: string): Promise<boolean> {
  const self = `global:${meId}`
  if (edge.storage === "embedded") return (current.relations ?? []).some((r) => r.predicate === edge.predicate && r.target === self)
  // Nur geltende eigene Aussagen (Leseregeln L1/L2): verifiziert valid oder trusted.
  if (!hasRelationRecords(connector) || !hasClaimVerification(connector)) return false
  const own = await connector.getRelationRecords({ predicate: edge.predicate, from: self, to: `item:${current.id}` })
  for (const record of own) {
    if (record.createdBy !== meId) continue
    const verdict = await connector.verifyRecordClaim(record)
    if (verdict === "valid" || verdict === "trusted") return true
  }
  return false
}
