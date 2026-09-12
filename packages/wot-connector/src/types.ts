import type { ActivityEntry, Relation } from "@real-life-stack/data-interface"
import type {
  DocLogStore,
  KeyManagementPort,
  MemberUpdatePendingStore,
  MessageIdHistoryPort,
  MessagingAdapter,
  OutboxStore,
} from "@real-life/wot-core/ports"
import type { SpaceAdmission } from "@real-life/wot-core/types"
import type { YjsCompactStore } from "@real-life/adapter-yjs"
import type { YjsReplicationAdapter } from "@real-life/adapter-yjs"
import type { WorkQueue } from "./work-queue-store.js"

/** Every DID-scoped IndexedDB store must close its real connection on teardown. */
export interface ClosableIdentityStore {
  close(): void | Promise<void>
}

export type ClosableOutboxStore = OutboxStore & ClosableIdentityStore
export type ClosableYjsCompactStore = YjsCompactStore & ClosableIdentityStore

// --- WoT Connector Configuration ---

export interface WotConnectorConfig {
  relayUrl: string
  profilesUrl: string
}

/** Test/runtime seams for the protocol transport and durable stores. */
export interface WotConnectorRuntimeOverrides {
  /** Raw transport. Production creates a Sync-003 WebSocket adapter. */
  messaging?: MessagingAdapter
  /** Device-local generic outbox. Production creates an IndexedDB store. */
  outboxStore?: ClosableOutboxStore
  /** Device-local key-discovery and app-receipt work queue. */
  workQueue?: WorkQueue
  /** Shared Personal-Doc/Space log store and deviceId owner. */
  docLogStore?: DocLogStore
  keyManagement?: KeyManagementPort
  memberUpdateStore?: MemberUpdatePendingStore
  messageIdHistory?: MessageIdHistoryPort
  compactStore?: ClosableYjsCompactStore
  /** Test/runtime replacement for space replication (for example an in-memory CRDT peer). */
  replication?: YjsReplicationAdapter
  /** Tests can disable trace decoration without changing transport semantics. */
  traceMessaging?: boolean
}

export interface WotSyncState {
  logPending: number
  outboxPending: number
  workPending?: number
}

// --- Automerge SpaceDoc Schema ---

export interface RlsSpaceDoc {
  /** App type for cross-app space isolation */
  _type: "rls"
  /** RLS Items keyed by ID */
  items: Record<string, SerializedItem>
  /** Additive, encrypted space-local best-effort change history. */
  activity?: Record<string, ActivityEntry>
  /** Space metadata (app-specific, name/description now in _meta) */
  metadata?: {
    /** @deprecated Use _meta.name (set via updateSpace) */
    name?: string
    description?: string
    modules?: string[]
  }
  /**
   * ZIEL-Space-Seite von Spec 09 §Ablage: die empfangenen Mirror-Schnappschüsse.
   * Schlüssel `JSON.stringify([homeSpaceId, itemId])`, Wert die Compact-JWS.
   *
   * Bewusst NICHT in `items`: der `CrossGroupIndex` schlüsselt nach
   * `(groupId, itemId)` und kennt keinen Tripel-Schlüssel (Invariante 1) —
   * ein Mirror unter `items` würde mit dem lokalen Item kollabieren.
   * Je Schlüssel genau ein Schnappschuss (CRDT-Register, darf deshalb auch
   * eine niedrigere Version tragen als die höchste je akzeptierte).
   */
  mirrors?: Record<string, string>
  /**
   * HOME-Seite von Spec 09 §Ablage und Registry: die Freigaben dieses Space
   * als Home. Schlüssel `JSON.stringify([itemId, targetSpaceId, deviceId])`,
   * Wert der Beitrag GENAU DIESES Geräts.
   *
   * Physisch flach je Gerät, gelesen wird als `byDevice` je Eintrag
   * `(itemId, targetSpaceId)` — die Umgruppierung macht `groupRegistryByEntry`,
   * die Faltung `deriveRegistryView`. Der Grund für die flache Form ist der
   * Merge: eine gemeinsame Eltern-Map, die zwei Geräte nebenläufig anlegen,
   * ist ein Register — eine gewinnt, die andere geht samt Beitrag verloren, und
   * ein so verlorener Widerruf kippt den Status zurück auf `accepted`. Mit dem
   * Gerät im Schlüssel legt jedes Gerät nur seinen eigenen Schlüssel an.
   *
   * Keine Migration: vor diesem Schnitt hat nichts in dieses Feld geschrieben
   * (S0 bis S2 waren reine Funktionen und Typen), es gibt also keinen Bestand
   * in der alten, geschachtelten Form.
   *
   * Steht im selben Doc-Typ, weil ein Home ein gewöhnlicher Space ist —
   * der persönliche Space eines Profils (Spec 12) genauso wie ein
   * Gruppen-Space, der Items in andere Spaces freigibt.
   */
  mirrorRegistry?: Record<string, MirrorRegistryContribution>
  /**
   * Spec 12 Regel 5 (Übergangsregel): ist die Marke gesetzt, hat ein Gerät
   * der Person die Bestands-Mitgliedschaften einmalig pauschal freigegeben.
   * Sie verhindert, dass die Regel auf einem anderen Gerät erneut läuft —
   * dort liefe sie sonst über Mitgliedschaften, die inzwischen widerrufen
   * wurden, und stellte sie wieder her.
   */
  profileMigration?: { bestandAt?: string }
}

