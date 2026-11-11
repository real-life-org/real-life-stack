// @vitest-environment node
// Register-Beschriftungen aus dem Wörterbuch (Spec 01, Modul-Register; Spec 06, Typ-Register):
// Toolkit-Einträge sprechen die Sprache der Oberfläche, ein App-Eintrag ohne Schlüssel bleibt bei
// seinem eigenen Text, eine App übersetzt ihre Einträge über `extendMessages`.
import { afterEach, describe, expect, it } from "vitest"

import { extendMessages, getI18n, setLanguage } from "../src/i18n"
import { resetI18nForTests } from "../src/testing"
import { localizeRegisterEntry, moduleLabel } from "../src/lib/register-labels"
import { TOOLKIT_MODULES } from "../src/lib/module-register"
import { resolveTypePresentation } from "../src/components/preview/type-presentation"

afterEach(() => resetI18nForTests())

const sprache = (lang: "de" | "en") => setLanguage(lang, { persist: false })

describe("Modulnamen", () => {
  it("jedes Toolkit-Modul hat seinen Namen auf Deutsch und Englisch", () => {
    sprache("de")
    expect(TOOLKIT_MODULES.map((m) => moduleLabel(getI18n(), m))).toEqual(TOOLKIT_MODULES.map((m) => m.label))
    sprache("en")
    const map = TOOLKIT_MODULES.find((m) => m.id === "map")!
    expect(moduleLabel(getI18n(), map)).toBe("Map")
    expect(moduleLabel(getI18n(), TOOLKIT_MODULES.find((m) => m.id === "calendar")!)).toBe("Calendar")
  })

  it("ein App-Modul ohne Schlüssel behält sein label; mit extendMessages spricht es die Sprache", () => {
    sprache("en")
    const garten = { id: "beete", label: "Beete" }
    expect(moduleLabel(getI18n(), garten)).toBe("Beete")
    extendMessages({ de: { "module.beete.label": "Beete" }, en: { "module.beete.label": "Beds" } })
    expect(moduleLabel(getI18n(), garten)).toBe("Beds")
  })
})

describe("Typ-Register", () => {
  it("Typname, Feldnamen, Status-Optionen und Selbstaktionen folgen der Sprache", () => {
    sprache("en")
    const task = resolveTypePresentation("task")
    expect(task.label).toBe("Task")
    expect(task.fields?.find((f) => f.key === "start")?.label).toBe("Due")
    expect(task.fields?.find((f) => f.key === "status")?.options?.map((o) => o.label)).toEqual(["To do", "In progress", "Done"])
    expect(task.edges?.find((e) => e.predicate === "assignedTo" && e.itemRole === "from")?.selfAction?.label).toBe("Take on")
    sprache("de")
    const aufgabe = resolveTypePresentation("task")
    expect(aufgabe.fields?.find((f) => f.key === "start")?.label).toBe("Fällig")
    expect(aufgabe.edges?.find((e) => e.predicate === "assignedTo" && e.itemRole === "from")?.selfAction?.label).toBe("Übernehmen")
  })

  it("bei gleicher Sprache kommt dieselbe Darstellung zurück (stabile Abhängigkeit)", () => {
    sprache("en")
    expect(resolveTypePresentation("task").fields).toBe(resolveTypePresentation("task").fields)
  })

  it("Listen sind über ihre Kennung adressiert, nicht über die Position; ohne Schlüssel bleibt der Eintrag dasselbe Objekt", () => {
    sprache("en")
    const eintrag = { id: "x", label: "Eintrag", fields: [{ key: "b", label: "Bee" }, { key: "a", label: "Ah" }] }
    expect(localizeRegisterEntry(getI18n(), "type.x", eintrag)).toBe(eintrag)
    extendMessages({ de: { "type.x.fields.a.label": "A" }, en: { "type.x.fields.a.label": "Ay" } })
    const uebersetzt = localizeRegisterEntry(getI18n(), "type.x", eintrag)
    expect(uebersetzt.fields.map((f) => f.label)).toEqual(["Bee", "Ay"])
    expect(uebersetzt.fields[0]).toBe(eintrag.fields[0])
  })
})
