import { useState, useEffect, useCallback } from "react"
import { formatMnemonicForCopy } from "../mnemonic-format.js"
import "../i18n/index.js"
import {
  MnemonicGrid,
  MnemonicVerify,
  PassphraseConfirm,
  StepProgress,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Separator,
  useI18n,
} from "@real-life/toolkit"
import { Key, Shield, Sparkles, Check, AlertTriangle, User as UserIcon, Fingerprint } from "lucide-react"
import type { WotConnector } from "../wot-connector.js"
import { BiometricService } from "../biometric-service.js"
import { generateRandomPassphrase } from "../random-passphrase.js"

type OnboardingStep = "welcome" | "seed" | "verify" | "profile" | "password" | "complete"

const STEP_INDEX: Record<OnboardingStep, number> = {
  welcome: 0,
  seed: 1,
  verify: 2,
  profile: 3,
  password: 4,
  complete: 4,
}

interface OnboardingFlowProps {
  connector: WotConnector
  onComplete: () => void
  onSwitchToRecovery: () => void
}

export function OnboardingFlow({ connector, onComplete, onSwitchToRecovery }: OnboardingFlowProps) {
  const { t } = useI18n()
  const STEP_LABELS = [
    t("wot.onboarding.step.start"),
    t("wot.onboarding.step.seed"),
    t("wot.onboarding.step.verify"),
    t("wot.onboarding.step.profile"),
    t("wot.onboarding.step.password"),
  ]
  const [step, setStepRaw] = useState<OnboardingStep>("welcome")
  const [mnemonic, setMnemonic] = useState<string[]>([])
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [checklistItems, setChecklistItems] = useState([
    { id: "written", checked: false },
    { id: "safe", checked: false },
    { id: "understand", checked: false },
  ])
  const [biometricAvailable, setBiometricAvailable] = useState(false)

  // --- Browser history navigation ---
  const goToStep = useCallback((newStep: OnboardingStep) => {
    setStepRaw(newStep)
    setError("")
    history.pushState({ onboardingStep: newStep }, "")
  }, [])

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.onboardingStep) {
        setStepRaw(e.state.onboardingStep)
        setError("")
      } else {
        setStepRaw("welcome")
      }
    }
    history.replaceState({ onboardingStep: "welcome" }, "")
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Check biometric availability on mount
  useEffect(() => {
    BiometricService.isAvailable().then(setBiometricAvailable)
  }, [])

  // --- Actions ---
  const handleGenerate = async () => {
    setLoading(true)
    setError("")
    try {
      const user = await connector.authenticate("generate", {}) as any
      if (user._mnemonic) {
        setMnemonic(user._mnemonic.split(" "))
        goToStep("seed")
      }
    } catch (err: any) {
      setError(err.message ?? t("wot.onboarding.createFailed"))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatMnemonicForCopy(mnemonic))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleChecklist = (id: string) => {
    setChecklistItems((items) =>
      items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    )
  }

  const allChecked = checklistItems.every((item) => item.checked)

  // Biometric protect path: generates random passphrase, stores via biometrics.
  // Order matters: enroll FIRST so a cancelled/failed biometric prompt leaves no
  // stored identity behind a random passphrase the user never saw. Only once the
  // keystore holds the passphrase do we create the identity with it; if that step
  // fails we roll the keystore entry back so no orphan key is stranded.
  const handleBiometricProtect = async () => {
    setLoading(true)
    setError("")
    const randomPassphrase = generateRandomPassphrase()
    try {
      await BiometricService.enroll(randomPassphrase)
    } catch {
      // Prompt cancelled / enrollment failed — nothing persisted yet.
      setLoading(false)
      goToStep("password")
      return
    }
    try {
      await connector.authenticate("create", {
        mnemonic: mnemonic.join(" "),
        passphrase: randomPassphrase,
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
      })
      goToStep("complete")
      setTimeout(onComplete, 2000)
    } catch {
      // Creation failed after enrollment. authenticate("create") is not atomic —
      // it stores the seed before later steps (bootstrap, auth-state) that can
      // still throw — so roll back BOTH the keystore entry AND any already-stored
      // identity, else a partial failure strands an identity behind the unseen
      // random passphrase.
      // deleteStoredIdentity() FIRST and on its own — it must run even if the
      // best-effort logout() teardown below rejects partway. Then logout() to
      // tear down any partial adapter/auth state so a retry starts clean.
      await BiometricService.unenroll().catch(() => {})
      await connector.deleteStoredIdentity().catch(() => {})
      await connector.logout().catch(() => {})
      // Surface the failure on the password step instead of silently falling
      // back (the enroll-cancel case above stays silent — that's a deliberate
      // user choice; this branch is a real create failure).
      setError(t("wot.biometric.setupFailed"))
      setLoading(false)
      goToStep("password")
    }
  }

  const handleFinalize = async () => {
    if (passphrase.length < 8) {
      setError(t("auth.minLength", { count: 8 }))
      return
    }
    if (passphrase !== confirm) {
      setError(t("auth.passwordMismatch"))
      return
    }
    setLoading(true)
    setError("")
    try {
      await connector.authenticate("create", {
        mnemonic: mnemonic.join(" "),
        passphrase,
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
      })
      // Also enroll biometric if available (optional, silent on failure)
      if (biometricAvailable) {
        try {
          await BiometricService.enroll(passphrase)
        } catch { /* biometric enrollment optional */ }
      }
      goToStep("complete")
      setTimeout(onComplete, 2000)
    } catch (err: any) {
      setError(err.message ?? t("wot.onboarding.protectFailed"))
    } finally {
      setLoading(false)
    }
  }

  // --- Step: Welcome ---
  if (step === "welcome") {
    return (
      <div className="space-y-6">
        <StepProgress steps={STEP_LABELS} currentStep={0} />
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-7 text-primary" />
            </div>
            <CardTitle>{t("wot.onboarding.welcomeTitle")}</CardTitle>
            <CardDescription>{t("wot.onboarding.welcomeDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 font-medium text-blue-900 dark:text-blue-300">
                <Shield className="size-4" />
                <span>{t("wot.onboarding.whatHappens")}</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-400 ml-1">
                <li>{t("wot.onboarding.whatHappens.seed")}</li>
                <li>{t("wot.onboarding.whatHappens.writeDown")}</li>
                <li>{t("wot.onboarding.whatHappens.profile")}</li>
                <li>{t("wot.onboarding.whatHappens.password")}</li>
              </ol>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>{t("wot.onboarding.importantLabel")}</strong> {t("wot.onboarding.importantText")}
                </p>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleGenerate} disabled={loading} data-testid="wot-onboarding-create">
              {loading ? t("wot.onboarding.creating") : t("wot.onboarding.create")}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={onSwitchToRecovery}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="wot-onboarding-have-seed"
              >
                {t("wot.onboarding.haveSeed")}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Step: Show Seed ---
  if (step === "seed") {
    return (
      <div className="space-y-6">
        <StepProgress steps={STEP_LABELS} currentStep={1} />
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-amber-500/10">
              <AlertTriangle className="size-7 text-amber-500" />
            </div>
            <CardTitle>{t("wot.onboarding.seedTitle")}</CardTitle>
            <CardDescription>{t("wot.onboarding.seedDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4" data-testid="wot-onboarding-seed">
            <MnemonicGrid words={mnemonic} copyable />

            {/* Security Checklist */}
            <Separator />
            <div className="space-y-1">
              {[
                { id: "written", label: t("wot.onboarding.check.written") },
                { id: "safe", label: t("wot.onboarding.check.safe") },
                { id: "understand", label: t("wot.onboarding.check.understand") },
              ].map(({ id, label }) => {
                const item = checklistItems.find((c) => c.id === id)!
                return (
                  <label
                    key={id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleChecklist(id)}
                      data-testid={`wot-onboarding-check-${id}`}
                      className="size-4 rounded border-muted-foreground/40 accent-green-600 shrink-0"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                )
              })}
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">
                <strong>{t("wot.onboarding.lastWarningLabel")}</strong> {t("wot.onboarding.lastWarningText")}
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => goToStep("verify")}
              disabled={!allChecked}
              data-testid="wot-onboarding-to-verify"
            >
              {t("wot.onboarding.toVerify")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Step: Verify Seed ---
  if (step === "verify") {
    return (
      <div className="space-y-6">
        <StepProgress steps={STEP_LABELS} currentStep={2} />
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t("wot.onboarding.verifyTitle")}</CardTitle>
            <CardDescription>{t("wot.onboarding.verifyDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4" data-testid="wot-onboarding-verify">
            <MnemonicVerify words={mnemonic} onVerified={() => goToStep("profile")} />
            <button
              type="button"
              onClick={() => history.back()}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("wot.onboarding.backToSeed")}
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Step: Profile ---
  if (step === "profile") {
    return (
      <div className="space-y-6">
        <StepProgress steps={STEP_LABELS} currentStep={3} />
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10">
              <UserIcon className="size-7 text-primary" />
            </div>
            <CardTitle>{t("wot.onboarding.profileTitle")}</CardTitle>
            <CardDescription>{t("wot.onboarding.profileDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="onboarding-name">{t("wot.onboarding.name")}</Label>
              <Input
                id="onboarding-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("wot.onboarding.namePlaceholder")}
                data-testid="wot-onboarding-name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    goToStep("password")
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-bio">{t("wot.onboarding.bio")}</Label>
              <Input
                id="onboarding-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t("wot.onboarding.bioPlaceholder")}
              />
            </div>
            {biometricAvailable ? (
              <>
                <Button
                  className="w-full flex items-center gap-2"
                  onClick={handleBiometricProtect}
                  disabled={loading}
                >
                  <Fingerprint className="size-5" />
                  {loading ? t("wot.biometric.settingUp") : t("wot.onboarding.protectWithBiometrics")}
                </Button>
                <button
                  type="button"
                  onClick={() => goToStep("password")}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="wot-onboarding-use-password"
                >
                  {t("wot.usePasswordInstead")}
                </button>
              </>
            ) : (
              <>
                <Button className="w-full" onClick={() => goToStep("password")} data-testid="wot-onboarding-profile-continue">
                  {t("wot.onboarding.continue")}
                </Button>
                <button
                  type="button"
                  onClick={() => goToStep("password")}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("wot.onboarding.skip")}
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Step: Password ---
  if (step === "password") {
    return (
      <div className="space-y-6">
        <StepProgress steps={STEP_LABELS} currentStep={4} />
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-green-500/10">
              <Key className="size-7 text-green-500" />
            </div>
            <CardTitle>{t("wot.onboarding.passwordTitle")}</CardTitle>
            <CardDescription>{t("wot.onboarding.passwordDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); handleFinalize() }}
              className="space-y-4"
              data-testid="wot-onboarding-password"
            >
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>{t("wot.onboarding.tipLabel")}</strong> {t("wot.onboarding.tipText")}
                </p>
              </div>
              <PassphraseConfirm
                passphrase={passphrase}
                confirm={confirm}
                onPassphraseChange={setPassphrase}
                onConfirmChange={setConfirm}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                data-testid="wot-onboarding-set-password"
                className="w-full"
                disabled={loading || passphrase.length < 8 || passphrase !== confirm}
              >
                {loading ? t("wot.onboarding.saving") : t("wot.onboarding.setPassword")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Step: Complete ---
  return (
    <div className="space-y-6">
      <StepProgress steps={STEP_LABELS} currentStep={4} />
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-green-500/10">
            <Check className="size-7 text-green-500" />
          </div>
          <CardTitle>{t("wot.onboarding.doneTitle")}</CardTitle>
          <CardDescription>{t("wot.onboarding.doneDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="animate-pulse text-sm text-muted-foreground">
            {t("wot.onboarding.redirecting")}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
