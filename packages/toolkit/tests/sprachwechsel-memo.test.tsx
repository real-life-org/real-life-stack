// @vitest-environment jsdom
// Sprachwechsel ohne Remount (#647): Texte, die in memoisierten Werten oder Callbacks entstehen, folgen
// der neuen Sprache auch dann, wenn sich die Daten (Items, Stimmen) nicht ändern.
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life/data-interface"
import type { UseVotesResult } from "../src/hooks/use-votes"
import { setLanguage } from "../src/i18n"
import { resetI18nForTests } from "../src/testing"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const votes: UseVotesResult = { data: { green: 1, yellow: 0, red: 0, total: 1 }, vote: async () => {}, isLoading: false, canVote: true }
// Stabile Wählerliste wie im echten Hook: Sonst baut sich der Tooltip-Callback bei jedem Render neu, und
// ein fehlendes `t` in seinen Abhängigkeiten fiele nicht auf.
const voters = { data: [], isLoading: false }
vi.mock("../src/hooks/use-votes", () => ({
  useVotes: () => votes,
  useVoteUsers: () => voters,
}))

const { VoteBar } = await import("../src/components/resonance/vote-bar")
const { KanbanBoard } = await import("../src/components/kanban/kanban-board")

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  setLanguage("de", { persist: false })
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  resetI18nForTests()
})

describe("Sprachwechsel bei unveränderten Daten", () => {
  it("die Kanban-Karte ohne Titel zeigt den Ersatztitel in der neuen Sprache", async () => {
    const items = [{ id: "t1", type: "task", createdAt: "2026-06-05T10:00:00.000Z", createdBy: "u1", data: { title: "", status: "open" }, relations: [] } as Item]
    await act(async () => { root.render(createElement(KanbanBoard, { items, readOnly: true })) })
    expect(host.textContent).toContain("Ohne Titel")
    await act(async () => { setLanguage("en", { persist: false }) })
    expect(host.textContent).toContain("Untitled")
    expect(host.textContent).not.toContain("Ohne Titel")
  })

  it("der Tooltip der Stimmknöpfe folgt der neuen Sprache", async () => {
    await act(async () => { root.render(createElement(VoteBar, { statementId: "s" })) })
    const titles = () => [...host.querySelectorAll("button[title]")].map((b) => b.getAttribute("title"))
    expect(titles()).toContain("Zustimmung")
    await act(async () => { setLanguage("en", { persist: false }) })
    expect(titles()).toContain("Approval")
    expect(titles()).not.toContain("Zustimmung")
  })
})
