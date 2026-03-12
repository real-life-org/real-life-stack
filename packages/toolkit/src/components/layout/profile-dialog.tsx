import { useState, useEffect } from "react"
import { Copy, Check } from "lucide-react"
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

export interface ProfileData {
  did: string
  name: string
  bio?: string
  avatar?: string
}

export interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: ProfileData
  onSave: (updates: { name: string; bio: string }) => Promise<void>
}

export function ProfileDialog({
  open,
  onOpenChange,
  profile,
  onSave,
}: ProfileDialogProps) {
  const [name, setName] = useState(profile.name)
  const [bio, setBio] = useState(profile.bio ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Sync state when profile changes
  useEffect(() => {
    setName(profile.name)
    setBio(profile.bio ?? "")
  }, [profile.name, profile.bio])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), bio: bio.trim() })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern")
    } finally {
      setSaving(false)
    }
  }

  const handleCopyDid = async () => {
    await navigator.clipboard.writeText(profile.did)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profil</DialogTitle>
          <DialogDescription>
            Dein öffentliches Profil bearbeiten.
          </DialogDescription>
        </DialogHeader>

        {/* DID */}
        <div className="space-y-1.5">
          <Label>Deine DID</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono break-all select-all">
              {profile.did}
            </code>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleCopyDid}
              title="DID kopieren"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dein Name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSave()
              }
            }}
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="profile-bio">Über mich</Label>
          <Input
            id="profile-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Ein kurzer Satz über dich (optional)"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Footer */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
