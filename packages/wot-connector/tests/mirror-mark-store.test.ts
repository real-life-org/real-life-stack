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

  // #349 / Spec 09 Invariante 8: die Marke ist eine Maximum-Operation über die
  // volle Ordnung. Ein verspäteter Write einer älteren Position senkt sie nie.
  it("senkt die High-Water-Mark nie: verspäteter Write 6 → 5 bleibt bei 6", async () => {
    const store = new InMemoryMirrorMarkStore()
    expect(await store.putMark(mark(AUTHOR, 6))).toBe("raised")
    expect(await store.putMark(mark(AUTHOR, 5))).toBe("kept")
    expect((await store.getMark(HOME, "task-1", AUTHOR))?.seq).toBe(6)
  })

  it("hält die Marke auch bei gleicher seq mit kleinerem deviceId oder tiebreak", async () => {
    const store = new InMemoryMirrorMarkStore()
    await store.putMark({ ...mark(AUTHOR, 6), deviceId: "dev-b", tiebreak: "cc" })
    expect(await store.putMark({ ...mark(AUTHOR, 6), deviceId: "dev-a", tiebreak: "ff" })).toBe("kept")
    expect(await store.putMark({ ...mark(AUTHOR, 6), deviceId: "dev-b", tiebreak: "bb" })).toBe("kept")
    expect(await store.putMark({ ...mark(AUTHOR, 6), deviceId: "dev-b", tiebreak: "cc" })).toBe("kept")
    expect(await store.getMark(HOME, "task-1", AUTHOR)).toEqual({ ...mark(AUTHOR, 6), deviceId: "dev-b", tiebreak: "cc" })
  })

  it("hebt die Marke bei gleicher seq mit größerem deviceId oder tiebreak an", async () => {
    const store = new InMemoryMirrorMarkStore()
    await store.putMark({ ...mark(AUTHOR, 6), deviceId: "dev-a", tiebreak: "aa" })
    expect(await store.putMark({ ...mark(AUTHOR, 6), deviceId: "dev-a", tiebreak: "ab" })).toBe("raised")
    expect(await store.putMark({ ...mark(AUTHOR, 6), deviceId: "dev-b", tiebreak: "00" })).toBe("raised")
    expect((await store.getMark(HOME, "task-1", AUTHOR))?.deviceId).toBe("dev-b")
  })

  // #350: gelesene Objekte sind Kopien — Mutation umgeht weder Maximum noch Erstbindung.
  it("liefert Kopien: Mutation einer gelesenen Marke senkt den Stand nicht", async () => {
    const store = new InMemoryMirrorMarkStore()
    await store.putMark(mark(AUTHOR, 6))
    const read = await store.getMark(HOME, "task-1", AUTHOR)
    read!.seq = 1
    expect((await store.getMark(HOME, "task-1", AUTHOR))?.seq).toBe(6)
    const listed = await store.listMarks(HOME, "task-1")
    listed[0]!.seq = 1
    expect((await store.getMark(HOME, "task-1", AUTHOR))?.seq).toBe(6)
  })

  it("liefert Kopien: Mutation einer gelesenen Bindung bindet nicht um", async () => {
    const store = new InMemoryMirrorMarkStore()
    await store.putBinding({ homeSpaceId: HOME, itemId: "task-1", boundAuthorDid: AUTHOR })
    const read = await store.getBinding(HOME, "task-1")
    read!.boundAuthorDid = FOREIGN
    expect((await store.getBinding(HOME, "task-1"))?.boundAuthorDid).toBe(AUTHOR)
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
