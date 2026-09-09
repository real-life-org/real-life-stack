import { Skeleton } from "../primitives/skeleton"
import { cn } from "../../lib/utils"

/**
 * Ladeplatzhalter in der Form von {@link ItemDetailBody} — Kopfzeile, Titel,
 * Meta-Box, Text.
 *
 * Er traegt bewusst dieselbe Anatomie wie die geladene Ansicht: Sonst springt
 * das Layout in dem Moment, in dem das Item ankommt. Und er traegt bewusst
 * keinen eigenen Rahmen — das Panel ist die Karte.
 *
 * Nicht zu verwechseln mit dem Leerzustand: Der erscheint, wenn geladen wurde
 * und nichts da ist.
 */
export function ItemDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 p-4", className)} aria-hidden>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-6 w-3/4" />
      <div className="space-y-2 rounded-lg border bg-muted px-3 py-2.5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="ml-auto h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}
