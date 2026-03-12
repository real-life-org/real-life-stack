"use client"

import { useState } from "react"
import { Shield, Copy, Check, Loader2, UserCheck } from "lucide-react"

import { Button } from "@/components/primitives/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/primitives/dialog"
import { Input } from "@/components/primitives/input"

type VerificationStep = "choose" | "show-code" | "enter-code" | "confirm" | "done"

export interface VerificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  challenge: { code: string; nonce: string } | null
  peerInfo: { peerId: string; peerName?: string } | null
  isProcessing: boolean
  error: string | null
  onCreateChallenge: () => Promise<unknown>
  onScanChallenge: (code: string) => Promise<unknown>
  onConfirmVerification: (code: string) => Promise<void>
  onReset: () => void
}

export function VerificationDialog({
  open,
  onOpenChange,
  challenge,
  peerInfo,
  isProcessing,
  error,
  onCreateChallenge,
  onScanChallenge,
  onConfirmVerification,
  onReset,
}: VerificationDialogProps) {
  const [step, setStep] = useState<VerificationStep>("choose")
  const [inputCode, setInputCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [scannedCode, setScannedCode] = useState("")

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("choose")
      setInputCode("")
      setCopied(false)
      setScannedCode("")
      onReset()
    }
    onOpenChange(isOpen)
  }

  const handleCreateChallenge = async () => {
    await onCreateChallenge()
    setStep("show-code")
  }

  const handleCopyCode = async () => {
    if (challenge?.code) {
      await navigator.clipboard.writeText(challenge.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleEnterCode = () => {
    setStep("enter-code")
  }

  const handleSubmitCode = async () => {
    const code = inputCode.trim()
    if (!code) return
    setScannedCode(code)
    await onScanChallenge(code)
    setStep("confirm")
  }

  const handleConfirm = async () => {
    await onConfirmVerification(scannedCode)
    setStep("done")
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {step === "done" ? "Verifizierung abgeschlossen" : "Kontakt verifizieren"}
          </DialogTitle>
          <DialogDescription>
            {step === "choose" && "Verifiziere einen Kontakt, den du persönlich triffst."}
            {step === "show-code" && "Teile diesen Code mit deinem Gegenüber."}
            {step === "enter-code" && "Gib den Code ein, den dir dein Gegenüber zeigt."}
            {step === "confirm" && "Bestätige, dass du diese Person persönlich triffst."}
            {step === "done" && "Die gegenseitige Verifizierung war erfolgreich."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {step === "choose" && (
          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={handleCreateChallenge} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Code erzeugen (ich zeige)
            </Button>
            <Button variant="outline" onClick={handleEnterCode}>
              Code eingeben (ich scanne)
            </Button>
          </div>
        )}

        {step === "show-code" && challenge && (
          <div className="space-y-4 pt-2">
            <div className="relative">
              <div className="rounded-lg border bg-muted p-4 font-mono text-xs break-all select-all">
                {challenge.code}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={handleCopyCode}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Zeige oder sende diesen Code an die Person, die du verifizieren möchtest.
              Sie gibt ihn auf ihrer Seite ein.
            </p>
          </div>
        )}

        {step === "enter-code" && (
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Code einfügen..."
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="font-mono text-xs"
            />
            <Button
              className="w-full"
              onClick={handleSubmitCode}
              disabled={!inputCode.trim() || isProcessing}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Code prüfen
            </Button>
          </div>
        )}

        {step === "confirm" && peerInfo && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border bg-primary/5 p-4 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <UserCheck className="h-6 w-6 text-primary" />
              </div>
              <p className="font-medium">
                {peerInfo.peerName ?? peerInfo.peerId.slice(-8)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground font-mono">
                {peerInfo.peerId.slice(0, 20)}...{peerInfo.peerId.slice(-8)}
              </p>
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Stehst du gerade vor dieser Person?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => handleClose(false)}>
                Abbrechen
              </Button>
              <Button className="flex-1" onClick={handleConfirm} disabled={isProcessing}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ja, verifizieren
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 pt-2 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              Der Kontakt wurde erfolgreich verifiziert und ist jetzt aktiv.
            </p>
            <Button className="w-full" onClick={() => handleClose(false)}>
              Fertig
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
