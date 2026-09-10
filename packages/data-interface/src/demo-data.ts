import type { Item, Group, User, PersonProfileInput } from "./index.js"

import rawUsers from "../data/users.json" with { type: "json" }
import rawGroups from "../data/groups.json" with { type: "json" }
import rawGroupMembers from "../data/group-members.json" with { type: "json" }
import rawGroupItems from "../data/group-items.json" with { type: "json" }
import rawItems from "../data/items.json" with { type: "json" }
import rawProfiles from "../data/profiles.json" with { type: "json" }

export const demoUsers: User[] = rawUsers
export const demoGroups: Group[] = rawGroups as Group[]
export const demoGroupMembers: Record<string, string[]> = rawGroupMembers
export const demoGroupItems: Record<string, string[]> = rawGroupItems

/** Profile der Demo-Nutzer — Quelle der person-Projektion (Spec 04 §Profile). */
export const demoProfiles: Record<string, PersonProfileInput> = rawProfiles

export const demoItems: Item[] = rawItems.map((item) => ({
  ...item,
  data: item.data as Record<string, unknown>,
  relations: item.relations as Item["relations"],
}))