/**
 * Ein Registry-Eintrag `(itemId, targetSpaceId)` im LESEMODELL: die Beiträge
 * ALLER Geräte des Autors (Spec 09 §Ablage und Registry). Er steht so nicht im
 * Doc — dort liegt je Gerät ein eigener flacher Schlüssel — sondern entsteht
 * beim Lesen (`groupRegistryByEntry`). Die eine Lesesicht entsteht daraus
 * deterministisch (`deriveRegistryView`). Beiträge werden NIE gelöscht.
 */
export interface MirrorRegistryEntry {
  byDevice: Record<string, MirrorRegistryContribution>
}

/**
 * Der Beitrag EINES Geräts zu einer Freigabe. `deviceId` steht nicht im Wert,
 * sondern im physischen Schlüssel (`mirrorRegistryKey`) und damit auch im
 * Lesemodell {@link MirrorRegistryEntry.byDevice}.
 */
export interface MirrorRegistryContribution {
  /**
   * Lamport-Zähler der Statuswechsel (`1 + max(beobachtet)`). Trägt die
   * Widerrufs-Kausalität zusammen mit {@link supersedes} — NICHT die Ordnung
   * der Publikationen, die läuft über `seq`.
   */
  statusSeq: number
  /**
   * `pending` ist der Zwischenstatus aus Spec 12 Regel 4 (Annahme einer
   * Einladung); er publiziert NIE. Spec 09 allein kennt nur
   * `accepted | revoked`.
   */
  status: "pending" | "accepted" | "revoked"
  /**
   * Aufnahme-Kennung des Autors im Ziel-Space zum Zeitpunkt dieses
   * Statuswechsels. `undefined` heißt „keine gültige Aufnahme" (Alt-Space ohne
   * Ereignisse oder eigenes Gewinner-Ereignis `removed`) und liegt unter jeder
   * Kennung. Wird NUR beim Schreiben eines Statuswechsels gesetzt, nie still
   * nachgeführt.
   */
  admission?: SpaceAdmission
  /**
   * Die `(deviceId → statusSeq)` aller nicht-`accepted` Beiträge, die dieser
   * Beitrag beim Schreiben beobachtet hat. Nur damit löst eine Freigabe einen
   * Widerruf ab; ein Widerruf, den keine Freigabe gesehen hat, gewinnt immer —
   * auch gegen eine nebenläufige Freigabe mit höherem `statusSeq`.
   */
  supersedes?: Record<string, number>
  /** Home-weiter Publikations-Zähler pro Item (`1 + max(seq aller Einträge dieses itemId)`). */
  seq: number
  /** `sha256` über die kanonischen Payload-Bytes der letzten Publikation dieses Geräts. */
  tiebreak: string
  /**
   * `sha256` über das kanonische Item der letzten Publikation — der Vergleich,
   * an dem der Abgleich erkennt, ob neu publiziert werden muss. Leer bzw.
   * fehlend, wenn die letzte Publikation ein Tombstone war.
   */
  publishedHash?: string
  /** Reine Anzeigezeit (ISO). Nicht Teil einer Ordnung. */
  updatedAt: string
}

/**
 * Die Ordnungsposition eines Schnappschusses: `(seq, deviceId, tiebreak)`
 * lexikographisch (Spec 09 Invariante 6). `tiebreak` ist NICHT Teil von
 * `version` auf dem Draht — er wird aus den kanonischen Payload-Bytes
 * berechnet und MUSS mitpersistiert werden, sonst ist der Vergleich bei
 * gleicher `(seq, deviceId)` nicht entscheidbar.
 */
export interface MirrorOrderPosition {
  seq: number
  deviceId: string
  tiebreak: string
}

/** `version` aus der signierten Payload. `ts` ist reine Anzeigezeit. */
export interface MirrorSnapshotVersion {
  seq: number
  deviceId: string
  ts: string
}

