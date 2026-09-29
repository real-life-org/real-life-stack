import { useEffect, useRef, useState } from "react"
import { isAuthenticatable, type User } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

/**
 * For which ids do I know a name?
 *
 * Fallback author resolution: some ids are not in the current member list
 * (e.g. a membership entry that has not synced yet) although the connector
 * CAN resolve them — WoT cascades own profile → verified contacts →
 * discovery. Never show a raw DID when a name is one lookup away.
 *
 * @answers `Map<string, User>`
 * @without empty — map
 * @group people
 * @see story rls-foundations-hooks--people
 * @see spec docs/spec/04-items-relations-groups-spaces.md
 */
export function useResolvedUsers(ids: readonly string[]): ReadonlyMap<string, User> {
  const connector = useConnector()
  const [resolved, setResolved] = useState<ReadonlyMap<string, User>>(new Map())
  // Laufende Anfragen gehören dem Connector, nicht dem einzelnen Effect: Eine
  // Antwort gilt, solange die Komponente steht und der Connector derselbe ist.
  // Vorher verwarf das Aufräumen eines Effects die Antwort, während die Id als
  // „laufend" stehen blieb — bei A → B → A kam der Name nie an (Codex-Review
  // Runde 1 zu #569, auch unter StrictMode).
  const pending = useRef({ connector, ids: new Set<string>() })
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!isAuthenticatable(connector)) return
    if (pending.current.connector !== connector) pending.current = { connector, ids: new Set() }
    const laufend = pending.current.ids
    for (const id of ids) {
      if (resolved.has(id) || laufend.has(id)) continue
      laufend.add(id)
      void connector.getUser(id).then((user) => {
        laufend.delete(id)
        if (!mounted.current || pending.current.connector !== connector) return
        if (!user || !user.displayName || user.displayName === id) return
        setResolved((current) => {
          const next = new Map(current)
          next.set(id, user)
          return next
        })
      }).catch(() => laufend.delete(id))
    }
  }, [connector, ids, resolved])

  return resolved
}
