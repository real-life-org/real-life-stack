import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ContactInfo } from "@real-life-stack/data-interface"
import { ContactsDialog } from "./contacts-dialog"
import { AddContactDialog } from "./add-contact-dialog"
import { VerificationDialog } from "./verification-dialog"
import { IncomingVerificationDialog } from "./incoming-verification-dialog"
import { IncomingContactRequestDialog } from "./incoming-contact-request-dialog"
import { IncomingSpaceInviteDialog } from "./incoming-space-invite-dialog"
import { MutualVerificationDialog } from "./mutual-verification-dialog"
import { RelayStatusBadge } from "./relay-status-badge"
import { ContactList } from "./contact-list"
import { Button } from "../primitives/button"

/**
 * **Contacts and verification.**
 *
 * This is where an encounter becomes a relationship the network carries. The
 * flow has two ways, and both end in the same place:
 *
 * 1. **Encounter with QR.** Two people stand in front of each other. One side
 *    shows a code, the other scans it. Both confirm that they have met each
 *    other as this person. That is verification in the sense of the network
 *    protocol, and it usually happens once per relationship.
 * 2. **Request from afar.** Someone pastes an id, the other side receives a
 *    request and confirms it. Without a shared encounter, so without the
 *    statement "I have met this person".
 *
 * The dialogs carry no state beyond the step at hand: what is open is decided
 * by the frame, and `useIncomingEvents` hands it the next incoming event.
 * All of them can be called on their own, because they also appear on their
 * own. Whether the menu offers contacts and verification at all is said by
 * the connector's capabilities.
 */

const ZEIT = { createdAt: "2026-09-01T10:00:00+02:00", updatedAt: "2026-09-01T10:00:00+02:00" }
const KONTAKTE: ContactInfo[] = [
  { ...ZEIT, id: "did:key:z6MkiA5J", name: "Jonas Klein", status: "active" },
  { ...ZEIT, id: "did:key:z6MkfQ2T", name: "Lea Weber", status: "active", avatar: "https://randomuser.me/api/portraits/women/68.jpg" },
  { ...ZEIT, id: "did:key:z6MkpL9R", name: "Timo Richter", status: "pending", direction: "incoming" },
  { ...ZEIT, id: "did:key:z6MkwX4B", name: "Clara Hoffmann", status: "pending", direction: "outgoing" },
]

const meta: Meta = {
  id: "rls-app-shell-kontakte",
  title: "RLS/App shell/Contacts and verification",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="min-h-screen bg-background p-8">{Story()}</div>],
}

export default meta
type Story = StoryObj

/** The list: active contacts, open requests in both directions. */
export const Liste: Story = {
  name: "Contact list",
  render: function Render() {
    const [kontakte, setKontakte] = useState(KONTAKTE)
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-card p-4">
        <ContactList
          contacts={kontakte}
          onRemove={(id) => setKontakte((k) => k.filter((c) => c.id !== id))}
          onEditName={(id, name) => setKontakte((k) => k.map((c) => (c.id === id ? { ...c, name } : c)))}
        />
      </div>
    )
  },
}

/** The entry from the user menu: everything to do with contacts in one place. */
export const Uebersicht: Story = {
  name: "ContactsDialog",
  render: function Render() {
    const [open, setOpen] = useState(true)
    const [kontakte, setKontakte] = useState(KONTAKTE)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Kontakte öffnen</Button>
        <ContactsDialog
          open={open}
          onOpenChange={setOpen}
          activeContacts={kontakte.filter((c) => c.status === "active")}
          pendingContacts={kontakte.filter((c) => c.status === "pending")}
          onRemove={(id) => setKontakte((k) => k.filter((c) => c.id !== id))}
          onEditName={(id, name) => setKontakte((k) => k.map((c) => (c.id === id ? { ...c, name } : c)))}
          onVerify={() => {}}
          onAdd={() => {}}
        />
      </>
    )
  },
}

