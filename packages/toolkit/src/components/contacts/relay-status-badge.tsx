import type { RelayState } from "@real-life-stack/data-interface"

import { cn } from "@/lib/utils"
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

const stateConfig: Record<RelayState, { color: string; label: string }> = {
  connected: { color: "bg-green-500", label: "Verbunden" },
  connecting: { color: "bg-amber-500 animate-pulse", label: "Verbindet…" },
  disconnected: { color: "bg-gray-400", label: "Getrennt" },
  error: { color: "bg-red-500", label: "Fehler" },
}

export function RelayStatusBadge({
  state,
  pendingCount = 0,
  className,
  onClick,
}: RelayStatusBadgeProps) {
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
            Relay: {config.label}
            {pendingCount > 0 && ` · ${pendingCount} ausstehend`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
