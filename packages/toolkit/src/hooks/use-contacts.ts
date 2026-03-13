import { useEffect, useState, useCallback, useMemo } from "react"
import type { ContactInfo } from "@real-life-stack/data-interface"
import { hasContacts } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

const noop = () => Promise.resolve() as any

export function useContacts() {
  const connector = useConnector()
  const supportsContacts = hasContacts(connector)
  const observable = supportsContacts ? connector.observeContacts() : null
  const [contacts, setContacts] = useState<ContactInfo[]>(observable?.current ?? [])

  useEffect(() => {
    if (!observable) return
    setContacts(observable.current)
    return observable.subscribe(setContacts)
  }, [observable])

  const activeContacts = useMemo(
    () => contacts.filter((c) => c.status === "active"),
    [contacts]
  )

  const pendingContacts = useMemo(
    () => contacts.filter((c) => c.status === "pending"),
    [contacts]
  )

  const addContact = useCallback(
    supportsContacts
      ? (id: string, name?: string) => connector.addContact(id, name)
      : noop,
    [connector, supportsContacts]
  )

  const activateContact = useCallback(
    supportsContacts
      ? (id: string) => connector.activateContact(id)
      : noop,
    [connector, supportsContacts]
  )

  const updateContactName = useCallback(
    supportsContacts
      ? (id: string, name: string) => connector.updateContactName(id, name)
      : noop,
    [connector, supportsContacts]
  )

  const removeContact = useCallback(
    supportsContacts
      ? (id: string) => connector.removeContact(id)
      : noop,
    [connector, supportsContacts]
  )

  return {
    contacts,
    activeContacts,
    pendingContacts,
    addContact,
    activateContact,
    updateContactName,
    removeContact,
    supportsContacts,
  }
}
