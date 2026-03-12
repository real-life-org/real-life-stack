import { useState } from "react"
import {
  PassphraseConfirm,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@real-life-stack/toolkit"
import { Key } from "lucide-react"
import type { WotConnector } from "../wot-connector.js"

interface RecoveryFlowProps {
  connector: WotConnector
  onComplete: () => void
  onBack: () => void
}

export function RecoveryFlow({ connector, onComplete, onBack }: RecoveryFlowProps) {
  const [step, setStep] = useState<"mnemonic" | "passphrase">("mnemonic")
  const [mnemonic, setMnemonic] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const words = mnemonic.trim().split(/\s+/)
  const mnemonicValid = words.length === 12 && words.every((w) => w.length > 0)

  const handleRecover = async () => {
    if (!mnemonicValid || passphrase.length < 8 || passphrase !== confirm) return
    setLoading(true)
    setError("")
    try {
      await connector.authenticate("mnemonic", {
        mnemonic: words.join(" "),
        passphrase,
      } as any)
      onComplete()
    } catch (err: any) {
      setError(err.message ?? "Wiederherstellung fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  if (step === "mnemonic") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Key className="size-7 text-primary" />
          </div>
          <CardTitle>Identity wiederherstellen</CardTitle>
          <CardDescription>
            Gib deinen 12-Wörter Recovery Seed ein.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={mnemonic}
            onChange={(e) => {
              setMnemonic(e.target.value)
              setError("")
            }}
            placeholder="Wort 1  Wort 2  Wort 3 …"
            rows={3}
            autoFocus
            className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
          {mnemonic.length > 0 && !mnemonicValid && (
            <p className="text-sm text-muted-foreground">
              {words.length}/12 Wörter
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="w-full"
            onClick={() => setStep("passphrase")}
            disabled={!mnemonicValid}
          >
            Weiter
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Zurück
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Neues Passwort setzen</CardTitle>
        <CardDescription>
          Wähle ein Passwort, um deine wiederhergestellte Identity zu schützen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PassphraseConfirm
          passphrase={passphrase}
          confirm={confirm}
          onPassphraseChange={setPassphrase}
          onConfirmChange={setConfirm}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          className="w-full"
          onClick={handleRecover}
          disabled={loading || passphrase.length < 8 || passphrase !== confirm}
        >
          {loading ? "Stelle wieder her…" : "Identity wiederherstellen"}
        </Button>
        <div className="text-center">
          <button
            type="button"
            onClick={() => setStep("mnemonic")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Zurück zum Seed
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
