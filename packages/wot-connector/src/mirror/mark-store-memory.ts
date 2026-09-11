import type { MirrorBinding, MirrorHighWaterMark, MirrorMarkStore } from "../types.js"

import { mirrorMapKey } from "./keys.js"

/**
 * Prozesslokale Implementierung des {@link MirrorMarkStore} für Tests und
 * reine Logik. Die dauerhafte IndexedDB-Variante kommt in S5 — nur sie erfüllt
 * Spec 09 Invariante 8 wirklich, denn die Resurrection-Garantie hängt daran,
 * dass Marken einen Neustart überleben.
 */
export class InMemoryMirrorMarkStore implements MirrorMarkStore {
  private readonly marks = new Map<string, MirrorHighWaterMark>()
  private readonly bindings = new Map<string, MirrorBinding>()

  async getMark(
    homeSpaceId: string,
    itemId: string,
    authorDid: string,
  ): Promise<MirrorHighWaterMark | null> {
    return this.marks.get(markKey(homeSpaceId, itemId, authorDid)) ?? null
  }

  async putMark(mark: MirrorHighWaterMark): Promise<void> {
    this.marks.set(markKey(mark.homeSpaceId, mark.itemId, mark.authorDid), { ...mark })
  }

  async listMarks(homeSpaceId: string, itemId: string): Promise<MirrorHighWaterMark[]> {
    return [...this.marks.values()].filter(
      (mark) => mark.homeSpaceId === homeSpaceId && mark.itemId === itemId,
    )
  }

  async getBinding(homeSpaceId: string, itemId: string): Promise<MirrorBinding | null> {
    return this.bindings.get(mirrorMapKey(homeSpaceId, itemId)) ?? null
  }

  /** Bindet nur, solange keine Bindung steht — Umbinden gibt es nicht (Invariante 5). */
  async putBinding(binding: MirrorBinding): Promise<void> {
    const key = mirrorMapKey(binding.homeSpaceId, binding.itemId)
    if (this.bindings.has(key)) return
    this.bindings.set(key, { ...binding })
  }
}

function markKey(homeSpaceId: string, itemId: string, authorDid: string): string {
  return JSON.stringify([homeSpaceId, itemId, authorDid])
}
