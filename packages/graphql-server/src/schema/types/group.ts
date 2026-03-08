import type { Group } from "@real-life-stack/data-interface"
import { builder } from "../builder.js"
import { UserType } from "./user.js"
import * as store from "../../store.js"

export const GroupType = builder.objectRef<Group>("Group").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    data: t.field({
      type: "JSON",
      nullable: true,
      resolve: (group) => group.data ?? null,
    }),
    members: t.field({
      type: [UserType],
      resolve: (group) => store.getMembers(group.id),
    }),
  }),
})

export const GroupUpdateInputType = builder.inputType("GroupUpdateInput", {
  fields: (t) => ({
    name: t.string(),
    data: t.field({ type: "JSON" }),
  }),
})
