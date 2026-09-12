/**
 * Die reine Hälfte von Spec 09 (Mirror und Bridge) und ihrer ersten Anwendung
 * Spec 12 (Profile): Ordnung, Kanonisierung, Registry-Faltung, Abgleichsplan,
 * Signieren/Prüfen und die Empfänger-Entscheidung.
 *
 * Kein I/O, kein Connector, keine UI — die Verdrahtung kommt in späteren
 * Scheiben. So sind die Invarianten einzeln testbar, statt nur im
 * Zusammenspiel eines Connectors beobachtbar zu sein.
 */
export { canonicalItemString, canonicalSnapshotBytes, canonicalSnapshotString, itemHash, signedSnapshotFields } from "./canonical.js"
export { mirrorMapKey, mirrorRegistryKey, parseMirrorMapKey, parseMirrorRegistryKey } from "./keys.js"
export { InMemoryMirrorMarkStore } from "./mark-store-memory.js"
export { evaluateSnapshot } from "./receiver.js"
export type { EvaluateSnapshotInput, MirrorEvaluation } from "./receiver.js"
export { planReconcile } from "./reconcile.js"
export type {
  MirrorReconcileAction,
  MirrorReconcileEntry,
  MirrorReconcileInput,
  MirrorReconcilePlanEntry,
  MirrorSlotState,
} from "./reconcile.js"
export { compareAdmissionOrUndefined, deriveRegistryView, nextSeq, nextStatusSeq } from "./registry-view.js"
export type { MirrorRegistryView } from "./registry-view.js"
export {
  MIRROR_SNAPSHOT_JWS_TYP,
  buildSnapshotPayload,
  isProfileSnapshot,
  isPublishableSeq,
  isTransientVerifyReason,
  TRANSIENT_VERIFY_REASONS,
  signSnapshot,
  verifySnapshot,
} from "./snapshot.js"
export type {
  BuildSnapshotInput,
  MirrorSnapshotSigner,
  MirrorVerifyReason,
  MirrorVerifyResult,
  VerifySnapshotOptions,
} from "./snapshot.js"
export { compareVersion, tiebreakOf } from "./version.js"
export {
  maxAdmission,
  mergeProfileData,
  planMembershipTransition,
  planStockGrants,
  profileItemInput,
  supersedesOf,
} from "./profile-home.js"
export { normalizeProfileFields } from "./profile-home.js"
export type { MembershipTransition, ProfileItemFields } from "./profile-home.js"
