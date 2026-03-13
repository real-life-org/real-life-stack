import { useState, useCallback } from "react"
import { Trash2, UserMinus, UserPlus, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import type { Group, User, ContactInfo } from "@real-life-stack/data-interface"
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

/** Human-readable fallback for raw IDs (e.g. DIDs) */
function shortName(id: string): string {
  return `User-${id.slice(-6)}`
}

// --- Types ---

export type GroupDialogMode =
  | { type: "create" }
  | { type: "edit"; group: Group; members: User[] }

export interface GroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: GroupDialogMode
  contacts?: ContactInfo[]
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
  contacts,
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
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Invite state
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [inviteErrors, setInviteErrors] = useState<Map<string, string>>(new Map())
  const [showManualDid, setShowManualDid] = useState(false)
  const [manualDid, setManualDid] = useState("")

  // Reset state when dialog opens/closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setConfirmDelete(false)
        setError(null)
        setInvitingId(null)
        setInvitedIds(new Set())
        setInviteErrors(new Map())
        setShowManualDid(false)
        setManualDid("")
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

  const handleInviteContact = async (contactId: string) => {
    if (!isEdit || !onInviteMember) return
    setInvitingId(contactId)
    setInviteErrors((prev) => { const m = new Map(prev); m.delete(contactId); return m })
    try {
      await onInviteMember(mode.group.id, contactId)
      setInvitedIds((prev) => new Set([...prev, contactId]))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Einladung fehlgeschlagen"
      setInviteErrors((prev) => new Map([...prev, [contactId, msg]]))
    } finally {
      setInvitingId(null)
    }
  }

  const handleManualInvite = async () => {
    if (!isEdit || !onInviteMember || !manualDid.trim()) return
    setInvitingId("manual")
    setError(null)
    try {
      await onInviteMember(mode.group.id, manualDid.trim())
      setInvitedIds((prev) => new Set([...prev, manualDid.trim()]))
      setManualDid("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Einladung fehlgeschlagen")
    } finally {
      setInvitingId(null)
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

  // Filter contacts: only active, not already members, not already invited
  const memberIds = isEdit ? new Set(mode.members.map((m) => m.id)) : new Set<string>()
  const invitableContacts = (contacts ?? []).filter(
    (c) => c.status === "active" && !memberIds.has(c.id) && !invitedIds.has(c.id)
  )
  const justInvitedContacts = (contacts ?? []).filter(
    (c) => invitedIds.has(c.id) && !memberIds.has(c.id)
  )

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
                        {getInitials(member.displayName ?? shortName(member.id))}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm">
                      {member.displayName ?? shortName(member.id)}
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

              {/* Just invited (success feedback) */}
              {justInvitedContacts.length > 0 && (
                <div className="space-y-1">
                  {justInvitedContacts.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg p-2 bg-green-500/5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-green-500/10 text-green-700">
                          {getInitials(c.name ?? shortName(c.id))}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate text-sm">{c.name ?? shortName(c.id)}</span>
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                  ))}
                </div>
              )}

              {/* Contact Picker */}
              {onInviteMember && invitableContacts.length > 0 && (
                <>
                  <Label className="text-muted-foreground">Kontakt einladen</Label>
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {invitableContacts.map((contact) => {
                      const isInviting = invitingId === contact.id
                      const inviteError = inviteErrors.get(contact.id)
                      return (
                        <div key={contact.id}>
                          <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(contact.name ?? contact.id)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate text-sm">
                              {contact.name ?? shortName(contact.id)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInviteContact(contact.id)}
                              disabled={isInviting || invitingId !== null}
                            >
                              {isInviting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <UserPlus className="h-3 w-3" />
                              )}
                              <span className="ml-1">Einladen</span>
                            </Button>
                          </div>
                          {inviteError && (
                            <p className="text-xs text-destructive ml-11 -mt-1 mb-1">{inviteError}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* No contacts hint — only if truly no active contacts at all */}
              {onInviteMember && invitableContacts.length === 0 && justInvitedContacts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {(contacts ?? []).some((c) => c.status === "active")
                    ? "Alle Kontakte sind bereits Mitglied."
                    : "Keine verifizierten Kontakte. Verifiziere zuerst einen Kontakt im Kontakte-Tab."}
                </p>
              )}

              {/* Manual DID fallback */}
              {onInviteMember && (
                <div>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowManualDid(!showManualDid)}
                  >
                    {showManualDid ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    DID manuell eingeben
                  </button>
                  {showManualDid && (
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={manualDid}
                        onChange={(e) => setManualDid(e.target.value)}
                        placeholder="did:key:z6Mk..."
                        className="flex-1 font-mono text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleManualInvite()
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualInvite}
                        disabled={!manualDid.trim() || invitingId !== null}
                      >
                        {invitingId === "manual" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
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
