import { useEffect, useMemo, useState } from "react"
import type { AuthState, User } from "@real-life-stack/data-interface"
import { isAuthenticatable } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

function useAuthConnector() {
  const connector = useConnector()
  if (!isAuthenticatable(connector)) {
    throw new Error("Connector does not support authentication")
  }
  return connector
}

export function useAuthState() {
  const connector = useAuthConnector()
  const observable = connector.getAuthState()
  const [data, setData] = useState<AuthState>(observable.current)

  useEffect(() => observable.subscribe(setData), [observable])

  return data
}

export function useCurrentUser() {
  const connector = useAuthConnector()
  const observable = useMemo(() => connector.observeCurrentUser(), [connector])
  const [data, setData] = useState<User | null>(observable.current)
  const [isLoading, setIsLoading] = useState(observable.current === null)

  useEffect(() => {
    setData(observable.current)
    return observable.subscribe((user) => {
      setData(user)
      setIsLoading(false)
    })
  }, [observable])

  return { data, isLoading }
}
