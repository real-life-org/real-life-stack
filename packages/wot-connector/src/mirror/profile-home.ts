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

/**
 * Die Mitgliedschaft im Ziel-Space, dreiwertig.
 *
 * `"unknown"` ist der Zustand, in dem die Mitgliederprojektion des Adapters
 * noch nichts sagt (leere `members`-Liste — ein echter Space hat immer
 * mindestens seinen Ersteller). Er ist ausdrücklich NICHT `"not-member"`:
 * fehlende Information darf keinen Widerruf und keine Bestandsmarke auslösen.
 */
export type SpaceMembership = "member" | "not-member" | "unknown"

/**
 * Die Mitgliedschaft aus der Projektion des Adapters (`SpaceInfo.members` aus
 * `_members`). Ein Space, den dieses Gerät gar nicht mehr sieht, ist ein
 * Verlust; eine leere Mitgliederliste ist dagegen „noch nichts gesagt".
 */
export function membershipOf(space: SpaceInfo | undefined, did: string): SpaceMembership {
  if (!space) return "not-member"
  if (!space.members || space.members.length === 0) return "unknown"
  return space.members.includes(did) ? "member" : "not-member"
}

/** Was eine Mitgliedschaftslage am Registry-Eintrag ändern muss — `null` = nichts. */
export type MembershipTransition = { status: "pending" | "accepted" | "revoked" } | null

/**
 * Die Abgleichsregel aus Spec 09 §Ablage und Registry in der Profil-Lesart
 * (Spec 12 Regel 4 und 7), rein aus Lesesicht und aktueller Kennung des
 * Ziel-Space:
 *
 * - kein Eintrag → `pending`, mit oder ohne Kennung (der Eintrag entsteht,
 *   sobald der Space auf einem Gerät erscheint; Freigabe ist die Annahme).
 *   Auch ein Alt-Space ohne Ereignisse bekommt so einen Eintrag — er trägt
 *   dann `admission: undefined` (Spec 12 Regel 4 in der Fassung rls#354:
 *   „Eintraege und Annahme sind auch ohne Kennung zulässig").
 * - Kennung des Space höher als eine GESETZTE Kennung des Eintrags →
 *   Wiederaufnahme, also `pending` mit der neuen Kennung
 * - Kennung des Space gesetzt, Eintrag OHNE Kennung → **Nachführung** (09,
 *   Fassung rls#354): der Status bleibt, er wird nur mit der Kennung neu
 *   geschrieben. Ohne Ereignisse ist eine Entfernung nicht feststellbar, und
 *   die Person IST Mitglied — eine bestehende Freigabe darf daran nicht
 *   zerbrechen. Ein Widerruf wird nicht nachgeführt: er bleibt widerrufen,
 *   und eine erneute Freigabe läuft ohnehin über `shareProfile`.
 * - Kennung niedriger oder weg → Mitgliedschaft verloren, also `revoked`
 * - gleich → nichts
 *
 * `membership` trägt den Mitgliedschaftsverlust, den der Kennungsvergleich NICHT
 * ausdrücken kann: ein Eintrag ohne Kennung (seit der Übergangsregel in der
 * Fassung rls#354 der Regelfall für Alt-Spaces ohne Ereignisse) vergleicht sich
 * mit „keine Kennung" als gleich, auch wenn der Ziel-Space längst weg ist. Die
 * Mitgliedschaftsbindung (09 Invariante 11) hängt aber an der Mitgliedschaft,
 * nicht an der Ordnung der Kennungen; deshalb entscheidet sie zuerst.
 *
 * `"unknown"` ist der dritte Zustand und heißt NICHTS TUN: eine noch nicht
 * geladene Mitgliederprojektion ist fehlende Information, kein Verlust. Sie als
 * Verlust zu lesen machte aus einem Erstsync einen dauerhaften Widerruf —
 * Einträge werden nie gelöscht, und der spätere `accepted`-Beitrag desselben
 * Geräts löst den Widerruf nicht ab (er hat ihn ja beobachtet, aber die Person
 * hat nichts entschieden).
 *
 * Die Kennung selbst setzt der Schreibpfad; hier steht nur, DASS ein
 * Statuswechsel fällig ist.
 */
export function planMembershipTransition(
  view: MirrorRegistryView | null,
  spaceAdmission: SpaceAdmission | undefined,
  membership: SpaceMembership = "member",
): MembershipTransition {
  // Fehlende Information ist kein Statuswechsel.
  if (membership === "unknown") return null
  // Kein Eintrag und keine Mitgliedschaft: es gibt nichts zu widerrufen.
  if (!view) return membership === "member" ? { status: "pending" } : null
  // Mitgliedschaft verloren — unabhängig davon, ob die Kennungen das zeigen.
  if (membership === "not-member") return view.status === "revoked" ? null : { status: "revoked" }

  const order = compareAdmissionOrUndefined(spaceAdmission, view.admission)
  if (order > 0) {
    // Nachführung statt Wiederaufnahme: der Eintrag trug noch KEINE Kennung.
    if (!view.admission) return view.status === "revoked" ? null : { status: view.status }
    return { status: "pending" }
  }
  if (order < 0) return view.status === "revoked" ? null : { status: "revoked" }
  return null
}

