import { createJcsEd25519JwsWithSigner, decodeJws, verifyJwsWithPublicKey } from "@real-life/wot-core/protocol"
import type { JsonValue, ProtocolCryptoAdapter } from "@real-life/wot-core/protocol"

import type { MirrorSnapshotPayload, SerializedItem } from "../types.js"
import { canonicalSnapshotBytes, signedSnapshotFields } from "./canonical.js"
import { mirrorMapKey } from "./keys.js"
import { tiebreakOf } from "./version.js"

/** `typ` des Mirror-Schnappschusses — eigener Wert, damit eine JWS aus einem anderen Kontext hier nicht durchgeht. */
export const MIRROR_SNAPSHOT_JWS_TYP = "rls-mirror+jws"

/** Operation-förmiger Signierer; gibt nie Schlüsselmaterial heraus (wie `ClaimSigner` in Spec 08). */
export interface MirrorSnapshotSigner {
  kid: string
  signEd25519(bytes: Uint8Array): Promise<Uint8Array>
}

export interface BuildSnapshotInput {
  homeSpaceId: string
  itemId: string
  targetSpaceId: string
  /** `null` = Tombstone */
  item: SerializedItem | null
  authorDid: string
  /** Home-weiter Zähler (`nextSeq`) */
  seq: number
  deviceId: string
  /** Reine Anzeigezeit (ISO) */
  ts: string
}

/**
 * Baut die Payload nach Spec 09 §Snapshot-Form und setzt dabei die
 * Autor-Invarianten schon beim SENDER durch (Invariante 5 und 6). Ein
 * Schnappschuss, den der Empfänger ohnehin verwerfen müsste, soll gar nicht
 * erst signiert werden.
 */
export function buildSnapshotPayload(input: BuildSnapshotInput): MirrorSnapshotPayload {
  if (!isPublishableSeq(input.seq)) {
    throw new Error(`buildSnapshotPayload: seq ${input.seq} ist kein publizierbarer Zählerstand`)
  }
  if (input.item) {
    if (input.item.id !== input.itemId) {
      throw new Error(
        `buildSnapshotPayload: item.id "${input.item.id}" ≠ itemId "${input.itemId}" (Spec 09 Invariante 6)`,
      )
    }
    if (input.item.createdBy !== input.authorDid) {
      throw new Error(
        `buildSnapshotPayload: authorDid "${input.authorDid}" ≠ item.createdBy "${input.item.createdBy}" — nur der Autor signiert (Spec 09 Invariante 5)`,
      )
    }
  }
  return {
    homeSpaceId: input.homeSpaceId,
    itemId: input.itemId,
    targetSpaceId: input.targetSpaceId,
    version: { seq: input.seq, deviceId: input.deviceId, ts: input.ts },
    item: input.item,
    authorDid: input.authorDid,
  }
}

/**
 * Signiert die kanonischen Payload-Bytes als Compact-JWS — das WIRE-FORMAT
 * eines Mirrors (Spec 09 §Snapshot-Form). Es gibt keine unsignierten
 * Außenfelder: alles, was ein Empfänger liest, steht in dieser Payload.
 */
export async function signSnapshot(
  payload: MirrorSnapshotPayload,
  signer: MirrorSnapshotSigner,
): Promise<string> {
  const header = { alg: "EdDSA", kid: signer.kid, typ: MIRROR_SNAPSHOT_JWS_TYP }
  const jws = await createJcsEd25519JwsWithSigner(
    header,
    signedSnapshotFields(payload) as unknown as JsonValue,
    (bytes) => signer.signEd25519(bytes),
  )
  // Zusicherung, keine Höflichkeit: die JWS signiert „exakt diese Bytes".
  // Wichen die Kanonisierung des JWS-Containers und die hiesige je
  // voneinander ab, wäre der tiebreak nicht mehr der Hash der signierten
  // Bytes — und der Versionsvergleich stillschweigend implementierungsabhängig.
  const expected = base64Url(canonicalSnapshotBytes(payload))
  if (jws.split(".")[1] !== expected) {
    throw new Error("signSnapshot: JWS-Payload ist nicht die kanonische Serialisierung (RFC 8785)")
  }
  return jws
}

