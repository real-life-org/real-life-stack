// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { DraftItemProvider, useDraftItem, useSetDraftItem, DRAFT_ITEM_ID } from "../src/hooks/use-draft-item"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const draftWith = (text: string): Item =>
  ({ id: DRAFT_ITEM_ID, type: "post", createdAt: "2026-09-15T09:00:00.000Z", createdBy: "u1",
     data: { title: "Entwurf", content: text } }) as Item

/**
 * Mounts a provider with one publisher (the composer) and one consumer (a
 * module), and records what the consumer saw.
 */
async function mount() {
  const seen: (string | null)[] = []
  let publish!: (draft: Item | null) => void

  function Publisher() {
    publish = useSetDraftItem()
    return null
  }
  function Module() {
    const draft = useDraftItem()
    seen.push(draft ? ((draft.data as { content: string }).content ?? "") : null)
    return null
  }

  const host = document.createElement("div")
  document.body.append(host)
  await act(async () => {
    createRoot(host).render(
      createElement(DraftItemProvider, { children: [createElement(Publisher, { key: "p" }), createElement(Module, { key: "m" })] as unknown as ReactNode }),
    )
  })
  seen.length = 0
  return { seen, publish: (d: Item | null) => act(() => { publish(d) }) }
}

describe("DraftItemProvider", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("shows the first draft at once", async () => {
    const { seen, publish } = await mount()

    await publish(draftWith("E"))

    expect(seen).toEqual(["E"])
  })

  // Every module showing items re-renders with the draft. A sentence must not
  // cost one render of that surface per character.
  it("coalesces what arrives while typing continues", async () => {
    const { seen, publish } = await mount()

    for (const text of ["E", "Ei", "Ein", "Ein ", "Ein B"]) await publish(draftWith(text))

    expect(seen).toEqual(["E"])

    // Still inside the window: a module has seen nothing since the first draft.
    await act(async () => { vi.advanceTimersByTime(299) })

    expect(seen).toEqual(["E"])

    await act(async () => { vi.advanceTimersByTime(1) })

    // Only the newest text arrives — the three in between never reach a module.
    expect(seen).toEqual(["E", "Ein B"])
  })

  it("keeps up while typing goes on", async () => {
    const { seen, publish } = await mount()

    await publish(draftWith("eins"))
    await publish(draftWith("zwei"))
    await act(async () => { vi.advanceTimersByTime(300) })
    await publish(draftWith("drei"))
    await act(async () => { vi.advanceTimersByTime(300) })

    expect(seen).toEqual(["eins", "zwei", "drei"])
  })

  // Clearing follows a save or a cancel. A draft landing afterwards would be
  // the ghost of an item that no longer exists.
  it("clears at once and drops what was still queued", async () => {
    const { seen, publish } = await mount()

    await publish(draftWith("E"))
    await publish(draftWith("Ein B"))
    await publish(null)

    expect(seen).toEqual(["E", null])

    await act(async () => { vi.advanceTimersByTime(1000) })

    expect(seen).toEqual(["E", null])
  })
})
