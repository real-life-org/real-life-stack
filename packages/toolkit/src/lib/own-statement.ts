// Die eigene Aussage an einer Record-Kante schreiben.
//
// Spec: docs/spec/08-relation-records.md → „Qualifier an Kanten" (Regeln 8,
// 10), „Teilnahme am Event", Fassaden-Regeln 2 und 4, Schreibregel 2.
//
// Eine Stelle für Selbstaktion (C2) und Personenfeld im Formular (C1): Die
// eigene Aussage über eine Person — mich selbst oder eine andere
// („eingetragen von …") — liegt immer im EIGENEN Record-Slot
// (`createdBy` = ich). Andere Records werden nie angefasst.

import type { DataInterface, Item } from "@real-life/data-interface"
import {
  hasRelationRecords,
  hasRelationRecordWriter,
  isAuthenticatable,
  selfStatementFields,
} from "@real-life/data-interface"

export interface OwnStatement {
  predicate: string
  /** Der Gegenstand als Target, z. B. `global:<userId>`. */
  from: string
  /** Schlüssel des Qualifiers (`role`). */
  key: string
  /** Der Wert, oder `null`: keine Aussage mehr (eigenen Record löschen). */
  value: string | null
}

/**
 * Setzt die eigene Aussage über `statement.from` zum Item.
 *
 * - `value: null` löscht den eigenen Record, wenn es ihn gibt.
 * - Sonst über `createRelationRecord`: idempotent, und im Modus `signed`
 *   repariert es einen eigenen Slot ohne gültigen Claim (Schreibregel 2).
 *   Weicht der Bestand ab, gleicht ein Update ihn an (`fields` ersetzt
 *   vollständig, übrige Felder bleiben erhalten).
 *
 * Wirft, wenn der Connector nicht schreiben kann oder ablehnt — der Aufrufer
 * zeigt den Fehler.
 */
export async function writeOwnStatement(connector: DataInterface, item: Item, statement: OwnStatement): Promise<void> {
  if (!hasRelationRecords(connector) || !hasRelationRecordWriter(connector) || !isAuthenticatable(connector)) {
    throw new Error("Dieser Speicher kann keine Aussagen schreiben")
  }
  const me = (await connector.getCurrentUser())?.id
  if (!me) throw new Error("Nicht angemeldet")
  const to = `item:${item.id}`
  if (statement.value === null) {
    const mine = (await connector.getRelationRecords({ predicate: statement.predicate, from: statement.from, to })).find(
      (record) => record.createdBy === me,
    )
    if (mine) await connector.deleteRelationRecord(mine.id)
    return
  }
  const fields = selfStatementFields(statement.predicate, statement.key, statement.value, item)
  const record = await connector.createRelationRecord({ predicate: statement.predicate, from: statement.from, to, fields })
  const differs = Object.entries(fields).some(([k, v]) => record.fields?.[k] !== v)
  if (differs) await connector.updateRelationRecord(record.id, { fields: { ...(record.fields ?? {}), ...fields } })
}
