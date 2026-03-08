import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { DataInterface } from "@real-life-stack/data-interface"

const ConnectorContext = createContext<DataInterface | null>(null)

export interface ConnectorProviderProps {
  connector: DataInterface
  children: ReactNode
}

export function ConnectorProvider({ connector, children }: ConnectorProviderProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let disposed = false
    connector.init().then(() => {
      if (!disposed) setReady(true)
    })
    return () => {
      disposed = true
      connector.dispose()
    }
  }, [connector])

  if (!ready) return null

  return <ConnectorContext value={connector}>{children}</ConnectorContext>
}

export function useConnector(): DataInterface {
  const connector = useContext(ConnectorContext)
  if (!connector) {
    throw new Error("useConnector must be used within a ConnectorProvider")
  }
  return connector
}
