import { builder } from "./builder.js"

// Side-effect imports: register types and fields on the builder
import "./types/user.js"
import "./types/source.js"
import "./types/item.js"
import "./types/group.js"
import "./queries.js"
import "./mutations.js"
import "./subscriptions.js"

export const schema = builder.toSchema()