/**
 * Die Bestands-Mitgliedschaften der Übergangsregel (Spec 12 Regel 5): alle
 * geteilten Spaces außer dem persönlichen.
 *
 * AUSNAHMSLOS, auch ohne Aufnahme-Kennung (Fassung rls#354): „Der Connector
 * legt für ALLE zu diesem Zeitpunkt bestehenden Mitgliedschaften
 * `accepted`-Einträge an … auch ohne Aufnahme-Kennung (Alt-Spaces ohne
 * Ereignisse, `admission = undefined`)." Der Eintrag trägt dann keine Kennung
 * und wird nachgeführt, sobald der Space seine ersten Ereignisse bekommt (09,
 * Nachführung) — die Mitgliedschaft wird dadurch nie eingeschränkt.
 *
 * Draußen bleibt jedes Ziel, für das bereits ein Registry-Eintrag existiert.
 */
export function planStockGrants(
  spaces: readonly SpaceInfo[],
  homeSpaceId: string,
  did: string,
  hasRegistryEntry: (targetSpaceId: string) => boolean = () => false,
): string[] {
  return spaces
    .filter((space) =>
      space.id !== homeSpaceId
      && space.type === "shared"
      && space.appTag !== "rls-private"
      // Ein sichtbarer Space ist nicht zwingend eine Mitgliedschaft: die
      // Space-Liste kann einen Space führen, aus dem die Person entfernt
      // wurde. Ohne diese Prüfung wirft der Schreibpfad mitten im
      // Bestandsdurchlauf — und weil Beiträge und Marke in EINER Transaktion
      // liegen, fiele der ganze Durchlauf samt echter Bestandsfreigaben aus.
      && membershipOf(space, did) === "member"
      // Über einen vorhandenen Eintrag wurde bereits entschieden — auch ein
      // Widerruf ist eine Entscheidung. Die Übergangsregel gilt nur für
      // Mitgliedschaften, die es vor dieser Spec schon gab, und darf eine
      // getroffene Entscheidung nie überschreiben, auch nicht, wenn die Marke
      // dieses Gerät verspätet erreicht.
      && !hasRegistryEntry(space.id))
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
  // `Object.create(null)`: ein Gerätename `__proto__` aus einem fremden Beitrag
  // setzte sonst den Prototyp statt einen Eintrag — die Abdeckung fehlte still.
  const supersedes: Record<string, number> = Object.create(null)
  let found = false
  for (const [deviceId, contribution] of Object.entries(byDevice ?? {})) {
    if (!contribution || contribution.status === "accepted") continue
    // Ein Gerätename, den der Wertvertrag der benannten Wurzeln nicht trägt
    // (`__proto__`, `constructor`, `prototype` — adapter-yjs prüft REKURSIV,
    // also auch in `supersedes`), kann hier nicht stehen: der Schreibvorgang
    // würde werfen, und die Freigabe käme gar nicht erst zustande. Ein solcher
    // Beitrag stammt nie von diesem Code (Geräte-Ids kommen aus dem
    // DocLogStore), er bleibt in der Faltung und damit unabgedeckt — der
    // Eintrag bleibt fail-closed `revoked`, statt dass ein Widerruf
    // verschwindet.
    if (UNSTORABLE_DEVICE_IDS.has(deviceId)) continue
    supersedes[deviceId] = contribution.statusSeq
    found = true
  }
  return found ? supersedes : undefined
}

/**
 * Schlüssel, die der Wertvertrag benannter Wurzeln nicht trägt (wot-core
 * `assertValidNamedRootKey`, im Adapter rekursiv über den ganzen Wert geprüft).
 */
const UNSTORABLE_DEVICE_IDS = new Set(["__proto__", "constructor", "prototype"])

/**
 * Normalisiert die lose typisierte Eingabe von `updateMyProfile` auf die
 * Item-Felder.
 *
 * Die Item-Form (`displayName`, `avatarUrl`) ist die Wahrheit (Spec 12 §Form);
 * die alten Namen `name` und `avatar` bleiben angenommen, weil sie die heutigen
 * Aufrufer im Baukasten und in den anderen Connectoren benutzen. Unbekannte
 * Schlüssel werden ignoriert — insbesondere `did`, das nie aus der Eingabe
 * stammt (Regel 1).
 */
export function normalizeProfileFields(updates: Record<string, unknown>): ProfileItemFields {
  const fields: ProfileItemFields = {}
  const pick = (...keys: string[]): unknown => {
    for (const key of keys) if (key in updates) return updates[key]
    return undefined
  }
  const text = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined
    if (value === null || value === "") return null
    return typeof value === "string" ? value : undefined
  }

  const displayName = text(pick("displayName", "name"))
  if (displayName !== undefined) fields.displayName = displayName
  const bio = text(pick("bio"))
  if (bio !== undefined) fields.bio = bio
  const avatarUrl = text(pick("avatarUrl", "avatar"))
  if (avatarUrl !== undefined) fields.avatarUrl = avatarUrl
  const address = text(pick("address"))
  if (address !== undefined) fields.address = address
  const locationName = text(pick("locationName"))
  if (locationName !== undefined) fields.locationName = locationName
  if ("position" in updates) fields.position = updates.position ?? null

  return fields
}
