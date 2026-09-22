import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Inbox, MoreVertical, Pencil, Share2, Trash2 } from "lucide-react"
import { Button } from "./button"
import { EmptyState } from "./empty-state"
import { Skeleton } from "./skeleton"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "./dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./dropdown-menu"

/**
 * **The four surfaces that occur everywhere.**
 *
 * No module builds them itself: an empty state looks the same in the feed as
 * on the map, a menu behaves the same in a card header as in the user menu.
 *
 * For dialogs one rule holds in the stack: they are for decisions that may
 * interrupt the flow (delete, invite, confirm). Everything that belongs to
 * carrying on belongs into the shared panel, not into a dialog.
 */

const meta: Meta = {
  id: "rls-foundations-surfaces",
  title: "RLS/Foundations/UI primitives/Surfaces",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta
type Story = StoryObj

/** Nothing there: with a reason and, where possible, a way out. */
export const Empty: Story = {
  name: "Empty state",
  render: () => (
    <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
      <div className="rounded-xl border bg-card">
        <EmptyState icon={Inbox} title="Noch keine Beiträge" description="Schreib den ersten, oder lade jemanden ein." action={<Button size="sm">Beitrag schreiben</Button>} />
      </div>
      <div className="rounded-xl border bg-card">
        <EmptyState icon={Inbox} title="Nichts passt zur Suche" description="Andere Worte oder weniger Filter." />
      </div>
    </div>
  ),
}

/** While loading: the same shape as afterwards, so nothing jumps. */
export const LoadingBlock: Story = {
  name: "Loading block",
  render: () => (
    <div className="mx-auto max-w-md space-y-3 rounded-xl border bg-card p-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  ),
}

/** A decision that may interrupt. Here: delete. */
export const DialogSurface: Story = {
  name: "Dialog",
  render: function Render() {
    const [gelöscht, setGelöscht] = useState(false)
    return (
      <div className="mx-auto max-w-md">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Item löschen</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Erntefest löschen?</DialogTitle>
              <DialogDescription>
                Das Item verschwindet für alle im Space. Kommentare und Reaktionen gehen mit.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">Abbrechen</Button>
              <Button variant="destructive" onClick={() => setGelöscht(true)}>Löschen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {gelöscht && <p className="mt-3 text-sm text-muted-foreground">Gelöscht (nur in dieser Story).</p>}
      </div>
    )
  },
}

/** Actions on exactly one thing. In the stack always behind ⋮, never as a row of buttons. */
export const MenuSurface: Story = {
  name: "Dropdown menu",
  render: () => (
    <div className="mx-auto max-w-md">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Aktionen">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="gap-2"><Pencil className="h-4 w-4" />Bearbeiten</DropdownMenuItem>
          <DropdownMenuItem className="gap-2"><Share2 className="h-4 w-4" />Teilen</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="gap-2"><Trash2 className="h-4 w-4" />Löschen</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="mt-3 text-xs text-muted-foreground">
        Dieselbe Form wie in `ItemDetailActions`; dort entscheidet `useItemPermissions`, welche Einträge erscheinen.
      </p>
    </div>
  ),
}
