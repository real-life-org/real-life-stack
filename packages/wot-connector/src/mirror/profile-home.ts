/**
 * Die reine Hälfte der Home-Quelle aus Spec 12 (Profile): die Item-Form des
 * Profils, die Feld-Zusammenführung der Schreibpfade und die Entscheidung, was
 * eine Mitgliedschaftslage für den Registry-Eintrag bedeutet.
 *
 * Kein I/O, kein Connector — die Verdrahtung liegt im `WotConnector`. So sind
 * Regel 1, 2, 4, 5 und 7 einzeln prüfbar, statt nur im Zusammenspiel eines
 * Connectors beobachtbar zu sein.
 */
import type { CreateItemInput } from "@real-life-stack/data-interface"
import { deriveContext } from "@real-life-stack/data-interface"
import type { SpaceAdmission, SpaceInfo } from "@real-life/wot-core/types"

import type { MirrorRegistryContribution } from "../types.js"
import { compareAdmissionOrUndefined, type MirrorRegistryView } from "./registry-view.js"

/**
 * Die Felder, die ein Schreibpfad am Profil-Item setzen darf. `undefined` heißt
 * „nicht anfassen", ein leerer Wert (`null` oder `""`) entfernt das Feld —
 * dieselbe Ersetzungs-Semantik wie bei jedem anderen Item-Update.
 *
 * `did` steht NICHT hier: die Identität des Profils ist nicht verhandelbar
 * (Regel 1) und wird immer aus der Sitzungs-DID gesetzt.
 */
export interface ProfileItemFields {
  /** person/v1 */
  displayName?: string | null
  bio?: string | null
  avatarUrl?: string | null
  /** place/v1 — `person/v1` hat KEIN Positionsfeld (Regel 2). */
  position?: unknown
  address?: string | null
  locationName?: string | null
}

const PROFILE_FIELDS = ["displayName", "bio", "avatarUrl", "position", "address", "locationName"] as const

/**
 * Führt die Feldänderungen eines Schreibpfads auf die Daten des Profil-Items
 * zusammen (Spec 12 Regel 1 und 2).
 *
 * `data.did` wird IMMER auf die DID der Sitzung gesetzt, nie aus der Eingabe
 * übernommen: an diesem Feld hängt die Unterscheidung Profil/Platzhalter
 * (Regel 3) und die Empfängerprüfung (Regel 8).
 */
export function mergeProfileData(
  did: string,
  current: Record<string, unknown> | undefined,
  fields: ProfileItemFields,
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...(current ?? {}) }
  for (const field of PROFILE_FIELDS) {
    const value = fields[field]
    if (value === undefined) continue
    if (value === null || value === "") {
      delete data[field]
      continue
    }
    // Kopie statt Referenz: ein `position`-Objekt des Aufrufers darf nicht im
    // CRDT-Doc landen und dort nachträglich von außen veränderbar bleiben.
    data[field] = typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value
  }
  data.did = did
  return data
}

/**
 * Die Anlage-Form des Profil-Items: `id`, `createdBy` und `data.did` sind die
 * DID (Spec 12 Regel 1). `@context` leitet sich aus den Daten ab, `place/v1`
 * kommt also genau dann dazu, wenn eine Position gesetzt ist (Regel 2).
 */
export function profileItemInput(did: string, fields: ProfileItemFields): CreateItemInput {
  const data = mergeProfileData(did, undefined, fields)
  return {
    id: did,
    type: "person",
    createdBy: did,
    "@context": deriveContext("person", data),
    data,
  } as CreateItemInput
}

/** Was eine Mitgliedschaftslage am Registry-Eintrag ändern muss — `null` = nichts. */
export type MembershipTransition = { status: "pending" | "revoked" } | null

