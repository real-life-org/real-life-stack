import type { Item } from "@real-life-stack/data-interface"
import type { SerializedItem } from "./types.js"

export function serializeItem(item: Item): SerializedItem {
  const serialized: SerializedItem = {
    id: item.id,
    type: item.type,
    createdAt: item.createdAt.toISOString(),
    createdBy: item.createdBy,
    data: { ...item.data },
  }
  if (item.schema) serialized.schema = item.schema
  if (item.schemaVersion != null) serialized.schemaVersion = item.schemaVersion
  if (item.relations?.length) serialized.relations = item.relations
  return serialized
}

export function deserializeItem(serialized: SerializedItem): Item {
  const item: Item = {
    id: serialized.id,
    type: serialized.type,
    createdAt: new Date(serialized.createdAt),
    createdBy: serialized.createdBy,
    data: { ...serialized.data },
  }
  if (serialized.schema) item.schema = serialized.schema
  if (serialized.schemaVersion != null) item.schemaVersion = serialized.schemaVersion
  if (serialized.relations?.length) item.relations = serialized.relations
  return item
}
