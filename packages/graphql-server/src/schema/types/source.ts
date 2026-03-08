import { builder } from "../builder.js"

export const SourceType = builder.objectRef<{ id: string; name: string }>("Source").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
  }),
})
