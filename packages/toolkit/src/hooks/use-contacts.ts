import { useEffect, useState, useCallback, useMemo } from "react"
import type { ContactInfo } from "@real-life-stack/data-interface"
import { hasContacts } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

function useContactConnector() {
  const connector = useConnector()
  if (!hasContacts(connector)) {
    throw new Error("Connector does not support contacts")
  }
  return connector
}

export function useContacts() {
  const connector = useContactConnector()
  const observable = connector.observeContacts()
  const [contacts, setContacts] = useState<ContactInfo[]>(observable.current)

  useEffect(() => observable.subscribe(setContacts), [observable])

  const activeContacts = useMemo(
    () => contacts.filter((c) => c.status === "active"),
    [contacts]
  )

  const pendingContacts = useMemo(
    () => contacts.filter((c) => c.status === "pending"),
    [contacts]
  )

  const addContact = useCallback(
    (id: string, name?: string) => connector.addContact(id, name),
    [connector]
  )

  const activateContact = useCallback(
    (id: string) => connector.activateContact(id),
    [connector]
  )

  const updateContactName = useCallback(
    (id: string, name: string) => connector.updateContactName(id, name),
    [connector]
  )

  const removeContact = useCallback(
    (id: string) => connector.removeContact(id),
    [connector]
  )

  return {
    contacts,
    activeContacts,
    pendingContacts,
    addContact,
    activateContact,
    updateContactName,
    removeContact,
  }
}
