import type { SpaceAdmission } from "@real-life/wot-core/types"

import type { MirrorOrderPosition } from "../types.js"
import { compareAdmissionOrUndefined, type MirrorRegistryView } from "./registry-view.js"
import { compareVersion } from "./version.js"

/**
 * Der Abgleich aus Spec 09 §Ablage und Registry ist ein ZIELZUSTAND, kein
 * Ereignisstrom: aus Lesesicht, Ziel-Kennung, Home-Item und Slot-Zustand folgt
 * je Registry-Eintrag genau eine Aktion. Das Modul ist rein — es liest nichts,
 * schreibt nichts und kennt keinen Connector; die Auslöser (Erstsync,
 * Item-Änderung, Registry-Änderung, Mitgliedschafts- oder Kennungswechsel,
 * Slot-Änderung im Ziel) verdrahtet eine spätere Scheibe.
 */

export type MirrorReconcileAction =
  | "publish-live"
  | "publish-tombstone"
  | "mark-revoked"
  | "mark-pending"
  | "none"

/**
 * Der Zustand des Slots `mirrors[[homeSpaceId, itemId]]` im Ziel-Space aus
 * Sicht des Autors. `invalid` deckt jeden Schnappschuss ab, den die
 * Empfängerprüfung verwerfen würde (kaputte oder fremde Signatur, fremder
 * Map-Schlüssel, fremder Ziel-Space) — für den Abgleich ist er so gut wie
 * nicht vorhanden und löst dieselbe Reparatur aus.
 */
export type MirrorSlotState =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "present"; position: MirrorOrderPosition; isTombstone: boolean }

export interface MirrorReconcileEntry {
  itemId: string
  targetSpaceId: string
  /** Die gefaltete Lesesicht des Registry-Eintrags (`deriveRegistryView`). */
  view: MirrorRegistryView
  /** Die AKTUELLE Aufnahme-Kennung des Autors im Ziel-Space; `undefined` = keine gültige Aufnahme. */
  targetAdmission?: SpaceAdmission
  /**
   * Mitgliedschaft im Ziel-Space nach lokalem Stand. Nur der `revoked`-Fall
   * braucht sie: für `accepted` drückt sich der Mitgliedschaftsverlust bereits
   * im Absinken der Kennung aus.
   */
  isMember: boolean
  /** `sha256(kanonisches Home-Item)`; `null`, wenn das Home-Item fehlt (gelöscht). */
  homeItemHash: string | null
  slot: MirrorSlotState
}

export interface MirrorReconcileInput {
  entries: MirrorReconcileEntry[]
  /**
   * Was eine Wiederaufnahme aus einem `accepted`-Eintrag macht. Spec 09 sagt
   * `revoked` (Default): eine neue Freigabe braucht `shareItem`. Anwendungen
   * mit Annahme-Fläche führen stattdessen den Zwischenstatus `pending`
   * (Spec 12 Regel 4) — dieselbe Regel, nur mit einer UI davor.
   */
  readmission?: "revoked" | "pending"
}

export interface MirrorReconcilePlanEntry {
  itemId: string
  targetSpaceId: string
  action: MirrorReconcileAction
}

export function planReconcile(input: MirrorReconcileInput): MirrorReconcilePlanEntry[] {
  const readmission: MirrorReconcileAction = input.readmission === "pending" ? "mark-pending" : "mark-revoked"
  return input.entries.map((entry) => ({
    itemId: entry.itemId,
    targetSpaceId: entry.targetSpaceId,
    action: actionFor(entry, readmission),
  }))
}

function actionFor(entry: MirrorReconcileEntry, readmission: MirrorReconcileAction): MirrorReconcileAction {
  // Spec 12 Regel 5: `pending` publiziert NIE. Der Space ist noch nicht
  // angenommen — die Freigabe nach Invariante 3 fehlt schlicht.
  if (entry.view.status === "pending") return "none"

  if (entry.view.status === "revoked") {
    // Solange der Autor Mitglied ist, schuldet er dem Ziel den Tombstone.
    // Danach kann er nichts mehr zustellen; die Sichtbarkeit regelt dann
    // Invariante 11 beim Empfänger.
    return entry.isMember && !tombstoneDelivered(entry) ? "publish-tombstone" : "none"
  }

  const drift = compareAdmissionOrUndefined(entry.targetAdmission, entry.view.admission)
  // Jeder Anstieg der Ziel-Kennung, auch von `undefined` auf eine Kennung, ist
  // eine Wiederaufnahme: die alte Freigabe galt einer anderen Aufnahme.
  if (drift > 0) return readmission
  // Mitgliedschaft verloren (Kennung gesunken oder weggefallen): kein
  // Publizieren mehr, der Beitrag wird widerrufen — mit der Kennung der
  // Lesesicht, damit er in der Faltung gegen jeden alten `accepted`-Beitrag
  // derselben Aufnahme gewinnt.
  if (drift < 0) return "mark-revoked"

  // Fehlt das Home-Item (gelöscht, auch durch einen anderen Home-Editor),
  // bleibt der Eintrag `accepted`, aber zugestellt wird ein Tombstone.
  if (entry.homeItemHash === null) return tombstoneDelivered(entry) ? "none" : "publish-tombstone"

  if (entry.slot.kind !== "present") return "publish-live"
  if (entry.homeItemHash !== entry.view.publishedHash) return "publish-live"
  // Der Slot ist ein CRDT-Register: er kann hinter die Registry-Position
  // zurückfallen, wenn ein Mitglied einen alten gültigen Stand zurückschreibt.
  return compareVersion(entry.slot.position, registryPosition(entry.view)) < 0 ? "publish-live" : "none"
}

/** Liegt im Ziel bereits ein Tombstone mit Version ≥ Registry-Position? */
function tombstoneDelivered(entry: MirrorReconcileEntry): boolean {
  return (
    entry.slot.kind === "present" &&
    entry.slot.isTombstone &&
    compareVersion(entry.slot.position, registryPosition(entry.view)) >= 0
  )
}

function registryPosition(view: MirrorRegistryView): MirrorOrderPosition {
  return { seq: view.seq, deviceId: view.deviceId, tiebreak: view.tiebreak }
}
