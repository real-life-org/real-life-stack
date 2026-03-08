import { useEffect, useState } from "react"
import type { Group, User } from "@real-life-stack/data-interface"
import { hasGroups } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

function useGroupConnector() {
  const connector = useConnector()
  if (!hasGroups(connector)) {
    throw new Error("Connector does not support groups")
  }
  return connector
}

export function useGroups() {
  const connector = useGroupConnector()
  const [data, setData] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    connector.getGroups().then((groups) => {
      setData(groups)
      setIsLoading(false)
    })
  }, [connector])

  return { data, isLoading }
}

export function useCurrentGroup() {
  const connector = useGroupConnector()
  return connector.getCurrentGroup()
}

export function useMembers(groupId: string) {
  const connector = useGroupConnector()
  const [data, setData] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    connector.getMembers(groupId).then((members) => {
      setData(members)
      setIsLoading(false)
    })
  }, [connector, groupId])

  return { data, isLoading }
}
