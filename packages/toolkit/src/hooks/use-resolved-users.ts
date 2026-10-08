import { useEffect, useRef, useState } from "react"
import { isAuthenticatable, type DataInterface, type User } from "@real-life/data-interface"
import { useConnector } from "./connector-context"

interface Aufloesung {
  connector: DataInterface
  users: ReadonlyMap<string, User>
}

interface Anfragen {
  connector: DataInterface
  laufend: Set<string>
}

const LEER: ReadonlyMap<string, User> = new Map()

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
  // Vertrag (Codex-Review Runden 1 und 2 zu #569): Ergebnisse und laufende
  // Anfragen gehören genau EINEM Connector. Jeder Wechsel — auch zu einem ohne
  // Auth — legt einen neuen Anfragebehälter an; eine Antwort zählt nur, wenn
  // ihr Behälter noch der aktuelle ist und die Komponente steht. Ergebnisse
  // eines anderen Connectors werden nie gezeigt. Das Aufräumen eines Effects
  // verwirft dagegen nichts: Sonst blieb bei A → B → A (oder unter StrictMode)
  // eine Id „laufend", und ihr Name kam nie an.
  const [aufloesung, setAufloesung] = useState<Aufloesung>({ connector, users: LEER })
  const resolved = aufloesung.connector === connector ? aufloesung.users : LEER
  const anfragen = useRef<Anfragen>({ connector, laufend: new Set() })
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (anfragen.current.connector !== connector) anfragen.current = { connector, laufend: new Set() }
    if (!isAuthenticatable(connector)) return
    const behaelter = anfragen.current
    for (const id of ids) {
      if (resolved.has(id) || behaelter.laufend.has(id)) continue
      behaelter.laufend.add(id)
      void connector.getUser(id).then((user) => {
        behaelter.laufend.delete(id)
        if (!mounted.current || anfragen.current !== behaelter) return
        if (!user || !user.displayName || user.displayName === id) return
        setAufloesung((current) => {
          const users = new Map(current.connector === connector ? current.users : LEER)
          users.set(id, user)
          return { connector, users }
        })
      }).catch(() => behaelter.laufend.delete(id))
    }
  }, [connector, ids, resolved])

  return resolved
}
