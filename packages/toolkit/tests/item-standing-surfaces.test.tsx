// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { createObservable, type ClaimVerdict, type Item } from "@real-life-stack/data-interface"
import { ConnectorProvider } from "../src/hooks/connector-context"
import { useCommentCount } from "../src/hooks/use-comment-count"
import { useReactions, type UseReactionsResult } from "../src/hooks/use-reactions"
import { standingMark } from "../src/hooks/use-item-standing"
import { ReactionBar } from "../src/components/reactions/reaction-bar"
import { CommentSection } from "../src/components/comments/comment-section"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Spec 08 → Beleg erforderlich on the surfaces: comments and reactions
 * (proof requirement off for now) count when attested or unsigned; unsigned
 * ones are subtly marked, invalid ones never count, and one with a
 * non-matching claim is shown as „verändert". While a verdict is pending
 * nothing is marked.
 */

const TARGET = "post-1"

const reaction = (id: string, emoji: string, by: string, claim?: string): Item =>
  ({ id, type: "reaction", createdAt: "2026-09-26T10:00:00.000Z", createdBy: by,
     data: { emoji, ...(claim ? { claim } : {}) }, relations: [{ predicate: "reactsTo", target: `item:${TARGET}` }] }) as Item

const comment = (id: string, content: string, by: string, claim?: string): Item =>
  ({ id, type: "comment", createdAt: "2026-09-26T10:00:00.000Z", createdBy: by,
     data: { content, ...(claim ? { claim } : {}) }, relations: [{ predicate: "commentOn", target: `item:${TARGET}` }] }) as Item

/** Claims are "good" (valid) or "bad" (invalid); `verify: "never"` keeps them pending. */
function fakeConnector(items: Item[], verify: "claims" | "never" | "none" = "claims") {
  const byPredicate = (predicate: string) =>
    items.filter((item) => item.relations?.some((relation) => relation.predicate === predicate))
  const fake: Record<string, unknown> = {
    observeRelatedItems: (_id: string, predicate: string) => createObservable(byPredicate(predicate)),
    getRelatedItems: async (_id: string, predicate: string) => byPredicate(predicate),
    createItem: async () => ({ id: "new" }) as Item,
    deleteItem: async () => {},
    updateItem: async () => ({}) as Item,
    relate: async () => {}, unrelate: async () => {},
    getCurrentUser: async () => ({ id: "me", displayName: "Ich" }),
    observeCurrentUser: () => createObservable({ id: "me", displayName: "Ich" }),
    getAuthState: () => createObservable({ status: "authenticated" as const }),
    authenticate: async () => ({ id: "me", displayName: "Ich" }),
    getItems: async () => [], observeItems: () => createObservable<Item[]>([]),
    getItem: async () => null, observeItem: () => createObservable<Item | null>(null),
    getUser: async (id: string) => ({ id, displayName: `Name ${id}` }),
  }
  if (verify === "claims") {
    fake.verifyItemClaim = async (item: Item): Promise<ClaimVerdict> => (item.data.claim === "good" ? "valid" : "invalid")
  } else if (verify === "never") {
    fake.verifyItemClaim = () => new Promise<ClaimVerdict>(() => {})
  }
  return fake
}

async function mount(connector: Record<string, unknown>, element: ReturnType<typeof createElement>) {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never }, element))
  })
  for (let round = 0; round < 4; round++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)) })
  }
  return {
    host,
    unmount: async () => {
      await act(async () => { root.unmount() })
      host.remove()
    },
  }
}

describe("standingMark", () => {
  it("marks unsigned and altered, hides invalid without a claim, leaves the rest unmarked", () => {
    expect(standingMark(comment("c", "x", "a"), "unsigned")).toBe("unsigned")
    expect(standingMark(comment("c", "x", "a", "bad"), "invalid")).toBe("altered")
    expect(standingMark(comment("c", "x", "a"), "invalid")).toBe("hidden")
    expect(standingMark(comment("c", "x", "a", "good"), "attested")).toBeNull()
    expect(standingMark(comment("c", "x", "a", "good"), "pending")).toBeNull()
    expect(standingMark(comment("c", "x", "a"), undefined)).toBeNull()
  })

  it("without a claim mode nothing is marked; the proof requirement still hides", () => {
    expect(standingMark(comment("c", "x", "a"), "unsigned", false)).toBeNull()
    expect(standingMark(comment("c", "x", "a", "bad"), "invalid", false)).toBeNull()
    expect(standingMark(comment("c", "x", "a"), "invalid", false)).toBe("hidden")
  })
})

