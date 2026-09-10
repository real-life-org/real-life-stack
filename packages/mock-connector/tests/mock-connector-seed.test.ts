import { describe, expect, it } from "vitest"
import type { Group, Item, User } from "@real-life-stack/data-interface"
import { isPersonProjection } from "@real-life-stack/data-interface"
import {
  demoGroupItems,
  demoGroups,
  demoItems,
  demoUsers,
} from "@real-life-stack/data-interface/demo-data"
import { MockConnector, type MockConnectorSeed } from "../src/index"

const groups: Group[] = [
  { id: "dwebcamp", name: "DWebCamp" },
  { id: "my-network", name: "Mein Netzwerk" },
]

const users: User[] = [{ id: "user-1", displayName: "Test User" }]

const items: Item[] = [
  {
    id: "person-alice",
    type: "person",
    createdAt: "2026-07-16T00:00:00.000Z",
    createdBy: "user-1",
    data: { displayName: "Alice" },
  },
  {
    id: "project-commons",
    type: "project",
    createdAt: "2026-07-16T00:00:00.000Z",
    createdBy: "user-1",
    data: { title: "Commons" },
  },
]

const seed: MockConnectorSeed = {
  items,
  groups,
  users,
  groupMembers: {
    dwebcamp: ["user-1"],
    "my-network": [],
  },
  groupItems: {
    dwebcamp: ["person-alice", "project-commons"],
    "my-network": [],
  },
}

/** Nur die gespeicherten Items — die person-Projektionen der Mitglieder
 *  (Spec 04 §Profile) pruefen die Faelle darunter eigens. */
async function storedItems(connector: MockConnector): Promise<Item[]> {
  return (await connector.getItems()).filter((item) => !isPersonProjection(item))
}

describe("MockConnector seed injection", () => {
  it("uses injected items, groups, users, memberships, and group scopes", async () => {
    const connector = new MockConnector(seed)

    expect(await connector.getGroups()).toEqual(groups)
    expect(await connector.getCurrentUser()).toEqual(users[0])
    expect(await connector.getMembers("dwebcamp")).toEqual(users)

    connector.setCurrentGroup("dwebcamp")
    expect(await storedItems(connector)).toEqual(items)

    connector.setCurrentGroup("my-network")
    expect(await storedItems(connector)).toEqual([])
  })

  it("projiziert die Mitglieder des aktiven Space als person-Items", async () => {
    const connector = new MockConnector(seed)

    connector.setCurrentGroup("dwebcamp")
    const projected = (await connector.getItems()).filter(isPersonProjection)
    expect(projected.map((item) => item.id)).toEqual(["user-1"])
    expect(projected[0]!.data.displayName).toBe("Test User")

    // Ein Space ohne Mitglieder projiziert nichts.
    connector.setCurrentGroup("my-network")
    expect((await connector.getItems()).filter(isPersonProjection)).toEqual([])
  })

  it("keeps the parameterless demo-data behavior unchanged", async () => {
    const connector = new MockConnector()

    expect(connector.getCurrentGroup()).toBeNull()
    expect(await connector.getCurrentUser()).toEqual(demoUsers[0])
    expect(await connector.getGroups()).toEqual(
      demoGroups.filter((group) => group.data?.scope !== "aggregate"),
    )
    expect(await storedItems(connector)).toEqual(demoItems)

    const [groupId, groupItemIds] = Object.entries(demoGroupItems)[0]
    connector.setCurrentGroup(groupId)
    expect((await storedItems(connector)).map((item) => item.id)).toEqual(
      demoItems
        .filter((item) => groupItemIds.includes(item.id) || item.type === "feature")
        .map((item) => item.id),
    )
  })
})