/** Request someone by their id. The second way, without an encounter. */
export const Hinzufuegen: Story = {
  name: "AddContactDialog",
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Kontakt hinzufügen</Button>
        <AddContactDialog open={open} onOpenChange={setOpen} onAdd={async () => {}} />
      </>
    )
  },
}

/** The QR way, my side: I show the code, the other side scans. */
export const Verifizieren: Story = {
  name: "VerificationDialog",
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Verifikation starten</Button>
        <VerificationDialog
          open={open}
          onOpenChange={setOpen}
          challenge={{ code: "did:key:z6MkiA5JmiT3c9fVYPbFcR5bBeispiel#4821", nonce: "4821" }}
          peerInfo={null}
          isProcessing={false}
          error={null}
          onCreateChallenge={async () => {}}
          onScanChallenge={async () => {}}
          onConfirmVerification={async () => {}}
          onReset={() => {}}
        />
      </>
    )
  },
}

/** The QR way, their side: someone scanned my code and is waiting for me. */
export const EingehendeVerifikation: Story = {
  name: "Incoming · verification",
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Anfrage zeigen</Button>
        <IncomingVerificationDialog
          open={open}
          fromId="did:key:z6MkfQ2T"
          fromName="Lea Weber"
          fromAvatar="https://randomuser.me/api/portraits/women/68.jpg"
          onConfirm={async () => setOpen(false)}
          onReject={() => setOpen(false)}
        />
      </>
    )
  },
}

/** A contact request from afar, waiting for my answer. */
export const EingehendeAnfrage: Story = {
  name: "Incoming · contact request",
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Anfrage zeigen</Button>
        <IncomingContactRequestDialog
          open={open}
          requestKey="anfrage-1"
          fromId="did:key:z6MkpL9R"
          fromName="Timo Richter"
          onConfirm={async () => setOpen(false)}
          onDismiss={() => setOpen(false)}
        />
      </>
    )
  },
}

/** An invitation into a space. Same place, different meaning. */
export const EingehendeEinladung: Story = {
  name: "Incoming · space invitation",
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Einladung zeigen</Button>
        <IncomingSpaceInviteDialog
          open={open}
          spaceName="Gemeinschaftsgarten"
          inviterName="Mira Beispiel"
          onOpen={() => setOpen(false)}
          onDismiss={() => setOpen(false)}
        />
      </>
    )
  },
}

/**
 * The conclusion: both sides have confirmed. Two meanings, one shape — after
 * an encounter ("verification") or after a request ("contact").
 */
export const Gegenseitig: Story = {
  name: "Mutually confirmed",
  render: function Render() {
    const [variante, setVariante] = useState<"verification" | "contact">("verification")
    const [open, setOpen] = useState(true)
    return (
      <>
        <div className="flex gap-2">
          <Button onClick={() => { setVariante("verification"); setOpen(true) }}>Nach Begegnung</Button>
          <Button variant="outline" onClick={() => { setVariante("contact"); setOpen(true) }}>Nach Anfrage</Button>
        </div>
        <MutualVerificationDialog
          open={open}
          variant={variante}
          peerName="Lea Weber"
          peerAvatar="https://randomuser.me/api/portraits/women/68.jpg"
          myName="Mira Beispiel"
          myAvatar="https://randomuser.me/api/portraits/women/44.jpg"
          onDismiss={() => setOpen(false)}
        />
      </>
    )
  },
}

/**
 * The relay state. It belongs here because without a connection no request
 * arrives: the number says how much is still waiting on the device.
 */
export const Relais: Story = {
  name: "RelayStatusBadge",
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <RelayStatusBadge state="connected" />
      <RelayStatusBadge state="connecting" />
      <RelayStatusBadge state="disconnected" pendingCount={3} />
      <RelayStatusBadge state="error" pendingCount={12} />
    </div>
  ),
}
