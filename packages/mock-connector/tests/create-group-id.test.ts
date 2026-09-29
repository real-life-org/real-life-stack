import { describe, it, expect, vi, afterEach } from "vitest"
import { MockConnector } from "../src/mock-connector.js"

describe("MockConnector — Group-Id (rls#575)", () => {
  afterEach(() => vi.restoreAllMocks())

  it("zwei Groups in derselben Millisekunde bekommen verschiedene Ids und eigene Mitglieder", async () => {
    const connector = new MockConnector()
    await connector.init()
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)

    const first = await connector.createGroup("Erste")
    const second = await connector.createGroup("Zweite")

    expect(first.id).not.toBe(second.id)
    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect((await connector.getGroups()).filter((group) => group.id === first.id)).toHaveLength(1)
  })
})
