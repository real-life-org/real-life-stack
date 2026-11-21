// @vitest-environment jsdom
/**
 * Die Bildschirme des Connectors sprechen Deutsch und Englisch.
 *
 * - Die Connector-Texte hängen sich beim Import an die Toolkit-Laufzeit —
 *   eine App muss dafür nichts aufrufen.
 * - de.ts und en.ts haben dieselben Schlüssel, dieselben Platzhalter und
 *   dieselbe Art (Text oder Plural-Objekt).
 * - Jeder Bildschirm rendert in beiden Sprachen ohne rohe Schlüssel, ohne
 *   Text der jeweils anderen Sprache und mit „Identität“ statt „Identity“.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const bio = vi.hoisted(() => ({ available: false, enrolled: false }))
vi.mock("../src/biometric-service.js", () => ({
  BiometricService: {
    isAvailable: async () => bio.available,
    isEnrolled: async () => bio.enrolled,
    // Abbruch durch den Nutzer: der Biometrie-Bildschirm bleibt stehen.
    authenticate: async () => {
      throw Object.assign(new Error("cancelled"), { code: "USER_CANCELLED" })
    },
    enroll: async () => {},
    unenroll: async () => {},
  },
}))

import { getI18n, setLanguage, type Language, type Message } from "@real-life/toolkit"
import { resetI18nForTests } from "@real-life/toolkit/testing"
import {
  DIDAuthScreen,
  OnboardingFlow,
  RecoveryFlow,
  UnlockFlow,
  registerWotMessages,
  wotMessages,
} from "../src/components/index.js"
import { BiometricOptIn } from "../src/components/BiometricOptIn.js"
import type { WotConnector } from "../src/wot-connector.js"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const connector = {
  authenticate: vi.fn(async () => ({})),
  getAuthState: () => ({ current: { status: "unauthenticated" as const }, subscribe: () => () => {} }),
  deleteStoredIdentity: async () => {},
  logout: async () => {},
} as unknown as WotConnector

let root: Root | null = null
let container: HTMLDivElement | null = null

async function render(node: React.ReactNode): Promise<HTMLDivElement> {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(node))
  // Effekte mit await (Biometrie-Probe, Ladeansicht) abwarten.
  await act(async () => {})
  return container
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  bio.available = false
  bio.enrolled = false
  localStorage.clear()
})

describe("Registrierung", () => {
  // Bewusst ohne resetI18nForTests davor: der Import oben hat die Texte
  // bereits eingetragen — genau das, worauf sich eine App verlässt.
  it("trägt die Connector-Texte beim Import ein", () => {
    setLanguage("de", { persist: false })
    expect(getI18n().t("wot.onboarding.create")).toBe("Identität erstellen")
    setLanguage("en", { persist: false })
    expect(getI18n().t("wot.onboarding.create")).toBe("Create identity")
  })
})

describe("Wörterbücher", () => {
  const placeholders = (message: Message): string[] => {
    const texts = typeof message === "string" ? [message] : Object.values(message)
    return [...new Set(texts.flatMap((text) => [...(text ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort()
  }

  it("haben dieselben Schlüssel", () => {
    expect(Object.keys(wotMessages.en).sort()).toEqual(Object.keys(wotMessages.de).sort())
  })

  it("haben dieselben Platzhalter und dieselbe Art je Schlüssel", () => {
    const de = wotMessages.de as Record<string, Message>
    const en = wotMessages.en as Record<string, Message>
    for (const key of Object.keys(de)) {
      expect(placeholders(en[key]), key).toEqual(placeholders(de[key]))
      expect(typeof en[key], key).toBe(typeof de[key])
      if (typeof de[key] === "object") expect(en[key], key).toHaveProperty("other")
    }
  })

  it("sagen im Deutschen „Identität“, nie „Identity“", () => {
    const texts = Object.values(wotMessages.de as Record<string, Message>).flatMap((m) =>
      typeof m === "string" ? [m] : Object.values(m),
    )
    expect(texts.filter((text) => /Identity/.test(text ?? ""))).toEqual([])
  })

  it("benutzen nur wot.*-Schlüssel", () => {
    expect(Object.keys(wotMessages.de).filter((key) => !key.startsWith("wot."))).toEqual([])
  })
})

const screens: Array<{ name: string; setup?: () => void; node: () => React.ReactNode; de: string[]; en: string[] }> = [
  {
    name: "OnboardingFlow (Willkommen)",
    node: () => <OnboardingFlow connector={connector} onComplete={() => {}} onSwitchToRecovery={() => {}} />,
    de: ["Willkommen!", "Erstelle deine dezentrale digitale Identität", "Identität erstellen", "Ich habe bereits einen Seed", "Prüfen"],
    en: ["Welcome!", "Create your decentralized digital identity", "Create identity", "I already have a seed", "Check"],
  },
  {
    name: "UnlockFlow (Passwort)",
    node: () => <UnlockFlow connector={connector} onComplete={() => {}} onSwitchToRecovery={() => {}} />,
    de: ["Willkommen zurück", "Gib dein Passwort ein, um deine Identität zu entsperren.", "Entsperren", "Identität wiederherstellen"],
    en: ["Welcome back", "Enter your password to unlock your identity.", "Unlock", "Restore identity"],
  },
  {
    name: "UnlockFlow (Biometrie)",
    setup: () => {
      bio.available = true
      bio.enrolled = true
    },
    node: () => <UnlockFlow connector={connector} onComplete={() => {}} onSwitchToRecovery={() => {}} />,
    de: ["Entsperre deine Identität mit Fingerabdruck oder Gesicht.", "Biometrisch entsperren", "Stattdessen Passwort verwenden"],
    en: ["Unlock your identity with your fingerprint or face.", "Unlock with biometrics", "Use a password instead"],
  },
  {
    name: "RecoveryFlow",
    node: () => <RecoveryFlow connector={connector} onComplete={() => {}} onBack={() => {}} />,
    de: ["Identität wiederherstellen", "Gib die 12 Wörter deines Seeds ein.", "Weiter", "Zurück"],
    en: ["Restore identity", "Enter the 12 words of your seed.", "Continue", "Back"],
  },
  {
    name: "DIDAuthScreen (ohne gespeicherte Identität)",
    node: () => <DIDAuthScreen connector={connector} onAuthenticated={() => {}} />,
    de: ["Identität erstellen"],
    en: ["Create identity"],
  },
  {
    name: "BiometricOptIn",
    node: () => <BiometricOptIn passphrase="x" onDone={() => {}} />,
    de: ["Schneller entsperren", "Möchtest du deine Identität künftig", "Nicht jetzt", "Aktivieren"],
    en: ["Unlock faster", "Would you like to unlock your identity", "Not now", "Turn on"],
  },
]

describe.each(["de", "en"] as Language[])("Bildschirme auf %s", (language) => {
  beforeEach(() => {
    resetI18nForTests(language)
    registerWotMessages()
  })

  it.each(screens)("$name", async (screen) => {
    screen.setup?.()
    const el = await render(screen.node())
    const text = el.textContent ?? ""
    const attrs = [...el.querySelectorAll("[placeholder]")].map((n) => n.getAttribute("placeholder")).join(" ")
    for (const expected of screen[language]) expect(text).toContain(expected)
    for (const other of screen[language === "de" ? "en" : "de"]) {
      if (!screen[language].includes(other)) expect(text).not.toContain(other)
    }
    expect(`${text} ${attrs}`).not.toMatch(/\bwot\.[a-zA-Z]/)
    expect(text).not.toContain("Identity")
  })
})
