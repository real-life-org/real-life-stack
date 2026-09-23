import { useEffect, useState } from "react"
import type { RelayState } from "@real-life-stack/data-interface"
import { hasMessaging } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

function useMessagingConnector() {
  const connector = useConnector()
  if (!hasMessaging(connector)) {
    throw new Error("Connector does not support messaging")
  }
  return connector
}

/**
 * Is this device attached to the relay, is anything unsent waiting?
 *
 * @answers `{state, isConnected, pendingCount}`
 * @without throws on render
 * @group environment
 * @see story rls-foundations-hooks--environment
 * @see spec docs/spec/11-runtime-config-und-branding.md
 */
export function useRelayStatus() {
  const connector = useMessagingConnector()

  const relayObs = connector.getRelayState()
  const outboxObs = connector.getOutboxPendingCount()

  const [state, setState] = useState<RelayState>(relayObs.current)
  const [pendingCount, setPendingCount] = useState<number>(outboxObs.current)

  useEffect(() => relayObs.subscribe(setState), [relayObs])
  useEffect(() => outboxObs.subscribe(setPendingCount), [outboxObs])

  return {
    state,
    isConnected: state === "connected",
    pendingCount,
    hasPending: pendingCount > 0,
  }
}
