import { EventEmitter } from "node:events"

export type PubSubEvent =
  | { topic: "ITEMS_CHANGED"; filter?: { type?: string } }
  | { topic: "ITEM_CHANGED"; itemId: string }
  | { topic: "AUTH_STATE_CHANGED" }

const emitter = new EventEmitter()
emitter.setMaxListeners(100)

export function publish(event: PubSubEvent): void {
  emitter.emit(event.topic, event)
}

export async function* subscribe<T extends PubSubEvent["topic"]>(
  topic: T,
): AsyncGenerator<Extract<PubSubEvent, { topic: T }>> {
  const queue: Extract<PubSubEvent, { topic: T }>[] = []
  let resolve: (() => void) | null = null

  const handler = (event: Extract<PubSubEvent, { topic: T }>) => {
    queue.push(event)
    if (resolve) {
      resolve()
      resolve = null
    }
  }

  emitter.on(topic, handler)

  try {
    while (true) {
      if (queue.length === 0) {
        await new Promise<void>((r) => {
          resolve = r
        })
      }
      while (queue.length > 0) {
        yield queue.shift()!
      }
    }
  } finally {
    emitter.off(topic, handler)
  }
}
