"use client"

import { ChevronsUpDown } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/primitives/dropdown-menu"

export interface ConnectorOption {
  id: string
  name: string
  description?: string
}

interface ConnectorSwitcherProps {
  connectors: ConnectorOption[]
  activeConnector: string
  onConnectorChange: (connectorId: string) => void
}

export function ConnectorSwitcher({
  connectors,
  activeConnector,
  onConnectorChange,
}: ConnectorSwitcherProps) {
  const active = connectors.find((c) => c.id === activeConnector)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-mono bg-background/80 backdrop-blur-sm border border-border shadow-lg hover:bg-accent transition-colors cursor-pointer">
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
        <span className="font-semibold">{active?.name ?? activeConnector}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Connector wechseln (Dev)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {connectors.map((connector) => (
          <DropdownMenuItem
            key={connector.id}
            onClick={() => onConnectorChange(connector.id)}
            className="flex flex-col items-start gap-0.5"
          >
            <span className={connector.id === activeConnector ? "font-semibold" : ""}>
              {connector.id === activeConnector ? `● ${connector.name}` : connector.name}
            </span>
            {connector.description && (
              <span className="text-xs text-muted-foreground">{connector.description}</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
