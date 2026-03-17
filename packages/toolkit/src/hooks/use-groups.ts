import { useCallback, useEffect, useMemo, useState } from "react"
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
  const observable = useMemo(() => connector.observeGroups(), [connector])
  const [data, setData] = useState<Group[]>(observable.current)

  useEffect(() => {
    setData(observable.current)
    return observable.subscribe(setData)
  }, [observable])

  return { data, isLoading: data.length === 0 && observable.current.length === 0 }
}

export function useCurrentGroup() {
  const connector = useGroupConnector()
  const observable = useMemo(() => connector.observeCurrentGroup(), [connector])
  const [data, setData] = useState<Group | null>(observable.current)

  useEffect(() => {
    setData(observable.current)
    return observable.subscribe(setData)
  }, [observable])

  return data
}

export function useCreateGroup() {
  const connector = useGroupConnector()
  return useCallback(
    async (name: string, data?: Record<string, unknown>) => {
      return connector.createGroup(name, data)
    },
    [connector],
  )
}

export function useUpdateGroup() {
  const connector = useGroupConnector()
  return useCallback(
    async (id: string, updates: Partial<Group>) => {
      return connector.updateGroup(id, updates)
    },
    [connector],
  )
}

export function useDeleteGroup() {
  const connector = useGroupConnector()
  return useCallback(
    async (id: string) => {
      return connector.deleteGroup(id)
    },
    [connector],
  )
}

export function useMembers(groupId: string) {
  const connector = useGroupConnector()
  const observable = useMemo(() => connector.observeMembers(groupId), [connector, groupId])
  const [data, setData] = useState<User[]>(observable.current)

  useEffect(() => {
    setData(observable.current)
    return observable.subscribe(setData)
  }, [observable])

  return { data, isLoading: data.length === 0 && observable.current.length === 0 }
}

export function useInviteMember() {
  const connector = useGroupConnector()
  return useCallback(
    async (groupId: string, userId: string) => {
      return connector.inviteMember(groupId, userId)
    },
    [connector],
  )
}

export function useRemoveMember() {
  const connector = useGroupConnector()
  return useCallback(
    async (groupId: string, userId: string) => {
      return connector.removeMember(groupId, userId)
    },
    [connector],
  )
}
