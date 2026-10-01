import {
  OutboxMessagingAdapter,
  TracedOutboxMessagingAdapter,
} from "@real-life/wot-core/adapters"
import type {
  DocLogStore,
  MessagingAdapter,
  OutboxStore,
} from "@real-life/wot-core/ports"

export type OutboxMessagingRuntime = MessagingAdapter & {
  flushOutbox(): Promise<void>
  getOutboxStore(): OutboxStore
}

/** Shared production/test factory for the connector's generic outbox wrapper. */
export function createOutboxMessagingRuntime(options: {
  messaging: MessagingAdapter
  outboxStore: OutboxStore
  trace?: boolean
}): OutboxMessagingRuntime {
  // Log-sync has its own durable retry authority and is NEVER queued by core;
  // everything else (the encrypted inbox family) is queued. The Old-World
  // skipTypes are gone with the Old-World channel (wot#386).
  const outbox = new OutboxMessagingAdapter(options.messaging, options.outboxStore)
  if (options.trace === false) return outbox
  return new TracedOutboxMessagingAdapter(outbox) as OutboxMessagingRuntime
}

/**
 * Emit after operations that can change DocLogStore.getPending(). This keeps
 * connector observability event-driven without reaching into core internals.
 */
export function observeDocLogPending(
  store: DocLogStore,
  onChange: () => void | Promise<void>,
): DocLogStore {
  const pendingMutations = new Set<PropertyKey>(["appendLocalEntry", "markAcked", "clear"])
  const wrapped = new Map<PropertyKey, (...args: unknown[]) => unknown>()

  return new Proxy(store as DocLogStore & object, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      if (typeof value !== "function") return value
      const existing = wrapped.get(property)
      if (existing) return existing
      const bound = value.bind(target) as (...args: unknown[]) => unknown
      const fn = pendingMutations.has(property)
        ? async (...args: unknown[]) => {
            try {
              return await bound(...args)
            } finally {
              await onChange()
            }
          }
        : bound
      wrapped.set(property, fn)
      return fn
    },
  }) as DocLogStore
}
