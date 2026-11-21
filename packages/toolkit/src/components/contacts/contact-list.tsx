import type { ContactInfo } from "@real-life/data-interface"
import { Users } from "lucide-react"

import { ContactCard } from "./contact-card"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n"

export interface ContactListProps {
  contacts: ContactInfo[]
  onRemove?: (id: string) => void
  onEditName?: (id: string, name: string) => void
  onActivate?: (id: string) => void
  activeLabel?: string
  emptyMessage?: string
  className?: string
}

export function ContactList({
  contacts,
  onRemove,
  onEditName,
  onActivate,
  activeLabel,
  emptyMessage,
  className,
}: ContactListProps) {
  const { t } = useI18n()
  if (contacts.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-muted-foreground", className)}>
        <Users className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">{emptyMessage ?? t("contacts.empty")}</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {contacts.map((contact) => (
        <ContactCard
          key={contact.id}
          contact={contact}
          onRemove={onRemove}
          onEditName={onEditName}
          onActivate={onActivate}
          activeLabel={activeLabel}
        />
      ))}
    </div>
  )
}