export type MirrorVerifyReason =
  | "malformed-jws"
  | "unexpected-jws-header"
  | "malformed-payload"
  | "non-canonical-payload"
  | "seq-out-of-range"
  | "foreign-map-key"
  | "foreign-target-space"
  | "item-id-mismatch"
  | "author-mismatch"
  | "profile-id-mismatch"
  | "profile-did-mismatch"
  | "invalid-profile-marker"
  | "unknown-signer"
  | "key-resolution-failed"
  | "bad-signature"
  | "hash-failed"

export type MirrorVerifyResult =
  | { ok: true; payload: MirrorSnapshotPayload; tiebreak: string }
  | { ok: false; reason: MirrorVerifyReason }

export interface VerifySnapshotOptions {
  /** Die Compact-JWS aus der `mirrors`-Map. */
  jws: string
  /** Der Schlüssel, UNTER DEM sie lag — er ist Teil der Prüfung, nicht Beiwerk. */
  mapKey: string
  /** Die ID des eigenen Space (Invariante 4). */
  ownSpaceId: string
  /** Auflösung `authorDid` → rohe Ed25519-Public-Key-Bytes; `null` = unauflösbar. */
  resolvePublicKey: (authorDid: string) => Uint8Array | null | Promise<Uint8Array | null>
  crypto: ProtocolCryptoAdapter
}

/**
 * Die vollständige Empfängerprüfung aus Spec 09 (Invariante 4, 5, 6, §Ablage)
 * plus dem Profil-Overlay aus Spec 12 Regel 8.
 *
 * Reihenfolge: erst Form, dann Schlüssel und Adressat, dann Item-Bindung, dann
 * Signatur. Die Signatur steht ABSICHTLICH am Ende — sie ist die teuerste
 * Prüfung, und keine der vorherigen wird durch sie ersetzt: eine gültige
 * Signatur macht einen Schnappschuss unter fremdem Map-Schlüssel nicht gültig.
 */
