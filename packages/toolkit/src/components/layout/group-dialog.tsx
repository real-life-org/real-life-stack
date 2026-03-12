import { useState, useCallback } from "react"
import { Trash2, UserMinus, UserPlus } from "lucide-react"
import type { Group, User } from "@real-life-stack/data-interface"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../primitives/dialog"
import { Button } from "../primitives/button"
import { Input } from "../primitives/input"
import { Label } from "../primitives/label"
import { Separator } from "../primitives/separator"
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar"

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

// --- Types ---

export type GroupDialogMode =
  | { type: "create" }
  | { type: "edit"; group: Group; members: User[] }

export interface GroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: GroupDialogMode
  onCreateGroup: (name: string) => Promise<void>
  onUpdateGroup: (id: string, updates: Partial<Group>) => Promise<void>
  onDeleteGroup: (id: string) => Promise<void>
  onInviteMember?: (groupId: string, userId: string) => Promise<void>
  onRemoveMember?: (groupId: string, userId: string) => Promise<void>
}

// --- Component ---

export function GroupDialog({
  open,
  onOpenChange,
  mode,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onInviteMember,
  onRemoveMember,
}: GroupDialogProps) {
  const isEdit = mode.type === "edit"

  const [name, setName] = useState(() =>
    isEdit ? mode.group.name : ""
  )
  const [inviteId, setInviteId] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens/closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setConfirmDelete(false)
        setError(null)
        setInviteId("")
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange],
  )

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await onUpdateGroup(mode.group.id, { name: name.trim() })
      } else {
        await onCreateGroup(name.trim())
      }
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!isEdit) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onDeleteGroup(mode.group.id)
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Loeschen")
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  const handleInvite = async () => {
    if (!isEdit || !onInviteMember || !inviteId.trim()) return
    setError(null)
    try {
      await onInviteMember(mode.group.id, inviteId.trim())
      setInviteId("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Einladen")
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!isEdit || !onRemoveMember) return
    setError(null)
    try {
      await onRemoveMember(mode.group.id, userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Entfernen")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Gruppe bearbeiten" : "Neue Gruppe"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Name und Mitglieder der Gruppe verwalten."
              : "Erstelle eine neue Gruppe fuer dein Team."}
          </DialogDescription>
        </DialogHeader>

        {/* Group Name */}
        <div className="space-y-2">
          <Label htmlFor="group-name">Name</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Nachbarschaft, Projekt-Team..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSave()
              }
            }}
          />
        </div>

        {/* Members Section (edit only) */}
        {isEdit && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label>Mitglieder ({mode.members.length})</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {mode.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
                  >
                    <Avatar className="h-8 w-8">
                      {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                      <AvatarFallback className="text-xs">
                        {getInitials(member.displayName ?? member.id)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm">
                      {member.displayName ?? member.id}
                    </span>
                    {onRemoveMember && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveMember(member.id)}
                        title="Mitglied entfernen"
                      >
                        <UserMinus className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                ))}
                {mode.members.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">
                    Noch keine Mitglieder
                  </p>
                )}
              </div>

              {/* Invite */}
              {onInviteMember && (
                <div className="flex gap-2">
                  <Input
                    value={inviteId}
                    onChange={(e) => setInviteId(e.target.value)}
                    placeholder="User-ID oder DID eingeben..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleInvite()
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInvite}
                    disabled={!inviteId.trim()}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Footer */}
        <DialogFooter className="gap-2 sm:gap-0">
          {isEdit && (
            <Button
              variant={confirmDelete ? "destructive" : "ghost"}
              size="sm"
              onClick={handleDelete}
              disabled={saving}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {confirmDelete ? "Wirklich loeschen?" : "Loeschen"}
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Speichern..." : isEdit ? "Speichern" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
