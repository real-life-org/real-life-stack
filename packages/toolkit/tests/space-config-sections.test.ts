import { describe, expect, it } from "vitest"

import {
  groupMembersForDisplay,
  resolveConfigSection,
  showsMemberSearch,
  spaceConfigSections,
  type SpaceConfigSectionId,
} from "../src/components/layout/group-dialog"

/**
 * Die Bereiche des Space-Dialogs sind EINE Liste, keine drei. Vorher haetten
 * Menue, Inhalte und der Startwert die Frage "welche Bereiche gibt es" je
 * eigenstaendig beantwortet — dasselbe lautlose Auseinanderlaufen, das das
 * Modul-Register (Spec 01) schon einmal eingesammelt hat.
 */
describe("spaceConfigSections", () => {
  it("zeigt jedem Mitglied die Mitglieder", () => {
    const ids = spaceConfigSections({ isAdmin: false }).map((s) => s.id)
    expect(ids).toEqual(["members"])
  })

  it("haengt Module nur fuer Admins an", () => {
    const ids = spaceConfigSections({ isAdmin: true }).map((s) => s.id)
    expect(ids).toEqual(["members", "modules"])
  })

  it("beginnt immer mit Mitgliedern — der Startwert braucht keine Sonderregel", () => {
    for (const isAdmin of [true, false]) {
      expect(spaceConfigSections({ isAdmin })[0].id).toBe("members")
    }
  })

  it("gibt jedem Bereich Beschriftung und Symbol", () => {
    for (const section of spaceConfigSections({ isAdmin: true })) {
      expect(section.label.trim()).not.toBe("")
      expect(section.icon).toBeTruthy()
    }
  })

  /**
   * Bild und Name stehen im Kopf, nicht in einem Bereich. Ohne Modulrecht
   * bleibt darum genau ein Bereich uebrig — ein Menue mit einem einzigen
   * Eintrag waere eine Wahl ohne Alternative. Die Flaeche entscheidet das an
   * dieser Zahl.
   */
  it("laesst ohne Modulrecht nur einen Bereich uebrig", () => {
    expect(spaceConfigSections({ isAdmin: false })).toHaveLength(1)
    expect(spaceConfigSections({ isAdmin: true }).length).toBeGreaterThan(1)
  })
})

/**
 * `isAdmin` wird aus den Mitgliedern abgeleitet und steht beim Oeffnen noch
 * nicht fest (useMembers laedt). Der Modul-Bereich kann also NACH dem ersten
 * Rendern verschwinden. Ohne Rueckfall zeigte der Dialog den Inhalt eines
 * Eintrags, den es nicht mehr gibt: eine leere Flaeche.
 */
describe("resolveConfigSection", () => {
  const memberSections = spaceConfigSections({ isAdmin: false })
  const adminSections = spaceConfigSections({ isAdmin: true })

  it("laesst einen vorhandenen Bereich unangetastet", () => {
    expect(resolveConfigSection("members", memberSections)).toBe("members")
    expect(resolveConfigSection("modules", adminSections)).toBe("modules")
  })

  it("faellt auf den ersten Bereich zurueck, wenn der gewaehlte wegfaellt", () => {
    expect(resolveConfigSection("modules", memberSections)).toBe("members")
  })

  it("faellt auch bei unbekannten Werten zurueck", () => {
    expect(resolveConfigSection("theme" as SpaceConfigSectionId, memberSections)).toBe("members")
    expect(resolveConfigSection("" as SpaceConfigSectionId, adminSections)).toBe("members")
  })
})

/**
 * Die Mitgliederliste ist nach dem Entwurf "Space Menu" (Turn 3, 3a) in
 * Gruppen geteilt: Admins zuerst, dann die uebrigen. Eine flache Liste liess
 * nicht erkennen, wer den Space verwaltet — das Admin-Abzeichen stand an
 * beliebiger Stelle, weil `members` nach DID sortiert ist.
 */
describe("groupMembersForDisplay", () => {
  const users = [
    { id: "did:b", displayName: "Berta" },
    { id: "did:a", displayName: "Anton", isAdmin: true },
    { id: "did:c", displayName: "Cem" },
  ]
  const isAdmin = (m: { isAdmin?: boolean }) => m.isAdmin === true

  it("trennt Admins von den uebrigen Mitgliedern", () => {
    const { admins, others } = groupMembersForDisplay(users, isAdmin, "")
    expect(admins.map((m) => m.displayName)).toEqual(["Anton"])
    expect(others.map((m) => m.displayName)).toEqual(["Berta", "Cem"])
  })

  it("erhaelt die Reihenfolge innerhalb jeder Gruppe", () => {
    const { others } = groupMembersForDisplay(users, isAdmin, "")
    expect(others.map((m) => m.id)).toEqual(["did:b", "did:c"])
  })

  it("sucht ohne Ruecksicht auf Gross- und Kleinschreibung", () => {
    const { admins, others } = groupMembersForDisplay(users, isAdmin, "ant")
    expect(admins.map((m) => m.displayName)).toEqual(["Anton"])
    expect(others).toEqual([])
  })

  it("sucht auch in der Kennung, wenn kein Name gesetzt ist", () => {
    const anon = [{ id: "did:key:zABC" }]
    expect(groupMembersForDisplay(anon, isAdmin, "zabc").others).toHaveLength(1)
    expect(groupMembersForDisplay(anon, isAdmin, "xyz").others).toHaveLength(0)
  })

  it("ignoriert umgebende Leerzeichen in der Suche", () => {
    expect(groupMembersForDisplay(users, isAdmin, "  berta  ").others).toHaveLength(1)
  })

  it("gibt ohne Suchbegriff alle zurueck", () => {
    const { admins, others } = groupMembersForDisplay(users, isAdmin, "   ")
    expect(admins.length + others.length).toBe(3)
  })
})

/**
 * Sichtbarkeit des Suchfelds und Wirksamkeit des Filters MUESSEN dieselbe
 * Frage beantworten. Vorher hing das Feld an der Mitgliederzahl, der Filter
 * am Suchbegriff: sank die Zahl waehrend einer Suche unter die Schwelle,
 * verschwand das Feld, der Filter blieb — und die verbliebenen Mitglieder
 * waren unerreichbar, bis man den Dialog neu oeffnete (#377).
 */
describe("showsMemberSearch", () => {
  it("bleibt unter der Schwelle verborgen, solange nicht gesucht wird", () => {
    expect(showsMemberSearch(8, "")).toBe(false)
    expect(showsMemberSearch(0, "")).toBe(false)
  })

  it("erscheint, sobald die Liste nicht mehr zu ueberschauen ist", () => {
    expect(showsMemberSearch(9, "")).toBe(true)
  })

  it("bleibt bei aktiver Suche sichtbar, auch unter der Schwelle", () => {
    expect(showsMemberSearch(8, "anton")).toBe(true)
    expect(showsMemberSearch(1, "a")).toBe(true)
  })

  it("verschwindet wieder, sobald die Suche geleert ist", () => {
    expect(showsMemberSearch(8, "")).toBe(false)
  })
})
