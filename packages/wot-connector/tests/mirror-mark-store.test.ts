import { describe, expect, it } from "vitest"

import { InMemoryMirrorMarkStore } from "../src/mirror/mark-store-memory.js"

const HOME = "home-space"
const AUTHOR = "did:key:zAuthor"
const FOREIGN = "did:key:zFremd"

const mark = (authorDid: string, seq: number) => ({
  homeSpaceId: HOME,
  itemId: "task-1",
  authorDid,
  seq,
  deviceId: "dev-a",
  tiebreak: "aa",
})

/** Spec 09 Invariante 8: Marken und Bindung sind DERSELBE dauerhafte Bestand. */
describe("InMemoryMirrorMarkStore", () => {
  it("führt Marken je (homeSpaceId, itemId, authorDid) getrennt", async () => {
    const store = new InMemoryMirrorMarkStore()
    await store.putMark(mark(AUTHOR, 4))
    await store.putMark(mark(FOREIGN, 9))
    expect(await store.getMark(HOME, "task-1", AUTHOR)).toEqual(mark(AUTHOR, 4))
    expect(await store.getMark(HOME, "task-1", FOREIGN)).toEqual(mark(FOREIGN, 9))
    expect(await store.getMark(HOME, "task-2", AUTHOR)).toBeNull()
  })

  it("listet alle Marken eines logischen Schlüssels, auch die ungebundenen", async () => {
    const store = new InMemoryMirrorMarkStore()
    await store.putMark(mark(AUTHOR, 4))
    await store.putMark(mark(FOREIGN, 9))
    const marks = await store.listMarks(HOME, "task-1")
    expect(marks.map((m) => m.authorDid).sort()).toEqual([AUTHOR, FOREIGN].sort())
  })

  it("bindet genau einmal und bindet nie um", async () => {
    const store = new InMemoryMirrorMarkStore()
    await store.putBinding({ homeSpaceId: HOME, itemId: "task-1", boundAuthorDid: AUTHOR })
    await store.putBinding({ homeSpaceId: HOME, itemId: "task-1", boundAuthorDid: FOREIGN })
    expect(await store.getBinding(HOME, "task-1")).toEqual({
      homeSpaceId: HOME,
      itemId: "task-1",
      boundAuthorDid: AUTHOR,
    })
  })

  it("liefert null für unbekannte Schlüssel", async () => {
    const store = new InMemoryMirrorMarkStore()
    expect(await store.getBinding(HOME, "task-1")).toBeNull()
  })
})
