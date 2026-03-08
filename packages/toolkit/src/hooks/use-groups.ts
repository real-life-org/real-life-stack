import { useEffect, useState } from "react"
import type { Group, User } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

export function useGroups() {
  const connector = useConnector()
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
  const connector = useConnector()
  return connector.getCurrentGroup()
}

export function useMembers(groupId: string) {
  const connector = useConnector()
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
