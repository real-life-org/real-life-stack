import type { MirrorBinding, MirrorHighWaterMark, MirrorMarkStore } from "../types.js"

import { mirrorMapKey } from "./keys.js"
import { compareVersion } from "./version.js"

/**
 * Prozesslokale Implementierung des {@link MirrorMarkStore} für Tests und
 * reine Logik. Alle Lesepfade liefern Kopien (#350): der gespeicherte Stand
 * ist nur über putMark/putBinding veränderbar, nie über ein gelesenes Objekt.
 * Die dauerhafte IndexedDB-Variante kommt in S5 — nur sie erfüllt Spec 09
 * Invariante 8 wirklich, denn die Resurrection-Garantie hängt daran, dass
 * Marken einen Neustart überleben.
 */
export class InMemoryMirrorMarkStore implements MirrorMarkStore {
  private readonly marks = new Map<string, MirrorHighWaterMark>()
  private readonly bindings = new Map<string, MirrorBinding>()

  async getMark(
    homeSpaceId: string,
    itemId: string,
    authorDid: string,
  ): Promise<MirrorHighWaterMark | null> {
    const mark = this.marks.get(markKey(homeSpaceId, itemId, authorDid))
    return mark ? { ...mark } : null
  }

  /**
   * Maximum in der vollen Ordnung, synchron je Marke: zwei Auswertungen, die
   * denselben alten Stand gelesen und Live seq=5 wie Tombstone seq=6 akzeptiert
   * haben, dürfen die Marke in der Reihenfolge 6, 5 schreiben — gespeichert
   * bleibt 6 (#349).
   */
  async putMark(mark: MirrorHighWaterMark): Promise<"raised" | "kept"> {
    const key = markKey(mark.homeSpaceId, mark.itemId, mark.authorDid)
    const current = this.marks.get(key)
    if (current && compareVersion(mark, current) <= 0) return "kept"
    this.marks.set(key, { ...mark })
    return "raised"
  }

  async listMarks(homeSpaceId: string, itemId: string): Promise<MirrorHighWaterMark[]> {
    return [...this.marks.values()]
      .filter((mark) => mark.homeSpaceId === homeSpaceId && mark.itemId === itemId)
      .map((mark) => ({ ...mark }))
  }

  async getBinding(homeSpaceId: string, itemId: string): Promise<MirrorBinding | null> {
    const binding = this.bindings.get(mirrorMapKey(homeSpaceId, itemId))
    return binding ? { ...binding } : null
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
