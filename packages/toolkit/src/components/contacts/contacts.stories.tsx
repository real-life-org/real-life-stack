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
 * **Kontakte und Verifikation.**
 *
 * Hier wird aus einer Begegnung eine Beziehung, die das Netzwerk trägt. Der
 * Ablauf hat zwei Wege, und beide enden am selben Ort:
 *
 * 1. **Begegnung mit QR.** Zwei Menschen stehen voreinander. Eine Seite zeigt
 *    einen Code, die andere scannt ihn. Beide bestätigen, dass sie einander
 *    als diese Person erlebt haben. Das ist die Verifikation im Sinne des
 *    Netzwerkprotokolls, und sie geschieht in der Regel einmal je Beziehung.
 * 2. **Anfrage aus der Ferne.** Jemand fügt eine Kennung ein, die Gegenseite
 *    bekommt eine Anfrage und bestätigt sie. Ohne gemeinsame Begegnung, also
 *    ohne die Aussage „ich habe diesen Menschen erlebt".
 *
 * Die Dialoge tragen keinen eigenen Zustand über den Vorgang hinaus: Was
 * offen ist, entscheidet die App, und `useIncomingEvents` reicht ihr den
 * nächsten hereingekommenen Vorgang durch. Alle sind bewusst einzeln
 * aufrufbar, weil sie auch einzeln erscheinen.
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
  title: "RLS/App Shell/Kontakte und Verifikation",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="min-h-screen bg-background p-8">{Story()}</div>],
}

export default meta
type Story = StoryObj

/** Die Liste: aktive Kontakte, offene Anfragen in beide Richtungen. */
export const Liste: Story = {
  name: "Kontaktliste",
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

/** Der Einstieg aus dem Benutzermenü: alles, was mit Kontakten zu tun hat, an einem Ort. */
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

/** Jemanden über seine Kennung anfragen. Der zweite Weg, ohne Begegnung. */
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

/** Der QR-Weg, meine Seite: ich zeige den Code, die Gegenseite scannt. */
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

/** Der QR-Weg, ihre Seite: jemand hat meinen Code gescannt und wartet auf mich. */
export const EingehendeVerifikation: Story = {
  name: "Eingehend · Verifikation",
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

/** Eine Kontaktanfrage aus der Ferne, die auf meine Antwort wartet. */
export const EingehendeAnfrage: Story = {
  name: "Eingehend · Kontaktanfrage",
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

/** Eine Einladung in einen Space. Derselbe Ort, andere Bedeutung. */
export const EingehendeEinladung: Story = {
  name: "Eingehend · Space-Einladung",
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
 * Der Abschluss: beide Seiten haben bestätigt. Zwei Bedeutungen, eine Form —
 * nach einer Begegnung („verification") oder nach einer Anfrage („contact").
 */
export const Gegenseitig: Story = {
  name: "Gegenseitig bestätigt",
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
 * Der Relais-Zustand. Er gehört hierher, weil ohne Verbindung keine Anfrage
 * ankommt: Die Zahl sagt, wieviel noch auf dem Gerät wartet.
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
