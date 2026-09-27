// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { UseVotesResult } from "../src/hooks/use-votes"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let votes: UseVotesResult
vi.mock("../src/hooks/use-votes", () => ({
  useVotes: () => votes,
  useVoteUsers: () => ({ data: [], isLoading: false }),
}))

const { VoteBar } = await import("../src/components/resonance/vote-bar")

/**
 * „N ohne Stimme" (resonance.md → Auswertung, Kennzahlen) is information in
 * its own right — also for readers who cannot vote and when nobody voted yet
 * (#515).
 */

let host: HTMLDivElement | null = null
async function render(result: UseVotesResult) {
  votes = result
  host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => { root.render(createElement(VoteBar, { statementId: "s" })) })
  const text = host.textContent ?? ""
  await act(async () => { root.unmount() })
  return text
}
afterEach(() => { host?.remove(); host = null })

const summary = (extra: Partial<UseVotesResult["data"]>) => ({ green: 0, yellow: 0, red: 0, total: 0, ...extra })

describe("VoteBar without voting rights", () => {
  it('shows „ohne Stimme" for a known person set even with zero votes', async () => {
    const text = await render({ data: summary({ noVote: 3 }), vote: async () => {}, isLoading: false, canVote: false })
    expect(text).toContain("0 Stimmen · 3 ohne Stimme")
  })

  it("stays hidden when there is nothing to show at all", async () => {
    const text = await render({ data: summary({}), vote: async () => {}, isLoading: false, canVote: false })
    expect(text).toBe("")
  })
})