/**
 * Die PAYLOAD der Compact-JWS (Spec 09 §Snapshot-Form). Das Wire-Format ist die
 * JWS selbst — dieser Typ trägt deshalb bewusst KEIN signature-Feld, und
 * Empfänger MÜSSEN jeden Feldwert aus der verifizierten Payload lesen, nie aus
 * einer unsignierten äußeren Kopie.
 */
export interface MirrorSnapshotPayload {
  homeSpaceId: string
  itemId: string
  /** der EINE Ziel-Space dieser Freigabe (Invariante 4) */
  targetSpaceId: string
  version: MirrorSnapshotVersion
  /** `null` = Tombstone (Item im Home gelöscht) */
  item: SerializedItem | null
  /** MUSS bei `item !== null` gleich `item.createdBy` sein (Invariante 5) */
  authorDid: string
}

/**
 * Empfänger-Marke nach Spec 09 Invariante 6 und 8: die höchste je akzeptierte
 * Ordnungsposition pro `(homeSpaceId, itemId, authorDid)`, über Live- UND
 * Tombstone-Schnappschüsse.
 *
 * Lokal und DAUERHAFT — nie im Doc: der Slot im Ziel-Space ist ein
 * CRDT-Register und kann zurückfallen; die Resurrection-Garantie hängt allein
 * an dieser Marke. Eine Marke OHNE zugehörige {@link MirrorBinding} ist die
 * „ungebundene Tombstone-Marke" aus Invariante 5: ein Tombstone zu einem
 * unbekannten Schlüssel wird nicht verworfen, bindet aber auch nicht — er
 * sperrt nur ältere Live-Schnappschüsse desselben Autors aus.
 */
export interface MirrorHighWaterMark {
  homeSpaceId: string
  itemId: string
  authorDid: string
  seq: number
  deviceId: string
  tiebreak: string
}

/**
 * Die Erst-Annahme bindet `(homeSpaceId, itemId)` an eine Signer-DID
 * (Spec 09 Invariante 5, Home-Origin-TOFU). Nur ein Live-Schnappschuss bindet —
 * dort ist `authorDid` gegen `item.createdBy` prüfbar; ein Tombstone NIE, sonst
 * könnte ein gefälschter Erst-Tombstone den echten Autor aussperren.
 */
export interface MirrorBinding {
  homeSpaceId: string
  itemId: string
  boundAuthorDid: string
}

/**
 * Port für die dauerhaften Empfänger-Marken (Spec 09 Invariante 8: Receipts und
 * High-Water-Marken sind DERSELBE Bestand). Die IndexedDB-Implementierung
 * kommt in S5; für Tests und reine Logik genügt `InMemoryMirrorMarkStore`.
 *
 * Bewusst asynchron, weil die echte Implementierung IndexedDB ist.
 */
/**
 * Port für Marken und Bindung (Spec 09 Invariante 6/8). Lesepfade MÜSSEN
 * Kopien liefern: der gespeicherte Stand ist ausschließlich über `putMark`
 * (Maximum) und `putBinding` (Erstbindung) veränderbar (#350).
 */
export interface MirrorMarkStore {
  /** Die Marke des GENANNTEN Autors — Marken fremder DIDs sind eigene Marken. */
  getMark(
    homeSpaceId: string,
    itemId: string,
    authorDid: string,
  ): Promise<MirrorHighWaterMark | null>
  /**
   * Monotone Maximum-Operation (Spec 09 Invariante 6/8): die gespeicherte
   * Marke wird nur ersetzt, wenn die neue in der vollen Ordnung
   * `(seq, deviceId, tiebreak)` STRIKT größer ist. Ein verspäteter Write
   * einer älteren Position darf die Marke nie senken — sonst ließe sich ein
   * bereits abgewiesener Replay danach wieder einspielen. Atomar je Marke.
   * Liefert `raised`, wenn die Marke angehoben wurde, sonst `kept`.
   */
  putMark(mark: MirrorHighWaterMark): Promise<"raised" | "kept">
  /** Alle Marken eines logischen Schlüssels, auch die ungebundenen. */
  listMarks(homeSpaceId: string, itemId: string): Promise<MirrorHighWaterMark[]>
  getBinding(homeSpaceId: string, itemId: string): Promise<MirrorBinding | null>
  /** Bindet erstmalig. Eine bestehende Bindung wird NIE überschrieben (kein Umbinden). */
  putBinding(binding: MirrorBinding): Promise<void>
}

export interface SerializedItem {
  id: string
  type: string
  createdAt: string // ISO string (Automerge can't store Date)
  createdBy: string // DID
  updatedAt?: string // ISO string, gesetzt beim Bearbeiten
  updatedBy?: string // DID des Bearbeiters (kann != createdBy sein)
  "@context"?: string[]
  schema?: string
  schemaVersion?: number
  data: Record<string, unknown>
  relations?: Relation[]
  tags?: string[]
}
