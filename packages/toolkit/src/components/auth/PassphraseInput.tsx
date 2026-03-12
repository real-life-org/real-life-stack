import * as React from "react"
import { cn } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"

export interface PassphraseInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  minLength?: number
  error?: string
  autoFocus?: boolean
  className?: string
}

export function PassphraseInput({
  value,
  onChange,
  label = "Passwort",
  placeholder = "Mindestens 8 Zeichen",
  minLength = 8,
  error,
  autoFocus,
  className,
}: PassphraseInputProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium leading-none">{label}</label>
      )}
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          minLength={minLength}
          autoFocus={autoFocus}
          className={cn(
            "flex h-10 w-full rounded-md border bg-transparent px-3 py-2 pr-10 text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            error && "border-destructive"
          )}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export interface PassphraseConfirmProps {
  passphrase: string
  confirm: string
  onPassphraseChange: (value: string) => void
  onConfirmChange: (value: string) => void
  minLength?: number
  className?: string
}

export function PassphraseConfirm({
  passphrase,
  confirm,
  onPassphraseChange,
  onConfirmChange,
  minLength = 8,
  className,
}: PassphraseConfirmProps) {
  const tooShort = passphrase.length > 0 && passphrase.length < minLength
  const mismatch = confirm.length > 0 && passphrase !== confirm

  return (
    <div className={cn("space-y-4", className)}>
      <PassphraseInput
        value={passphrase}
        onChange={onPassphraseChange}
        label="Passwort"
        minLength={minLength}
        error={tooShort ? `Mindestens ${minLength} Zeichen` : undefined}
      />
      <PassphraseInput
        value={confirm}
        onChange={onConfirmChange}
        label="Passwort bestätigen"
        placeholder="Passwort wiederholen"
        error={mismatch ? "Passwörter stimmen nicht überein" : undefined}
      />
    </div>
  )
}
