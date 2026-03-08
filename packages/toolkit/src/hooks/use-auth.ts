import { useEffect, useState } from "react"
import type { AuthState, User } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

export function useAuthState() {
  const connector = useConnector()
  const observable = connector.getAuthState()
  const [data, setData] = useState<AuthState>(observable.current)

  useEffect(() => observable.subscribe(setData), [observable])

  return data
}

export function useCurrentUser() {
  const connector = useConnector()
  const [data, setData] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    connector.getCurrentUser().then((user) => {
      setData(user)
      setIsLoading(false)
    })
  }, [connector])

  return { data, isLoading }
}
