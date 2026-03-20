import { describe, it, expect, vi, beforeEach } from "vitest"
import { CrossSpaceIndex } from "../src/CrossSpaceIndex.js"
import type { CrossSpaceEntry } from "../src/CrossSpaceIndex.js"

// --- Mock types ---

interface TestDoc {
  items: Record<string, TestItem>
}

interface TestItem {
  id: string
  type: string
  title: string
}

// --- Mock SpaceHandle ---

function createMockHandle(spaceId: string, doc: TestDoc) {
  const remoteCallbacks = new Set<() => void>()
  return {
    id: spaceId,
    doc,
    info: () => ({
      id: spaceId,
      type: "shared" as const,
      members: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
    getDoc: () => doc,
    getMeta: () => ({}),
    transact: (fn: (doc: TestDoc) => void) => fn(doc),
    onRemoteUpdate: (cb: () => void) => {
      remoteCallbacks.add(cb)
      return () => remoteCallbacks.delete(cb)
    },
    close: vi.fn(),
    // Test helpers
    simulateRemoteUpdate: () => {
      for (const cb of remoteCallbacks) cb()
    },
    remoteCallbacks,
  }
}

// --- Mock ReplicationAdapter ---

function createMockReplication() {
  let spaces: Array<{ id: string; type: "shared" | "personal" }> = []
  let spacesCallback: ((spaces: typeof spaces) => void) | null = null
  const handles = new Map<string, ReturnType<typeof createMockHandle>>()

  return {
    handles,
    setSpaces(newSpaces: typeof spaces) {
      spaces = newSpaces
      spacesCallback?.(spaces)
    },
    registerHandle(spaceId: string, handle: ReturnType<typeof createMockHandle>) {
      handles.set(spaceId, handle)
    },
    // ReplicationAdapter interface (partial)
    watchSpaces: () => ({
      getValue: () => spaces,
      subscribe: (cb: (value: typeof spaces) => void) => {
        spacesCallback = cb
        return () => { spacesCallback = null }
      },
    }),
    openSpace: vi.fn(async (spaceId: string) => {
      const handle = handles.get(spaceId)
      if (!handle) throw new Error(`No handle for ${spaceId}`)
      return handle
    }),
  }
}

// --- Helpers ---

function extractItems(doc: TestDoc): Map<string, TestItem> {
  const map = new Map<string, TestItem>()
  for (const [id, item] of Object.entries(doc.items)) {
    map.set(id, item)
  }
  return map
}

function getItemType(item: TestItem): string {
  return item.type
}

// --- Tests ---

describe("CrossSpaceIndex", () => {
  let replication: ReturnType<typeof createMockReplication>

  beforeEach(() => {
    replication = createMockReplication()
  })

  function createIndex(options?: { spaceFilter?: (info: { type: string }) => boolean }) {
    return new CrossSpaceIndex<TestDoc, TestItem>(
      replication as any,
      extractItems,
      getItemType,
      options,
    )
  }

  describe("start/stop", () => {
    it("subscribes to watchSpaces on start", () => {
      const handle = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      index.start()

      // Should have opened the space and indexed items
      expect(replication.openSpace).toHaveBeenCalledWith("space-1")

      index.stop()
    })

    it("cleans up on stop", async () => {
      const handle = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      index.start()

      // Wait for async addSpace
      await vi.waitFor(() => expect(index.getAll().size).toBe(1))

      index.stop()

      expect(handle.close).toHaveBeenCalled()
      expect(index.getAll().size).toBe(0)
    })

    it("is idempotent", () => {
      const index = createIndex()
      index.start()
      index.start() // should not throw
      index.stop()
      index.stop() // should not throw
    })
  })

  describe("indexing", () => {
    it("indexes items from a single space", async () => {
      const handle = createMockHandle("space-1", {
        items: {
          "t1": { id: "t1", type: "task", title: "Task 1" },
          "t2": { id: "t2", type: "event", title: "Event 1" },
        },
      })
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(2))

      const all = index.getAll()
      expect(all.get("t1")?.item.title).toBe("Task 1")
      expect(all.get("t1")?.spaceId).toBe("space-1")
      expect(all.get("t2")?.item.type).toBe("event")

      index.stop()
    })

    it("indexes items from multiple spaces", async () => {
      const handle1 = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      const handle2 = createMockHandle("space-2", {
        items: { "t2": { id: "t2", type: "task", title: "Task 2" } },
      })
      replication.registerHandle("space-1", handle1)
      replication.registerHandle("space-2", handle2)
      replication.setSpaces([
        { id: "space-1", type: "shared" },
        { id: "space-2", type: "shared" },
      ])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(2))

      expect(index.getItemSpaceId("t1")).toBe("space-1")
      expect(index.getItemSpaceId("t2")).toBe("space-2")

      index.stop()
    })

    it("reindexes on remote update", async () => {
      const doc: TestDoc = {
        items: { "t1": { id: "t1", type: "task", title: "Original" } },
      }
      const handle = createMockHandle("space-1", doc)
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(1))

      // Simulate remote change
      doc.items["t1"].title = "Updated"
      doc.items["t3"] = { id: "t3", type: "note", title: "New" }
      handle.simulateRemoteUpdate()

      expect(index.getAll().size).toBe(2)
      expect(index.getAll().get("t1")?.item.title).toBe("Updated")
      expect(index.getAll().get("t3")?.item.title).toBe("New")

      index.stop()
    })

    it("removes deleted items on reindex", async () => {
      const doc: TestDoc = {
        items: {
          "t1": { id: "t1", type: "task", title: "Task 1" },
          "t2": { id: "t2", type: "task", title: "Task 2" },
        },
      }
      const handle = createMockHandle("space-1", doc)
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(2))

      // Delete t2
      delete doc.items["t2"]
      handle.simulateRemoteUpdate()

      expect(index.getAll().size).toBe(1)
      expect(index.getAll().has("t2")).toBe(false)
      expect(index.getByType("task")).toHaveLength(1)

      index.stop()
    })
  })

  describe("space lifecycle", () => {
    it("adds items when a new space appears", async () => {
      const handle1 = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      const handle2 = createMockHandle("space-2", {
        items: { "t2": { id: "t2", type: "task", title: "Task 2" } },
      })
      replication.registerHandle("space-1", handle1)
      replication.registerHandle("space-2", handle2)

      // Start with one space
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(1))

      // Add second space
      replication.setSpaces([
        { id: "space-1", type: "shared" },
        { id: "space-2", type: "shared" },
      ])

      await vi.waitFor(() => expect(index.getAll().size).toBe(2))

      expect(index.getItemSpaceId("t2")).toBe("space-2")

      index.stop()
    })

    it("removes items when a space disappears", async () => {
      const handle1 = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      const handle2 = createMockHandle("space-2", {
        items: { "t2": { id: "t2", type: "task", title: "Task 2" } },
      })
      replication.registerHandle("space-1", handle1)
      replication.registerHandle("space-2", handle2)

      replication.setSpaces([
        { id: "space-1", type: "shared" },
        { id: "space-2", type: "shared" },
      ])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(2))

      // Remove space-2
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      expect(index.getAll().size).toBe(1)
      expect(index.getAll().has("t2")).toBe(false)
      expect(handle2.close).toHaveBeenCalled()

      index.stop()
    })
  })

  describe("queries", () => {
    it("getByType returns items of given type", async () => {
      const handle = createMockHandle("space-1", {
        items: {
          "t1": { id: "t1", type: "task", title: "Task 1" },
          "t2": { id: "t2", type: "event", title: "Event 1" },
          "t3": { id: "t3", type: "task", title: "Task 2" },
        },
      })
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(3))

      expect(index.getByType("task")).toHaveLength(2)
      expect(index.getByType("event")).toHaveLength(1)
      expect(index.getByType("nonexistent")).toHaveLength(0)

      index.stop()
    })

    it("getBySpace returns items for given space", async () => {
      const handle1 = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      const handle2 = createMockHandle("space-2", {
        items: { "t2": { id: "t2", type: "task", title: "Task 2" } },
      })
      replication.registerHandle("space-1", handle1)
      replication.registerHandle("space-2", handle2)
      replication.setSpaces([
        { id: "space-1", type: "shared" },
        { id: "space-2", type: "shared" },
      ])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(2))

      expect(index.getBySpace("space-1").size).toBe(1)
      expect(index.getBySpace("space-1").get("t1")?.title).toBe("Task 1")
      expect(index.getBySpace("unknown").size).toBe(0)

      index.stop()
    })

    it("getItemSpaceId returns correct space", async () => {
      const handle = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(1))

      expect(index.getItemSpaceId("t1")).toBe("space-1")
      expect(index.getItemSpaceId("nonexistent")).toBeNull()

      index.stop()
    })
  })

  describe("getFiltered", () => {
    it("returns all items when no filter", async () => {
      const handle = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(1))

      expect(index.getFiltered({}).size).toBe(1)
      expect(index.getFiltered({ includedSpaces: null }).size).toBe(1)

      index.stop()
    })

    it("filters by includedSpaces", async () => {
      const handle1 = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      const handle2 = createMockHandle("space-2", {
        items: { "t2": { id: "t2", type: "task", title: "Task 2" } },
      })
      replication.registerHandle("space-1", handle1)
      replication.registerHandle("space-2", handle2)
      replication.setSpaces([
        { id: "space-1", type: "shared" },
        { id: "space-2", type: "shared" },
      ])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(2))

      const filtered = index.getFiltered({ includedSpaces: ["space-1"] })
      expect(filtered.size).toBe(1)
      expect(filtered.has("t1")).toBe(true)

      index.stop()
    })

    it("filters by excludedSpaces", async () => {
      const handle1 = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      const handle2 = createMockHandle("space-2", {
        items: { "t2": { id: "t2", type: "task", title: "Task 2" } },
      })
      replication.registerHandle("space-1", handle1)
      replication.registerHandle("space-2", handle2)
      replication.setSpaces([
        { id: "space-1", type: "shared" },
        { id: "space-2", type: "shared" },
      ])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(2))

      const filtered = index.getFiltered({ excludedSpaces: ["space-2"] })
      expect(filtered.size).toBe(1)
      expect(filtered.has("t1")).toBe(true)

      index.stop()
    })
  })

  describe("spaceFilter option", () => {
    it("only indexes spaces matching filter", async () => {
      const handle1 = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      const handle2 = createMockHandle("personal", {
        items: { "p1": { id: "p1", type: "note", title: "Note 1" } },
      })
      replication.registerHandle("space-1", handle1)
      replication.registerHandle("personal", handle2)
      replication.setSpaces([
        { id: "space-1", type: "shared" },
        { id: "personal", type: "personal" },
      ])

      const index = createIndex({
        spaceFilter: (info) => info.type === "shared",
      })
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(1))

      expect(index.getAll().has("t1")).toBe(true)
      expect(index.getAll().has("p1")).toBe(false)

      index.stop()
    })
  })

  describe("onChange", () => {
    it("notifies on new items", async () => {
      const doc: TestDoc = { items: {} }
      const handle = createMockHandle("space-1", doc)
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      const onChange = vi.fn()
      index.onChange(onChange)
      index.start()

      // Wait for initial index (empty doc triggers onChange too)
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
      onChange.mockClear()

      // Add item remotely
      doc.items["t1"] = { id: "t1", type: "task", title: "New" }
      handle.simulateRemoteUpdate()

      // onChange is debounced via microtask
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))

      index.stop()
    })

    it("unsubscribe works", async () => {
      const doc: TestDoc = { items: {} }
      const handle = createMockHandle("space-1", doc)
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      const onChange = vi.fn()
      const unsub = index.onChange(onChange)
      index.start()

      await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
      onChange.mockClear()

      unsub()

      doc.items["t1"] = { id: "t1", type: "task", title: "New" }
      handle.simulateRemoteUpdate()

      // Wait for microtask to flush
      await new Promise(r => queueMicrotask(r))
      expect(onChange).not.toHaveBeenCalled()

      index.stop()
    })
  })

  describe("reindexSpace", () => {
    it("manually reindexes after local write", async () => {
      const doc: TestDoc = {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      }
      const handle = createMockHandle("space-1", doc)
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(1))

      // Local write (no remote update fired)
      doc.items["t2"] = { id: "t2", type: "task", title: "Local" }
      index.reindexSpace("space-1")

      expect(index.getAll().size).toBe(2)
      expect(index.getAll().get("t2")?.item.title).toBe("Local")

      index.stop()
    })

    it("no-op for unknown space", () => {
      const index = createIndex()
      index.start()
      expect(() => index.reindexSpace("unknown")).not.toThrow()
      index.stop()
    })
  })

  describe("type index consistency", () => {
    it("handles type changes on reindex", async () => {
      const doc: TestDoc = {
        items: { "t1": { id: "t1", type: "task", title: "Task" } },
      }
      const handle = createMockHandle("space-1", doc)
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      index.start()

      await vi.waitFor(() => expect(index.getAll().size).toBe(1))

      expect(index.getByType("task")).toHaveLength(1)
      expect(index.getByType("event")).toHaveLength(0)

      // Change type
      doc.items["t1"] = { id: "t1", type: "event", title: "Now Event" }
      handle.simulateRemoteUpdate()

      expect(index.getByType("task")).toHaveLength(0)
      expect(index.getByType("event")).toHaveLength(1)

      index.stop()
    })
  })

  describe("debouncing", () => {
    it("coalesces multiple synchronous updates into one notification", async () => {
      const doc: TestDoc = {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      }
      const handle = createMockHandle("space-1", doc)
      replication.registerHandle("space-1", handle)
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      const index = createIndex()
      const onChange = vi.fn()
      index.onChange(onChange)
      index.start()

      await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
      onChange.mockClear()

      // Fire 3 remote updates synchronously
      doc.items["t2"] = { id: "t2", type: "task", title: "Task 2" }
      handle.simulateRemoteUpdate()
      doc.items["t3"] = { id: "t3", type: "task", title: "Task 3" }
      handle.simulateRemoteUpdate()
      doc.items["t4"] = { id: "t4", type: "task", title: "Task 4" }
      handle.simulateRemoteUpdate()

      // Should coalesce into 1 notification
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))

      // But all items should be indexed
      expect(index.getAll().size).toBe(4)

      index.stop()
    })
  })

  describe("race condition: duplicate addSpace", () => {
    it("does not add the same space twice on rapid watchSpaces updates", async () => {
      const handle = createMockHandle("space-1", {
        items: { "t1": { id: "t1", type: "task", title: "Task 1" } },
      })
      replication.registerHandle("space-1", handle)

      const index = createIndex()
      index.start()

      // Two rapid watchSpaces emissions with the same new space
      replication.setSpaces([{ id: "space-1", type: "shared" }])
      replication.setSpaces([{ id: "space-1", type: "shared" }])

      await vi.waitFor(() => expect(index.getAll().size).toBe(1))

      // openSpace should have been called only once
      expect(replication.openSpace).toHaveBeenCalledTimes(1)

      index.stop()
    })
  })
})
