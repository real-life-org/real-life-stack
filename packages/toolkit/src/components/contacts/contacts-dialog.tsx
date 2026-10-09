"use client"

import { QrCode, UserPlus, Users } from "lucide-react"
import type { ContactInfo } from "@real-life/data-interface"

import { Button } from "@/components/primitives/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/primitives/dialog"
import { Skeleton } from "@/components/primitives/skeleton"
import { ContactList } from "./contact-list"
import { useI18n } from "@/i18n"

export interface ContactsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeContacts: ContactInfo[]
  pendingContacts: ContactInfo[]
  /** True while the first contacts read is still in flight (shows a skeleton). */
  isLoading?: boolean
  onRemove: (id: string) => void
  onEditName: (id: string, name: string) => void
  /** WoT-Pfad: QR-Verifikation starten. Optional — Server-Connectoren ohne
      Begegnungs-Verifikation lassen den Button weg. */
  onVerify?: () => void
  /** Anfrage-Pfad: "Kontakt hinzufügen" (ID/Profil-Link einfügen). */
  onAdd?: () => void
  /** Bestätigt eine eingehende Anfrage (direction "incoming"). */
  onActivate?: (id: string) => void
  /** Status-Wording für aktive Kontakte — "Verifiziert" (WoT) oder "Aktiv". */
  activeLabel?: string
}

export function ContactsDialog({
  open,
  onOpenChange,
  activeContacts,
  pendingContacts,
  isLoading = false,
  onRemove,
  onEditName,
  onVerify,
  onAdd,
  onActivate,
  activeLabel: activeLabelProp,
}: ContactsDialogProps) {
  const { t } = useI18n()
  const activeLabel = activeLabelProp ?? t("contacts.active")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80dvh] flex flex-col" errorLabel={t("contacts.errorLabel")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("contacts.title")}
          </DialogTitle>
          <DialogDescription>
            {t("contacts.summary", {
              active: activeContacts.length,
              label: activeLabel.toLowerCase(),
              pending: pendingContacts.length,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 -mx-6 px-6">
          {onVerify && (
            <Button size="sm" className="w-full" onClick={onVerify}>
              <QrCode className="h-3.5 w-3.5 mr-1.5" />
              {t("verification.title")}
            </Button>
          )}
          {onAdd && (
            <Button size="sm" variant={onVerify ? "outline" : "default"} className="w-full" onClick={onAdd}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              {t("addContact.title")}
            </Button>
          )}
          {isLoading ? (
            <div className="space-y-2" aria-hidden>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`contact-skeleton-${i}`} className="flex items-center gap-3 px-1 py-1.5">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {pendingContacts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("contacts.pending")}</h3>
                  <ContactList
                    contacts={pendingContacts}
                    onRemove={onRemove}
                    onEditName={onEditName}
                    onActivate={onActivate}
                    activeLabel={activeLabel}
                  />
                </div>
              )}
              <div className="space-y-2">
                {activeContacts.length > 0 && pendingContacts.length > 0 && (
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{activeLabel}</h3>
                )}
                <ContactList
                  contacts={activeContacts}
                  onRemove={onRemove}
                  onEditName={onEditName}
                  activeLabel={activeLabel}
                  emptyMessage={t("contacts.empty")}
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