/**
 * Die Abgleichsregel aus Spec 09 §Ablage und Registry in der Profil-Lesart
 * (Spec 12 Regel 4 und 7), rein aus Lesesicht und aktueller Kennung des
 * Ziel-Space:
 *
 * - kein Eintrag und gültige Kennung → `pending` (der Eintrag entsteht, sobald
 *   der Space auf einem Gerät erscheint; Freigabe ist die Annahme)
 * - kein Eintrag und KEINE Kennung → nichts. Ein Alt-Space ohne Ereignisse hat
 *   nach 09 „keine gültige Aufnahme"; er bekommt erst einen Eintrag, wenn
 *   Ereignisse auftauchen.
 * - Kennung des Space höher als die des Eintrags (auch `undefined` → Kennung)
 *   → Wiederaufnahme, also `pending` mit der neuen Kennung
 * - Kennung niedriger oder weg → Mitgliedschaft verloren, also `revoked`
 * - gleich → nichts
 *
 * Die Kennung selbst setzt der Schreibpfad; hier steht nur, DASS ein
 * Statuswechsel fällig ist.
 */
export function planMembershipTransition(
  view: MirrorRegistryView | null,
  spaceAdmission: SpaceAdmission | undefined,
): MembershipTransition {
  if (!view) return spaceAdmission ? { status: "pending" } : null

  const order = compareAdmissionOrUndefined(spaceAdmission, view.admission)
  if (order > 0) return { status: "pending" }
  if (order < 0) return view.status === "revoked" ? null : { status: "revoked" }
  return null
}

/**
 * Die Bestands-Mitgliedschaften der Übergangsregel (Spec 12 Regel 5): alle
 * geteilten Spaces außer dem persönlichen, die eine gültige Aufnahme-Kennung
 * haben.
 *
 * Alt-Spaces ohne Kennung bleiben bewusst draußen — eine Freigabe setzt nach
 * 09 eine gültige Aufnahme voraus. Sie laufen später über Regel 4 (`pending`),
 * sobald Ereignisse auftauchen.
 */
export function planStockGrants(spaces: readonly SpaceInfo[], homeSpaceId: string): string[] {
  return spaces
    .filter((space) =>
      space.id !== homeSpaceId
      && space.type === "shared"
      && space.appTag !== "rls-private"
      && Boolean(space.admission))
    .map((space) => space.id)
}

/**
 * Das Maximum zweier Aufnahme-Kennungen mit der Ordnung aus Spec 09 (keine
 * Kennung liegt unter jeder Kennung).
 *
 * Ein Widerruf trägt `max(admission der Lesesicht, aktuelle Kennung)` — sonst
 * verlöre er in der Faltung gegen den alten `accepted`-Beitrag eines
 * Offline-Geräts. Das Ergebnis ist eine KOPIE: die Kennung der Lesesicht ist
 * aus dem Doc gelesen und darf nicht als Referenz zurück hineingeschrieben
 * werden.
 */
export function maxAdmission(
  a: SpaceAdmission | undefined,
  b: SpaceAdmission | undefined,
): SpaceAdmission | undefined {
  const winner = compareAdmissionOrUndefined(a, b) >= 0 ? a : b
  return winner ? { keyGeneration: winner.keyGeneration } : undefined
}

/**
 * Die `(deviceId → statusSeq)` aller beobachteten NICHT-`accepted` Beiträge
 * (Spec 09 §Ablage und Registry, Spec 12 Regel 9).
 *
 * Nicht nur die Widerrufe: `pending` unterliegt derselben Abdeckung, sonst
 * bliebe der gefaltete Status nach einer Annahme auf `pending` stehen.
 */
export function supersedesOf(
  byDevice: Record<string, MirrorRegistryContribution>,
): Record<string, number> | undefined {
  const supersedes: Record<string, number> = {}
  let found = false
  for (const [deviceId, contribution] of Object.entries(byDevice ?? {})) {
    if (!contribution || contribution.status === "accepted") continue
    supersedes[deviceId] = contribution.statusSeq
    found = true
  }
  return found ? supersedes : undefined
}
