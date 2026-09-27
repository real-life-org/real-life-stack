// Zählregeln für Record-Kanten.
//
// Spec: docs/spec/08-relation-records.md → „Qualifier an Kanten", Regel 10,
// und „Gewinner unter `one-per-subject`".
//
// Reine Funktionen: Sie wählen aus Records, die bereits gelten (Leseregel L1,
// also nach positivem Verdikt, und mit genau einem `from`/`to` — das leistet
// die Projektion `relationRecordFromItem`). Verifizieren ist Sache des
// Aufrufers; hier wird nichts gezählt, was er nicht hereingibt.

import type { RelationRecord } from "./index.js"

const PERSON_PREFIX = "global:"

export interface OnePerSubjectOptions {
  /**
   * Die Identität des Gegenstands, wenn er eine Person ist, sonst `undefined`.
   * Standard: `global:<id>` ist die Person `<id>` (Target-Konvention aus 04 für
   * `otherKind: "person"`); jedes andere Target ist keine Person.
   */
  subjectIdentity?: (from: string) => string | undefined
}

function defaultSubjectIdentity(from: string): string | undefined {
  return from.startsWith(PERSON_PREFIX) && from.length > PERSON_PREFIX.length
    ? from.slice(PERSON_PREFIX.length)
    : undefined
}

/**
 * Der Zeitpunkt einer Aussage (Regel 4): mit Claim `createdAt` aus dem
 * Payload — die Verifikation hat Payload und Record gleichgesetzt, also ist es
 * `createdAt` des Records —, ohne Claim `updatedAt` des Relation-Items, fehlt
 * es, `createdAt`.
 */
function statementTime(record: RelationRecord): number {
  const stamp = record.claim ? record.createdAt : (record.updatedAt ?? record.createdAt)
  const time = Date.parse(stamp)
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

function isSelfStatement(record: RelationRecord, identity: string | undefined): boolean {
  return identity !== undefined && record.createdBy === identity
}

/** `a` schlägt `b`? Regeln 3–5, ohne Abhängigkeit von der Reihenfolge. */
function beats(a: RelationRecord, b: RelationRecord, identity: string | undefined): boolean {
  const aSelf = isSelfStatement(a, identity)
  const bSelf = isSelfStatement(b, identity)
  if (aSelf !== bSelf) return aSelf
  const ta = statementTime(a)
  const tb = statementTime(b)
  if (ta !== tb) return ta > tb
  // Regel 5: lexikographisch größte id, verglichen nach UTF-16-Codeeinheiten
  // (so vergleicht JavaScript Strings).
  return a.id > b.id
}

function winnersByKey(
  records: readonly RelationRecord[],
  key: (record: RelationRecord) => string,
  options?: OnePerSubjectOptions,
): Map<string, RelationRecord> {
  const identityOf = options?.subjectIdentity ?? defaultSubjectIdentity
  const winners = new Map<string, RelationRecord>()
  for (const record of records) {
    const k = key(record)
    const current = winners.get(k)
    if (!current || beats(record, current, identityOf(record.from))) winners.set(k, record)
  }
  return winners
}

/**
 * `one-per-subject` für EIN Ziel: je Gegenstand (`from`) der Record, der gilt.
 * Records zu anderen Zielen nehmen nicht teil. Schlüssel der Map ist `from`.
 *
 * - Ist der Gegenstand eine Person, gewinnt ihre Selbstaussage
 *   (`createdBy` = Identität von `from`) immer.
 * - Sonst die jüngste Aussage; bei gleichem Zeitpunkt die größte `id`.
 */
export function onePerSubjectWinners(
  records: readonly RelationRecord[],
  to: string,
  options?: OnePerSubjectOptions,
): Map<string, RelationRecord> {
  return winnersByKey(
    records.filter((record) => record.to === to),
    (record) => record.from,
    options,
  )
}

/** `one-per-subject` über alle Ziele: ein Gewinner je (Gegenstand, Ziel). */
export function onePerSubjectWinnerList(
  records: readonly RelationRecord[],
  options?: OnePerSubjectOptions,
): RelationRecord[] {
  return [...winnersByKey(records, (record) => JSON.stringify([record.from, record.to]), options).values()]
}

/**
 * `collect-accepted`: Die Aussagen addieren sich, keine überstimmt eine
 * andere. Eine Aussage über eine Person zeigt sich erst, wenn die Person sie
 * angenommen hat (05 → UI-Regeln, Regel 5); ihre Selbstaussage gilt ohne
 * Annahme. Definiert nur für Personen als Gegenstand: Records, deren
 * Gegenstand keine Person ist, fallen heraus.
 */
export function collectAccepted(
  records: readonly RelationRecord[],
  isAccepted: (record: RelationRecord) => boolean,
  options?: OnePerSubjectOptions,
): RelationRecord[] {
  const identityOf = options?.subjectIdentity ?? defaultSubjectIdentity
  return records.filter((record) => {
    const identity = identityOf(record.from)
    if (identity === undefined) return false
    return isSelfStatement(record, identity) || isAccepted(record)
  })
}
