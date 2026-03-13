"use client"

import { Shield, UserPlus, Users } from "lucide-react"
import type { ContactInfo } from "@real-life-stack/data-interface"

import { Button } from "@/components/primitives/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/primitives/dialog"
import { ContactList } from "./contact-list"

export interface ContactsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeContacts: ContactInfo[]
  pendingContacts: ContactInfo[]
  onRemove: (id: string) => void
  onEditName: (id: string, name: string) => void
  onVerify: () => void
  onAdd: () => void
}

export function ContactsDialog({
  open,
  onOpenChange,
  activeContacts,
  pendingContacts,
  onRemove,
  onEditName,
  onVerify,
  onAdd,
}: ContactsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Kontakte
          </DialogTitle>
          <DialogDescription>
            {activeContacts.length} verifiziert · {pendingContacts.length} ausstehend
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 -mx-6 px-6">
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={onVerify}>
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Verifizieren
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={onAdd}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Hinzufügen
            </Button>
          </div>
          {pendingContacts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ausstehend</h3>
              <ContactList
                contacts={pendingContacts}
                onRemove={onRemove}
                onEditName={onEditName}
              />
            </div>
          )}
          <div className="space-y-2">
            {activeContacts.length > 0 && pendingContacts.length > 0 && (
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verifiziert</h3>
            )}
            <ContactList
              contacts={activeContacts}
              onRemove={onRemove}
              onEditName={onEditName}
              emptyMessage="Noch keine verifizierten Kontakte"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
