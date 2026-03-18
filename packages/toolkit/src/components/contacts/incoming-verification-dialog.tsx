"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/primitives/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/primitives/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/primitives/dialog"

export interface IncomingVerificationDialogProps {
  open: boolean
  fromId: string
  fromName?: string
  fromAvatar?: string
  onConfirm: () => Promise<void>
  onReject: () => void
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export function IncomingVerificationDialog({
  open,
  fromId,
  fromName,
  fromAvatar,
  onConfirm,
  onReject,
}: IncomingVerificationDialogProps) {
  const [confirming, setConfirming] = useState(false)
  const name = fromName ?? `User-${fromId.slice(-6)}`

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await onConfirm()
    } catch (e) {
      console.error("Counter-verification failed:", e)
    }
    setConfirming(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onReject() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Stehst du vor dieser Person?</DialogTitle>
          <DialogDescription className="text-center">
            Bestätige nur, wenn du diese Person persönlich kennst.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={fromAvatar} alt={name} />
            <AvatarFallback className="text-lg bg-primary/10 text-primary">
              {fromAvatar ? null : getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-xl font-semibold">{name}</p>
            <p className="mt-1 text-xs text-muted-foreground font-mono max-w-[280px] truncate">
              {fromId}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onReject}
          >
            Ablehnen
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Bestätigen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