describe("reactions by standing", () => {
  it("counts attested and unsigned reactions, never invalid ones", async () => {
    const view = await mount(
      fakeConnector([
        reaction("r1", "👍", "a", "good"),
        reaction("r2", "👍", "b"),
        reaction("r3", "👍", "c", "bad"),
      ]),
      createElement(ReactionBar, { itemId: TARGET }),
    )
    expect(view.host.textContent).toContain("👍2")
    await view.unmount()
  })

  it("does not count a signed reaction while its verdict is pending (fail closed)", async () => {
    const view = await mount(
      fakeConnector([reaction("r1", "🎉", "a", "good"), reaction("r2", "👍", "b")], "never"),
      createElement(ReactionBar, { itemId: TARGET }),
    )
    expect(view.host.textContent).toContain("👍1")
    expect(view.host.textContent).not.toContain("🎉")
    await view.unmount()
  })
})

describe("own optimistic reaction and the verdict of what was written (#504)", () => {
  /** Writes publish the new reaction (with a claim) into the observed set;
      the verdict for it arrives after `delay` ms. */
  function writingConnector(outcome: "valid" | "invalid" | "throw", delay = 20) {
    const related = createObservable<Item[]>([])
    const fake = fakeConnector([], "none")
    Object.assign(fake, {
      observeRelatedItems: () => related,
      getRelatedItems: async () => related.current,
      createItem: async (input: { data: Record<string, unknown> }) => {
        const item = reaction(`r-${related.current.length}`, String(input.data.emoji), "me", "sig")
        related.set([...related.current, item])
        return item
      },
      verifyItemClaim: () => new Promise<ClaimVerdict>((resolve, reject) => setTimeout(() => {
        if (outcome === "throw") reject(new Error("verifier down"))
        else resolve(outcome)
      }, delay)),
    })
    return fake
  }

  async function reactAndSettle(outcome: "valid" | "invalid" | "throw") {
    let hook: UseReactionsResult | null = null
    const Probe = () => {
      hook = useReactions(TARGET)
      return null
    }
    const view = await mount(writingConnector(outcome), createElement(Probe))
    await act(async () => { await hook!.react("👍") })
    // While the verdict is outstanding the own reaction shows (no flicker).
    const during = hook!.data.find((r) => r.emoji === "👍")?.count ?? 0
    for (let round = 0; round < 8; round++) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
    }
    const after = hook!.data.find((r) => r.emoji === "👍")?.count ?? 0
    await view.unmount()
    return { during, after }
  }

  it("stays counted while verifying and after a delayed valid verdict", async () => {
    expect(await reactAndSettle("valid")).toEqual({ during: 1, after: 1 })
  })

  it("is withdrawn once the written reaction is rejected (invalid)", async () => {
    expect(await reactAndSettle("invalid")).toEqual({ during: 1, after: 0 })
  })

  it("is withdrawn when verification throws", async () => {
    expect(await reactAndSettle("throw")).toEqual({ during: 1, after: 0 })
  })
})

describe("comments by standing", () => {
  it('marks an unsigned comment subtly and an altered one as „verändert"', async () => {
    const view = await mount(
      fakeConnector([
        comment("c1", "belegt", "a", "good"),
        comment("c2", "ohne Signatur", "b"),
        comment("c3", "nachträglich geändert", "c", "bad"),
      ]),
      createElement(CommentSection, { itemId: TARGET, hideInput: true }),
    )
    const text = view.host.textContent ?? ""
    expect(text).toContain("belegt")
    expect(text).toContain("ohne Signatur")
    expect(text).toContain("nachträglich geändert")
    expect(text.match(/unsigniert/g)).toHaveLength(1)
    expect(text.match(/verändert/g)).toHaveLength(1)
    await view.unmount()
  })

  it("marks nothing on a connector that cannot verify (fixture mode, stories)", async () => {
    const view = await mount(
      fakeConnector([comment("c1", "Demo", "a"), comment("c2", "Demo 2", "b")], "none"),
      createElement(CommentSection, { itemId: TARGET, hideInput: true }),
    )
    expect(view.host.textContent).toContain("Demo 2")
    expect(view.host.textContent).not.toContain("unsigniert")
    await view.unmount()
  })

  it("shows no mark while verdicts are pending", async () => {
    const view = await mount(
      fakeConnector([comment("c1", "wird geprüft", "a", "good")], "never"),
      createElement(CommentSection, { itemId: TARGET, hideInput: true }),
    )
    expect(view.host.textContent).toContain("wird geprüft")
    expect(view.host.textContent).not.toContain("verändert")
    await view.unmount()
  })

  it("the comment count leaves out invalid comments", async () => {
    let count = -1
    const Probe = () => {
      count = useCommentCount(TARGET)
      return null
    }
    const view = await mount(
      fakeConnector([
        comment("c1", "belegt", "a", "good"),
        comment("c2", "ohne Signatur", "b"),
        comment("c3", "verändert", "c", "bad"),
      ]),
      createElement(Probe),
    )
    expect(count).toBe(2)
    await view.unmount()
  })
})
