export { WotConnector } from "./wot-connector.js"
export type {
  WotConnectorConfig,
  WotConnectorRuntimeOverrides,
  WotSyncState,
  RlsSpaceDoc,
  SerializedItem,
  MirrorBinding,
  MirrorHighWaterMark,
  MirrorMarkStore,
  MirrorOrderPosition,
  MirrorRegistryContribution,
  MirrorRegistryEntry,
  MirrorSnapshotPayload,
  MirrorSnapshotVersion,
} from "./types.js"
// Spec 09 (Mirror und Bridge) + Spec 12 (Profile) — reine Logik, noch ohne Connector-Verdrahtung.
export * from "./mirror/index.js"
export { LocalOutboxStore } from "./local-outbox-store.js"
export { WorkQueueStore } from "./work-queue-store.js"
export type {
  WorkQueue,
  WorkQueueEntry,
  WorkQueueItem,
  WorkQueueKind,
  WorkQueueStoreOptions,
} from "./work-queue-store.js"
export { createOutboxMessagingRuntime } from "./messaging-runtime.js"
export type { OutboxMessagingRuntime } from "./messaging-runtime.js"
export { serializeItem, deserializeItem } from "./serialization.js"
export { CrossGroupIndex, crossGroupItemKey } from "./CrossGroupIndex.js"
export type { CrossGroupEntry, CrossGroupIndexOptions } from "./CrossGroupIndex.js"
export { BiometricService } from "./biometric-service.js"
