import { builder } from "./builder.js"
import { ItemType, ItemFilterInputType } from "./types/item.js"
import { GroupType } from "./types/group.js"
import { UserType, AuthStateType, AuthMethodType } from "./types/user.js"
import { SourceType } from "./types/source.js"
import * as store from "../store.js"
import { stripNulls } from "./utils.js"

builder.queryType({
  fields: (t) => ({
    items: t.field({
      type: [ItemType],
      args: { filter: t.arg({ type: ItemFilterInputType }) },
      resolve: (_root, args) =>
        store.getItems(args.filter ? stripNulls(args.filter) : undefined),
    }),

    item: t.field({
      type: ItemType,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, args) => store.getItem(String(args.id)),
    }),

    groups: t.field({
      type: [GroupType],
      resolve: () => store.getGroups(),
    }),

    members: t.field({
      type: [UserType],
      args: { groupId: t.arg.id({ required: true }) },
      resolve: (_root, args) => store.getMembers(String(args.groupId)),
    }),

    relatedItems: t.field({
      type: [ItemType],
      args: {
        itemId: t.arg.id({ required: true }),
        predicate: t.arg.string(),
      },
      resolve: (_root, args) =>
        store.getRelatedItems(String(args.itemId), args.predicate ?? undefined),
    }),

    currentUser: t.field({
      type: UserType,
      nullable: true,
      resolve: () => store.getCurrentUser(),
    }),

    user: t.field({
      type: UserType,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, args) => store.getUser(String(args.id)),
    }),

    currentGroup: t.field({
      type: GroupType,
      nullable: true,
      resolve: () => store.getCurrentGroup(),
    }),

    authState: t.field({
      type: AuthStateType,
      resolve: () => store.getAuthState(),
    }),

    authMethods: t.field({
      type: [AuthMethodType],
      resolve: () => store.getAuthMethods(),
    }),

    sources: t.field({
      type: [SourceType],
      resolve: () => store.getSources(),
    }),

    activeSource: t.field({
      type: SourceType,
      resolve: () => store.getActiveSource(),
    }),
  }),
})
