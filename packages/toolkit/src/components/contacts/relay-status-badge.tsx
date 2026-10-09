import type { RelayState } from "@real-life/data-interface"

import { cn } from "@/lib/utils"
import { useI18n, type ToolkitMessageKey } from "@/i18n"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../primitives/tooltip"

export interface RelayStatusBadgeProps {
  state: RelayState
  pendingCount?: number
  className?: string
  onClick?: () => void
}

const stateConfig: Record<RelayState, { color: string; label: ToolkitMessageKey }> = {
  connected: { color: "bg-green-500", label: "relay.connected" },
  connecting: { color: "bg-amber-500 animate-pulse", label: "relay.connecting" },
  disconnected: { color: "bg-gray-400", label: "relay.disconnected" },
  error: { color: "bg-red-500", label: "relay.error" },
}

export function RelayStatusBadge({
  state,
  pendingCount = 0,
  className,
  onClick,
}: RelayStatusBadgeProps) {
  const { t } = useI18n()
  const config = stateConfig[state]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn("flex items-center gap-1.5", onClick ? "cursor-pointer" : "cursor-default", className)}
            onClick={onClick}
          >
            <span className={cn("h-2 w-2 rounded-full shrink-0", config.color)} />
            {pendingCount > 0 && (
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                {pendingCount}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            {t("relay.status", { state: t(config.label) })}
            {pendingCount > 0 && ` · ${t("relay.pending", { count: pendingCount })}`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
