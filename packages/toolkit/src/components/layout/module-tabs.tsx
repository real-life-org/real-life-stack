"use client"

import { cn } from "@/lib/utils"
import type { ModuleEntry } from "@/lib/module-register"

/**
 * Was ein Tab braucht — abgeleitet vom Registereintrag (Spec 01), damit es
 * keinen zweiten Icon-Vertrag gibt.
 */
export type Module = Pick<ModuleEntry, "id" | "label" | "icon">

interface ModuleTabsProps {
  modules: Module[]
  activeModule: string
  onModuleChange: (moduleId: string) => void
  className?: string
}

export function ModuleTabs({
  modules,
  activeModule,
  onModuleChange,
  className,
}: ModuleTabsProps) {
  return (
    <nav className={cn("hidden md:flex items-center gap-1", className)}>
      {modules.map((module) => {
        const Icon = module.icon
        const isActive = activeModule === module.id

        return (
          <button
            key={module.id}
            onClick={() => onModuleChange(module.id)}
            title={module.label}
            aria-label={module.label}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {/* Auf Tablet-Breite nur die Symbole: sieben Tabs mit Text passen
                neben Space-Umschalter und Menue erst ab lg — davor liefen
                sie in den Space-Namen. Das Symbol traegt den Namen als Titel. */}
            <span className="hidden lg:inline">{module.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
