// @vitest-environment node
// Befunde von CodeRabbit zu #645: gespeicherte Stimm-Zusammenfassungen, Zahlen in der Sprache,
// Reaktionsnamen ohne geerbte Schlüssel, eigener Text des anonymen Zugangs.
import { afterEach, describe, expect, it } from "vitest"

import { getI18n, setLanguage } from "../src/i18n"
import { resetI18nForTests } from "../src/testing"
import { localizeActivitySummary } from "../src/lib/activity-text"
import { formatNumber, numberError } from "../src/lib/field-values"
import { reactionName } from "../src/components/reactions/reaction-constants"
import { anonymousLabel } from "../src/components/auth/auth-screen"

afterEach(() => resetI18nForTests())
const sprache = (lang: "de" | "en") => setLanguage(lang, { persist: false })

describe("gespeicherte Stimm-Zusammenfassung", () => {
  it("setzt das deutsche Log-Muster in der Oberflächensprache neu, auch für bestehende Einträge", () => {
    sprache("en")
    expect(localizeActivitySummary(getI18n(), "Zustimmung zu „Beete gießen\"", "relation")).toBe("Approval on “Beete gießen”")
    expect(localizeActivitySummary(getI18n(), "Ablehnung", "relation")).toBe("Rejection")
    expect(localizeActivitySummary(getI18n(), "Stimme zu „X\"", "relation")).toBe("Vote on “X”")
    sprache("de")
    expect(localizeActivitySummary(getI18n(), "Bedenken zu „X\"", "relation")).toBe("Bedenken zu „X\"")
  })
  it("lässt Inhalt, der dem Muster nicht folgt, unverändert", () => {
    sprache("en")
    expect(localizeActivitySummary(getI18n(), "Zustimmung ist wichtig", "relation")).toBe("Zustimmung ist wichtig")
    expect(localizeActivitySummary(getI18n(), "👍 auf „X\"", "reaction")).toBe("👍 auf „X\"")
    // der Titel eines Beitrags ist Inhalt, auch wenn er wie eine Stimme heißt (Review #645)
    expect(localizeActivitySummary(getI18n(), "Ablehnung", "post")).toBe("Ablehnung")
    expect(localizeActivitySummary(getI18n(), "Zustimmung zu „X\"", "post")).toBe("Zustimmung zu „X\"")
  })
})

describe("Zahlen in der Sprache der Oberfläche", () => {
  it("1000 liest auf Englisch als tausend, nicht als eins", () => {
    sprache("en")
    expect(formatNumber(1000)).toBe("1,000")
    expect(formatNumber(0.5, "kg")).toBe("0.5 kg")
    sprache("de")
    expect(formatNumber(1000)).toBe("1.000")
    expect(formatNumber(0.5, "kg")).toBe("0,5 kg")
  })
  it("Unter- und Obergrenze sprechen die Sprache", () => {
    sprache("en")
    expect(numberError("1", { min: 5 })).toBe("At least 5")
    expect(numberError("2000", { max: 1000 })).toBe("At most 1,000")
  })
})

describe("Reaktionsnamen", () => {
  it("ein Wert wie „constructor“ trifft keine geerbte Eigenschaft", () => {
    expect(reactionName(getI18n(), "constructor")).toBe("constructor")
    expect(reactionName(getI18n(), "toString")).toBe("toString")
  })
})

describe("anonymer Zugang", () => {
  it("übersetzt den allgemeinen Text, behält einen eigenen Text des Connectors", () => {
    sprache("en")
    expect(anonymousLabel(getI18n(), "Anonym ausprobieren")).toBe("Try anonymously")
    expect(anonymousLabel(getI18n(), undefined)).toBe("Try anonymously")
    expect(anonymousLabel(getI18n(), "Ohne Konto — nichts wird gespeichert")).toBe("Ohne Konto — nichts wird gespeichert")
  })
})
