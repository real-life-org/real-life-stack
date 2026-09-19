import { useEffect, useMemo, useState } from "react"
import type { User } from "@real-life-stack/data-interface"
import { isAuthenticatable } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

/**
 * Anmeldung ist eine Fähigkeit, kein Muss (`Authenticatable`). Ein Connector,
 * der nur liest, hat keine — „niemand angemeldet" ist dann die wahre Antwort,
 * kein Fehler. Deshalb antworten die lesenden Hooks hier leer, statt zu werfen.
 * Nur `useCurrentUser` besteht weiter auf der Fähigkeit: wer den angemeldeten
 * Menschen ohne Fallunterscheidung braucht, soll es früh merken.
 */
function useAuthConnector() {
  const connector = useConnector()
  if (!isAuthenticatable(connector)) {
    throw new Error("Connector does not support authentication")
  }
  return connector
}

/**
 * Like {@link useCurrentUser}, but a connector without authentication yields no
 * user instead of throwing. For code that only needs to know *whether* someone
 * is signed in, e.g. permission checks on a read-only connector.
 */
export function useOptionalCurrentUser(): { data: User | null; isLoading: boolean } {
  const connector = useConnector()
  const observable = useMemo(
    () => (isAuthenticatable(connector) ? connector.observeCurrentUser() : null),
    [connector],
  )
  const [data, setData] = useState<User | null>(observable?.current ?? null)
  useEffect(() => {
    if (!observable) return
    setData(observable.current)
    return observable.subscribe(setData)
  }, [observable])
  return { data, isLoading: !!observable && data === null }
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
