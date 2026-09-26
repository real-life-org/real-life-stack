import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { AUTHORIAL_ITEM_TYPES, hasItemClaimVerification } from "@real-life-stack/data-interface"
import { SupabaseConnector } from "../src/supabase-connector.js"
import { FakeSupabaseClient } from "./fake-client.js"

const migration = readFileSync(new URL("../../../supabase/migrations/0012_authorial_content.sql", import.meta.url), "utf8")

async function makeConnector(options?: { allowFixtureAuthors?: boolean }) {
  const client = new FakeSupabaseClient()
  client.serviceRole = options?.allowFixtureAuthors === true
  const connector = new SupabaseConnector(client, options)
  await connector.init()
  const user = await connector.authenticate("anonymous", {})
  return { client, connector, userId: user.id }
}

/** Seeds a statement by another author via the service role, then drops
    back to the session's rights (what the RLS policies and trigger see). */
async function foreignStatement() {
  const setup = await makeConnector({ allowFixtureAuthors: true })
  const statement = await setup.connector.createItem({
    type: "statement",
    createdBy: "user-bob",
    data: { title: "Bobs Aussage", description: "D" },
  })
  setup.client.serviceRole = false
  return { ...setup, statement }
}

function contentBoundVote(voterId: string, statementId: string) {
  return {
    type: "relation",
    createdBy: voterId,
    data: { predicate: "votesOn", value: "green", contentHash: "sha256:00" },
    relations: [
      { predicate: "from", target: `global:${voterId}` },
      { predicate: "to", target: `item:${statementId}` },
    ],
  }
}

describe("SupabaseConnector — item-authorial (spec 08, migration 0012)", () => {
  it("the SQL catalog in 0012 matches AUTHORIAL_ITEM_TYPES", () => {
    const block = migration.slice(migration.indexOf("-- catalog:begin"), migration.indexOf("-- catalog:end"))
    const rows = [...block.matchAll(/\('([a-z]+)', array\[([^\]]*)\](?:::text\[\])?, array\[([^\]]*)\](?:::text\[\])?\)/g)]
    const list = (raw: string) => [...raw.matchAll(/'([^']+)'/g)].map((m) => m[1])
    const parsed = Object.fromEntries(rows.map(([, type, data, relations]) => [type, { data: list(data!), relations: list(relations!) }]))
    const expected = Object.fromEntries(
      [...AUTHORIAL_ITEM_TYPES].map(([type, entry]) => [type, { data: [...entry.data], relations: [...entry.relations] }]),
    )
    expect(parsed).toEqual(expected)
  })

  it("answers trusted for authorial items; the fixture path loses the capability", async () => {
    const { connector } = await makeConnector()
    const statement = await connector.createItem({ type: "statement", data: { title: "T" } })
    expect(hasItemClaimVerification(connector)).toBe(true)
    expect(await connector.verifyItemClaim!(statement)).toBe("trusted")

    const fixture = await makeConnector({ allowFixtureAuthors: true })
    expect(hasItemClaimVerification(fixture.connector)).toBe(false)
  })

  it("writes no claim for catalog types; other types keep their data", async () => {
    const { connector } = await makeConnector()
    const statement = await connector.createItem({ type: "statement", data: { title: "T", claim: "forged" } })
    expect(statement.data).toEqual({ title: "T" })
    const note = await connector.createItem({ type: "note", data: { title: "N", claim: "kept" } })
    expect(note.data).toEqual({ title: "N", claim: "kept" })

    const updated = await connector.updateItem(statement.id, { data: { title: "T", claim: "forged" } })
    expect(updated.data).toEqual({ title: "T" })
  })

  it("another member may change a statement outside its content, never the content", async () => {
    const { connector, statement } = await foreignStatement()
    const tagged = await connector.updateItem(statement.id, { tags: ["wichtig"] })
    expect(tagged.tags).toEqual(["wichtig"])
    const extended = await connector.updateItem(statement.id, { data: { ...statement.data, color: "red" } })
    expect(extended.data).toEqual({ title: "Bobs Aussage", description: "D", color: "red" })

    await expect(connector.updateItem(statement.id, { data: { ...statement.data, title: "Fremd" } }))
      .rejects.toThrow(/only the author/)
    await expect(connector.deleteItem(statement.id)).rejects.toThrow(/not authorized/)
    expect((await connector.getItem(statement.id))!.data.title).toBe("Bobs Aussage")
  })

  it("the author changes the content until another person binds a vote to it", async () => {
    const { client, connector, userId } = await makeConnector({ allowFixtureAuthors: true })
    client.serviceRole = false
    const statement = await connector.createItem({ type: "statement", createdBy: userId, data: { title: "Erste Fassung" } })
    await connector.createItem(contentBoundVote(userId, statement.id))
    const revised = await connector.updateItem(statement.id, { data: { title: "Zweite Fassung" } })
    expect(revised.data.title).toBe("Zweite Fassung")

    client.serviceRole = true
    await connector.createItem(contentBoundVote("user-bob", statement.id))
    client.serviceRole = false

    await expect(connector.updateItem(statement.id, { data: { title: "Dritte Fassung" } }))
      .rejects.toThrow(/frozen/)
    const tagged = await connector.updateItem(statement.id, { tags: ["x"] })
    expect(tagged.data.title).toBe("Zweite Fassung")
  })

  it("only a reference in the statement's own space freezes it (#501)", async () => {
    const { client, connector, userId } = await makeConnector({ allowFixtureAuthors: true })
    const home = await connector.createGroup("Alices Space")
    const elsewhere = await connector.createGroup("Bobs Space")
    connector.setCurrentGroup(home.id)
    client.serviceRole = false
    const statement = await connector.createItem({ type: "statement", createdBy: userId, data: { title: "Erste Fassung" } })

    client.serviceRole = true
    connector.setCurrentGroup(elsewhere.id)
    await connector.createItem(contentBoundVote("user-bob", statement.id))
    client.serviceRole = false
    const revised = await connector.updateItem(statement.id, { data: { title: "Zweite Fassung" } })
    expect(revised.data.title).toBe("Zweite Fassung")

    client.serviceRole = true
    connector.setCurrentGroup(home.id)
    await connector.createItem(contentBoundVote("user-carol", statement.id))
    client.serviceRole = false
    await expect(connector.updateItem(statement.id, { data: { title: "Dritte Fassung" } }))
      .rejects.toThrow(/frozen/)
  })

  it("the author may delete their own statement", async () => {
    const { connector } = await makeConnector()
    const statement = await connector.createItem({ type: "statement", data: { title: "T" } })
    await connector.deleteItem(statement.id)
    expect(await connector.getItem(statement.id)).toBeNull()
  })
})
