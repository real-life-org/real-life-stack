import SchemaBuilder from "@pothos/core"
import { DateTimeScalar, JSONScalar } from "./scalars.js"

export const builder = new SchemaBuilder<{
  Scalars: {
    DateTime: { Input: Date; Output: Date | string }
    JSON: { Input: unknown; Output: unknown }
  }
}>({})

builder.addScalarType("DateTime", DateTimeScalar)
builder.addScalarType("JSON", JSONScalar)
