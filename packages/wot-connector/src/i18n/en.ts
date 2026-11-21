import type { Message } from "@real-life/toolkit"
import type { WotMessageKey } from "./de.js"

/**
 * Englisches Wörterbuch des WoT-Connectors — gegen die Schlüssel von `de.ts`
 * getypt: ein fehlender oder überzähliger Schlüssel ist ein Compilerfehler.
 *
 * Wortwahl wie im Toolkit: „seed“ für die 12 Wörter (auch `mnemonic.*` im
 * Toolkit sagt „seed“), „identity“, „password“.
 */
export const en = {
  "wot.loading": "Loading…",

  "wot.onboarding.step.start": "Start",
  "wot.onboarding.step.seed": "Seed",
  "wot.onboarding.step.verify": "Check",
  "wot.onboarding.step.profile": "Profile",
  "wot.onboarding.step.password": "Password",

  "wot.onboarding.welcomeTitle": "Welcome!",
  "wot.onboarding.welcomeDescription":
    "Create your decentralized digital identity. It belongs only to you — no server, no provider.",
  "wot.onboarding.whatHappens": "What will happen:",
  "wot.onboarding.whatHappens.seed": "You get 12 secret words (your “seed”)",
  "wot.onboarding.whatHappens.writeDown": "You write them down and confirm that you did",
  "wot.onboarding.whatHappens.profile": "You fill in your profile",
  "wot.onboarding.whatHappens.password": "You set a password to protect it",
  "wot.onboarding.importantLabel": "Important:",
  "wot.onboarding.importantText":
    "The 12 words are your only way to restore your identity. Have pen and paper ready.",
  "wot.onboarding.create": "Create identity",
  "wot.onboarding.creating": "Creating identity…",
  "wot.onboarding.createFailed": "Your identity could not be created",
  "wot.onboarding.haveSeed": "I already have a seed",

  "wot.onboarding.seedTitle": "Your recovery seed",
  "wot.onboarding.seedDescription": "Write down these 12 words in the right order and keep them somewhere safe.",
  "wot.onboarding.check.written": "I have written down all 12 words",
  "wot.onboarding.check.safe": "I have stored them in a safe place",
  "wot.onboarding.check.understand": "I understand that they cannot be recovered",
  "wot.onboarding.lastWarningLabel": "Last warning:",
  "wot.onboarding.lastWarningText": "If you lose the words, there is no way to restore your identity.",
  "wot.onboarding.toVerify": "Continue to confirmation",

  "wot.onboarding.verifyTitle": "Confirm your seed",
  "wot.onboarding.verifyDescription": "Enter the following words to make sure you wrote them down correctly.",
  "wot.onboarding.backToSeed": "← Back to the seed",

  "wot.onboarding.profileTitle": "Your profile",
  "wot.onboarding.profileDescription": "How would you like to appear to others?",
  "wot.onboarding.name": "Name",
  "wot.onboarding.namePlaceholder": "Your name",
  "wot.onboarding.bio": "About me",
  "wot.onboarding.bioPlaceholder": "A short sentence about you (optional)",
  "wot.onboarding.protectWithBiometrics": "Protect with biometrics",
  "wot.onboarding.continue": "Continue",
  "wot.onboarding.skip": "Skip",

  "wot.onboarding.passwordTitle": "Protect your identity",
  "wot.onboarding.passwordDescription": "Choose a strong password to protect your identity on this device.",
  "wot.onboarding.tipLabel": "Tip:",
  "wot.onboarding.tipText": "The password is not your seed. It protects your identity locally on this device.",
  "wot.onboarding.setPassword": "Set password",
  "wot.onboarding.saving": "Saving…",
  "wot.onboarding.protectFailed": "Your identity could not be protected",

  "wot.onboarding.doneTitle": "All set!",
  "wot.onboarding.doneDescription": "Your identity has been created and protected.",
  "wot.onboarding.redirecting": "Taking you to the app…",

  "wot.biometric.settingUp": "Setting up…",
  "wot.biometric.setupFailed": "Biometric setup failed. Please continue with a password.",
  "wot.usePasswordInstead": "Use a password instead",

  "wot.unlock.title": "Welcome back",
  "wot.unlock.biometricDescription": "Unlock your identity with your fingerprint or face.",
  "wot.unlock.passwordDescription": "Enter your password to unlock your identity.",
  "wot.unlock.passwordPlaceholder": "Enter password",
  "wot.unlock.unlock": "Unlock",
  "wot.unlock.unlocking": "Unlocking…",
  "wot.unlock.biometric": "Unlock with biometrics",
  "wot.unlock.backToBiometric": "Back to biometric unlock",
  "wot.unlock.wrongPassword": "Wrong password",
  "wot.unlock.failed": "Unlock failed",
  "wot.unlock.biometricReset": "Biometrics were reset. Please unlock with your password.",
  "wot.unlock.biometricFailed": "Biometric unlock failed",

  "wot.recovery.title": "Restore identity",
  "wot.recovery.description": "Enter the 12 words of your seed.",
  "wot.recovery.placeholder": "word 1  word 2  word 3 …",
  "wot.recovery.wordCount": "{count}/12 words",
  "wot.recovery.withBiometrics": "Restore with biometrics",
  "wot.recovery.restoring": "Restoring…",
  "wot.recovery.continue": "Continue",
  "wot.recovery.passwordTitle": "Set a new password",
  "wot.recovery.passwordDescription": "Choose a password to protect your restored identity.",
  "wot.recovery.submit": "Restore identity",
  "wot.recovery.failed": "Restore failed",
  "wot.recovery.backToSeed": "Back to the seed",

  "wot.biometricOptIn.title": "Unlock faster",
  "wot.biometricOptIn.description":
    "Would you like to unlock your identity with your fingerprint or face from now on, instead of entering your password every time?",
  "wot.biometricOptIn.notNow": "Not now",
  "wot.biometricOptIn.enable": "Turn on",
} as const satisfies Record<WotMessageKey, Message>
