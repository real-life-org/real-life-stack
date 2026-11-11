import { useI18n } from "@/i18n"
import { Bell } from "lucide-react"

export interface ActivityBellProps { open: boolean; onOpenChange(open: boolean): void }

export function ActivityBell({ open, onOpenChange }: ActivityBellProps) {
  const { t } = useI18n()
  return <button type="button" aria-label={t("activity.title")} aria-expanded={open} aria-controls="activity-panel" className="cursor-pointer rounded-md p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" onClick={() => onOpenChange(!open)}><Bell className="size-5" aria-hidden /></button>
}
