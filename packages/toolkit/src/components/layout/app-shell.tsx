"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface AppShellProps {
  children: React.ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className={cn("h-dvh flex flex-col bg-background overflow-hidden", className)}>
      {children}
    </div>
  )
}

interface AppShellMainProps {
  children: React.ReactNode
  className?: string
  /** Add padding at bottom for mobile bottom navigation */
  withBottomNav?: boolean
}

export function AppShellMain({
  children,
  className,
  withBottomNav = false,
}: AppShellMainProps) {
  return (
    <main
      className={cn(
        "@container flex-1 overflow-y-auto",
        "transition-[padding] duration-300 ease-out [.adaptive-panel-resizing_&]:transition-none",
        withBottomNav && "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0",
        className
      )}
      style={{
        paddingRight: "var(--adaptive-panel-margin-right, 0px)",
        paddingLeft: "var(--adaptive-panel-margin-left, 0px)",
      }}
    >
      {children}
    </main>
  )
}
