import { useState } from "react"
import {
  PassphraseInput,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@real-life-stack/toolkit"
import { Key } from "lucide-react"
import type { WotConnector } from "../wot-connector.js"

interface UnlockFlowProps {
  connector: WotConnector
  onComplete: () => void
  onSwitchToRecovery: () => void
}

export function UnlockFlow({ connector, onComplete, onSwitchToRecovery }: UnlockFlowProps) {
  const [passphrase, setPassphrase] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleUnlock = async () => {
    if (passphrase.length < 1) return
    setLoading(true)
    setError("")
    try {
      await connector.authenticate("unlock", { passphrase } as any)
      onComplete()
    } catch (err: any) {
      setError(err.message?.includes("decrypt")
        ? "Falsches Passwort"
        : (err.message ?? "Entsperrung fehlgeschlagen"))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && passphrase.length > 0 && !loading) {
      handleUnlock()
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Key className="size-7 text-primary" />
        </div>
        <CardTitle>Willkommen zurück</CardTitle>
        <CardDescription>
          Gib dein Passwort ein, um deine Identity zu entsperren.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div onKeyDown={handleKeyDown}>
          <PassphraseInput
            value={passphrase}
            onChange={setPassphrase}
            label="Passwort"
            placeholder="Passwort eingeben"
            error={error}
            autoFocus
          />
        </div>
        <Button
          className="w-full"
          onClick={handleUnlock}
          disabled={loading || passphrase.length < 1}
        >
          {loading ? "Entsperre…" : "Entsperren"}
        </Button>
        <div className="text-center">
          <button
            type="button"
            onClick={onSwitchToRecovery}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Identity wiederherstellen
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
