import { builder } from "./builder.js"
import { ItemType, ItemFilterInputType } from "./types/item.js"
import { AuthStateType } from "./types/user.js"
import * as store from "../store.js"
import { subscribe } from "../pubsub.js"
import { stripNulls } from "./utils.js"

builder.subscriptionType({
  fields: (t) => ({
    itemsChanged: t.field({
      type: [ItemType],
      args: { filter: t.arg({ type: ItemFilterInputType }) },
      subscribe: async function* (_root, args) {
        const filter = args.filter ? stripNulls(args.filter) : undefined
        yield store.getItems(filter)
        for await (const _event of subscribe("ITEMS_CHANGED")) {
          yield store.getItems(filter)
        }
      },
      resolve: (items) => items,
    }),

    itemChanged: t.field({
      type: ItemType,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      subscribe: async function* (_root, args) {
        yield store.getItem(String(args.id))
        for await (const event of subscribe("ITEM_CHANGED")) {
          if (event.itemId === String(args.id)) {
            yield store.getItem(String(args.id))
          }
        }
      },
      resolve: (item) => item,
    }),

    authStateChanged: t.field({
      type: AuthStateType,
      subscribe: async function* () {
        yield store.getAuthState()
        for await (const _event of subscribe("AUTH_STATE_CHANGED")) {
          yield store.getAuthState()
        }
      },
      resolve: (authState) => authState,
    }),
  }),
})
