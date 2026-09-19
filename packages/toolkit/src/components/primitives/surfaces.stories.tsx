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
 * **Die vier Flächen, die überall vorkommen.**
 *
 * Kein Modul baut sie selbst: Ein leerer Zustand sieht im Feed aus wie auf der
 * Karte, ein Menü verhält sich im Kartenkopf wie im Benutzermenü. Sie standen
 * bisher in keiner Story, obwohl fast jede Fläche sie benutzt.
 *
 * Für Dialoge gilt im Stack eine Regel: Sie sind für Entscheidungen da, die
 * den Arbeitsfluss unterbrechen dürfen (löschen, einladen, bestätigen). Alles,
 * was zum Weiterarbeiten gehört, gehört ins geteilte Panel, nicht in einen
 * Dialog.
 */

const meta: Meta = {
  id: "rls-grundlagen-flaechen",
  title: "RLS/Grundlagen/UI-Primitives/Flächen",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta
type Story = StoryObj

/** Nichts da: mit Grund und, wenn möglich, mit einem Ausweg. */
export const Leerzustand: Story = {
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

/** Solange geladen wird: dieselbe Form wie danach, damit nichts springt. */
export const Ladeblock: Story = {
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

/** Eine Entscheidung, die unterbrechen darf. Hier: löschen. */
export const DialogFlaeche: Story = {
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

/** Aktionen zu genau einem Ding. Im Stack immer hinter ⋮, nie als Knopfreihe. */
export const Menue: Story = {
  name: "Dropdown-Menü",
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