export async function verifySnapshot(options: VerifySnapshotOptions): Promise<MirrorVerifyResult> {
  let decoded: { header: unknown; payload: unknown }
  try {
    decoded = decodeJws(options.jws) as { header: unknown; payload: unknown }
  } catch {
    return { ok: false, reason: "malformed-jws" }
  }

  // `decodeJws` gibt zurück, was im Segment stand — auch JSON-`null` oder einen
  // Array. Der Header MUSS erst als Objekt feststehen, bevor auf ihm gelesen
  // wird; sonst wirft die Prüfung statt abzulehnen.
  if (!isRecord(decoded.header)) return { ok: false, reason: "malformed-jws" }
  const header = decoded.header
  if (header["alg"] !== "EdDSA" || header["typ"] !== MIRROR_SNAPSHOT_JWS_TYP || typeof header["kid"] !== "string") {
    return { ok: false, reason: "unexpected-jws-header" }
  }

  if (!isRecord(decoded.payload)) return { ok: false, reason: "malformed-payload" }
  const payload = asSnapshotPayload(decoded.payload)
  if (!payload) return { ok: false, reason: "malformed-payload" }

  // Der home-weite Lamport-Zähler muss weiter zählen können. Ab
  // `MAX_SAFE_INTEGER` liefert `nextSeq` denselben Wert wie die Marke, und die
  // Strikt-größer-Regel (Invariante 6) verwürfe ab da jeden neuen Stand.
  if (!isPublishableSeq(payload.version.seq)) return { ok: false, reason: "seq-out-of-range" }

  // Der Gegencheck zur Kanonisierung: das Payload-Segment MUSS byte-genau die
  // kanonische Serialisierung der sechs Felder sein. Ohne ihn könnte eine
  // Payload zusätzliche, mitsignierte Felder tragen, die eine spätere
  // Implementierung ausliest — der Schmuggelweg, den Invariante 6 schließt.
  //
  // Die Kanonisierung WIRFT bei Werten, die nicht I-JSON sind (isoliertes
  // Surrogat, `1e400` → Infinity). Genau das ist hier eine Ablehnung, keine
  // Ausnahme: `verifySnapshot` ist total, damit der Aufrufer jeden kaputten
  // Slot als ungültig behandeln und reparieren kann (09 §Ablage).
  let canonicalBytes: Uint8Array
  try {
    canonicalBytes = canonicalSnapshotBytes(payload)
  } catch {
    return { ok: false, reason: "non-canonical-payload" }
  }
  if (options.jws.split(".")[1] !== base64Url(canonicalBytes)) {
    return { ok: false, reason: "non-canonical-payload" }
  }

  // Spec 09 §Ablage: der Map-Schlüssel ist Teil der Aussage. Ein gültig
  // signierter Schnappschuss unter fremdem Schlüssel ist ein ungültiger Slot.
  if (options.mapKey !== mirrorMapKey(payload.homeSpaceId, payload.itemId)) {
    return { ok: false, reason: "foreign-map-key" }
  }
  // Invariante 4: die Freigabe ist adressatengebunden.
  if (payload.targetSpaceId !== options.ownSpaceId) return { ok: false, reason: "foreign-target-space" }

  if (payload.item) {
    if (payload.item.id !== payload.itemId) return { ok: false, reason: "item-id-mismatch" }
    if (payload.item.createdBy !== payload.authorDid) return { ok: false, reason: "author-mismatch" }
  }

  const profileReason = profileViolation(payload)
  if (profileReason) return { ok: false, reason: profileReason }

  // Die Schlüsselauflösung ist fremder Code (Discovery, Cache) und darf die
  // Prüfung nicht sprengen: synchrones Werfen wie Rejection → Ablehnung, kein
  // Slot-Zustand, den der Aufrufer nicht als „ungültig" behandeln könnte.
  let publicKey: Uint8Array | null
  try {
    publicKey = await options.resolvePublicKey(payload.authorDid)
  } catch {
    return { ok: false, reason: "key-resolution-failed" }
  }
  if (!publicKey) return { ok: false, reason: "unknown-signer" }
  try {
    await verifyJwsWithPublicKey(options.jws, { publicKey, crypto: options.crypto })
  } catch {
    return { ok: false, reason: "bad-signature" }
  }

  // Auch der Tiebreak-Hash ist Laufzeit-Crypto und darf die Prüfung nicht
  // sprengen: ohne Tiebreak ist die Version nicht vergleichbar, der Slot gilt
  // dann als (vorerst) ungültig und wird beim nächsten Abgleich erneut geprüft.
  try {
    return { ok: true, payload, tiebreak: await tiebreakOf(canonicalBytes) }
  } catch {
    return { ok: false, reason: "hash-failed" }
  }
}

/**
 * Der Profil-Marker eines Schnappschusses (Spec 12 Regel 3): die Unterscheidung
 * Profil/Platzhalter läuft AUSSCHLIESSLICH über das Vorhandensein von
 * `data.did` in einem `person`-Item.
 *
 * `absent` heißt Platzhalter (ein Mitglied hat das Item für eine dritte Person
 * angelegt). `invalid` heißt: der Schlüssel ist da, der Wert taugt nicht —
 * `null`, leer oder kein String. Das ist KEIN Platzhalter, sondern ein
 * kaputtes Profil; Regel 3 sagt ausdrücklich, dass das Schema einen
 * nicht-leeren String verlangt. Würde man es als Platzhalter durchwinken,
 * ließe sich die verschärfte Profilprüfung aus Regel 8 einfach abschalten.
 */
type ProfileMarker = { kind: "absent" } | { kind: "invalid" } | { kind: "did"; did: string }

function profileMarker(payload: MirrorSnapshotPayload): ProfileMarker {
  const item = payload.item
  if (!item || item.type !== "person" || !("did" in item.data)) return { kind: "absent" }
  const did = item.data["did"]
  if (typeof did !== "string" || did.length === 0) return { kind: "invalid" }
  return { kind: "did", did }
}

