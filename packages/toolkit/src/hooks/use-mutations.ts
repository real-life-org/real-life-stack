import type { Item } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

export function useCreateItem() {
  const connector = useConnector()
  return {
    mutate: (item: Omit<Item, "id" | "createdAt">) => connector.createItem(item),
  }
}

export function useUpdateItem() {
  const connector = useConnector()
  return {
    mutate: (id: string, updates: Partial<Item>) => connector.updateItem(id, updates),
  }
}

export function useDeleteItem() {
  const connector = useConnector()
  return {
    mutate: (id: string) => connector.deleteItem(id),
  }
}
