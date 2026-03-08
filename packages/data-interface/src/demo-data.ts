import type { Item, Group, User } from "./index.js"

import rawUsers from "../data/users.json" with { type: "json" }
import rawGroups from "../data/groups.json" with { type: "json" }
import rawGroupMembers from "../data/group-members.json" with { type: "json" }
import rawItems from "../data/items.json" with { type: "json" }

export const demoUsers: User[] = rawUsers
export const demoGroups: Group[] = rawGroups as Group[]
export const demoGroupMembers: Record<string, string[]> = rawGroupMembers

export const demoItems: Item[] = rawItems.map((item) => ({
  ...item,
  createdAt: new Date(item.createdAt),
  data: item.data as Record<string, unknown>,
  relations: item.relations as Item["relations"],
}))
