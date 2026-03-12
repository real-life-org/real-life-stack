import type { VerificationDirection } from "@real-life-stack/data-interface"
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

export interface VerificationBadgeProps {
  status: VerificationDirection
  className?: string
}

const config: Record<VerificationDirection, { icon: typeof Shield; label: string; className: string } | null> = {
  mutual: { icon: ShieldCheck, label: "Gegenseitig verifiziert", className: "text-green-600 bg-green-500/10" },
  outgoing: { icon: Shield, label: "Von dir verifiziert", className: "text-blue-600 bg-blue-500/10" },
  incoming: { icon: ShieldAlert, label: "Hat dich verifiziert", className: "text-amber-600 bg-amber-500/10" },
  none: null,
}

export function VerificationBadge({ status, className }: VerificationBadgeProps) {
  const entry = config[status]
  if (!entry) return null

  const Icon = entry.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        entry.className,
        className
      )}
      title={entry.label}
    >
      <Icon className="h-3 w-3" />
      {entry.label}
    </span>
  )
}