/**
 * Ein Profil ist ein `person`-Item MIT gültigem `data.did` (Spec 12 Regel 1
 * und 3): ein person-Item ohne `data.did` ist ein Platzhalter aus dem
 * Kontaktbuch und wird nie gespiegelt.
 */
export function isProfileSnapshot(payload: MirrorSnapshotPayload): boolean {
  return profileMarker(payload).kind === "did"
}

/**
 * Spec 12 Regel 8 (Empfängerprüfung, verschärft). Sie gilt „Live wie
 * Tombstone" — ein Tombstone trägt aber kein Item, an dem sich ein Profil
 * erkennen ließe.
 *
 * ENTSCHEIDUNG: erkannt wird der Profil-Schlüssel deshalb zusätzlich an der
 * DID-Form der `itemId`. Jede `itemId`, die mit `did:` beginnt, MUSS gleich
 * `authorDid` sein. Regel 8 will, dass ein Profil-Schlüssel NICHT BESETZBAR
 * ist: unter ihm soll ausschließlich die Inhaberin der DID signieren können.
 * Ohne die Regel könnte ein Fremder unter dem Profil-Schlüssel einer anderen
 * Person Schnappschüsse ablegen — sie würden zwar nie materialisiert und
 * sperren nach Invariante 6 auch nur die eigene Autoren-Marke, erzeugten dort
 * aber dauerhaft Marken und Herkunftskonflikte, die eine UI der Inhaberin
 * zuschreibt. Die Regel trifft nur Items, deren Id eine DID ist — Platzhalter
 * tragen zufällige Ids (Regel 3).
 */
function profileViolation(payload: MirrorSnapshotPayload): MirrorVerifyReason | null {
  const marker = profileMarker(payload)
  if (marker.kind === "invalid") return "invalid-profile-marker"
  const claimsDidKey = payload.itemId.startsWith("did:")
  if ((claimsDidKey || marker.kind === "did") && payload.itemId !== payload.authorDid) {
    return "profile-id-mismatch"
  }
  if (marker.kind === "did" && marker.did !== payload.authorDid) return "profile-did-mismatch"
  return null
}

/**
 * Ein publizierbarer Zählerstand: nichtnegative sichere Ganzzahl ECHT unter
 * `MAX_SAFE_INTEGER`. Die obere Grenze ist hart, weil `nextSeq` sonst
 * denselben Wert zurückgäbe und der Zähler still stehen bliebe.
 */
export function isPublishableSeq(seq: number): boolean {
  return Number.isSafeInteger(seq) && seq >= 0 && seq < Number.MAX_SAFE_INTEGER
}

function asSnapshotPayload(value: Record<string, unknown>): MirrorSnapshotPayload | null {
  const version = value["version"]
  if (
    typeof value["homeSpaceId"] !== "string" ||
    typeof value["itemId"] !== "string" ||
    typeof value["targetSpaceId"] !== "string" ||
    typeof value["authorDid"] !== "string" ||
    !isRecord(version) ||
    typeof version["seq"] !== "number" ||
    !Number.isInteger(version["seq"]) ||
    typeof version["deviceId"] !== "string" ||
    typeof version["ts"] !== "string"
  ) {
    return null
  }
  const item = value["item"]
  if (item !== null) {
    if (!isRecord(item)) return null
    if (
      typeof item["id"] !== "string" ||
      typeof item["type"] !== "string" ||
      typeof item["createdAt"] !== "string" ||
      typeof item["createdBy"] !== "string" ||
      !isRecord(item["data"])
    ) {
      return null
    }
  }
  return {
    homeSpaceId: value["homeSpaceId"],
    itemId: value["itemId"],
    targetSpaceId: value["targetSpaceId"],
    version: { seq: version["seq"], deviceId: version["deviceId"], ts: version["ts"] },
    item: (item as SerializedItem | null) ?? null,
    authorDid: value["authorDid"],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function base64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
