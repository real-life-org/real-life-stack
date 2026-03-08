import type { User, AuthState, AuthMethod } from "@real-life-stack/data-interface"
import { builder } from "../builder.js"

export const UserType = builder.objectRef<User>("User").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    displayName: t.exposeString("displayName", { nullable: true }),
    avatarUrl: t.exposeString("avatarUrl", { nullable: true }),
  }),
})

export const AuthStateType = builder.objectRef<AuthState>("AuthState").implement({
  fields: (t) => ({
    status: t.exposeString("status"),
    user: t.field({
      type: UserType,
      nullable: true,
      resolve: (authState) =>
        authState.status === "authenticated" ? authState.user : null,
    }),
  }),
})

export const AuthMethodType = builder.objectRef<AuthMethod>("AuthMethod").implement({
  fields: (t) => ({
    method: t.exposeString("method"),
    label: t.exposeString("label"),
  }),
})
