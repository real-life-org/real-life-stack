import { describe, expect, it } from "vitest"

import {
  groupMembersForDisplay,
  resolveConfigSection,
  filterInvitableContacts,
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
    const ids = spaceConfigSections({ isAdmin: false, canInvite: false }).map((s) => s.id)
    expect(ids).toEqual(["members"])
  })

  it("haengt Module nur fuer Admins an", () => {
    const ids = spaceConfigSections({ isAdmin: true, canInvite: false }).map((s) => s.id)
    expect(ids).toEqual(["members", "modules"])
  })

  /**
   * Einladen ist ein eigener Bereich, kein Unterzustand von Mitgliedern
   * (Entwurf "Space Menu", Turn 4). Es haengt NICHT am Adminrecht: im WoT
   * laedt jedes Mitglied ein, nur der Creator entfernt.
   */
  it("haengt Einladen an, sobald eingeladen werden kann — auch ohne Adminrecht", () => {
    expect(spaceConfigSections({ isAdmin: false, canInvite: true }).map((s) => s.id))
      .toEqual(["members", "invite"])
    expect(spaceConfigSections({ isAdmin: true, canInvite: true }).map((s) => s.id))
      .toEqual(["members", "modules", "invite"])
  })

  it("beginnt immer mit Mitgliedern — der Startwert braucht keine Sonderregel", () => {
    for (const isAdmin of [true, false]) {
      for (const canInvite of [true, false]) {
        expect(spaceConfigSections({ isAdmin, canInvite })[0].id).toBe("members")
      }
    }
  })

  it("gibt jedem Bereich Beschriftung und Symbol", () => {
    for (const section of spaceConfigSections({ isAdmin: true, canInvite: true })) {
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
  it("laesst ohne Modulrecht und ohne Einladen nur einen Bereich uebrig", () => {
    expect(spaceConfigSections({ isAdmin: false, canInvite: false })).toHaveLength(1)
    expect(spaceConfigSections({ isAdmin: true, canInvite: false }).length).toBeGreaterThan(1)
  })
})

/**
 * `isAdmin` wird aus den Mitgliedern abgeleitet und steht beim Oeffnen noch
 * nicht fest (useMembers laedt). Der Modul-Bereich kann also NACH dem ersten
 * Rendern verschwinden. Ohne Rueckfall zeigte der Dialog den Inhalt eines
 * Eintrags, den es nicht mehr gibt: eine leere Flaeche.
 */
describe("resolveConfigSection", () => {
  const memberSections = spaceConfigSections({ isAdmin: false, canInvite: false })
  const adminSections = spaceConfigSections({ isAdmin: true, canInvite: false })

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

/**
 * Die Kontaktliste im Bereich "Einladen" (Entwurf 4a) filtert dieselbe
 * Quelle wie zuvor der Picker: `invitableContacts` — aktiv, nicht Mitglied,
 * nicht gerade eingeladen. Gesucht wird ueber Name UND Kennung, denn ohne
 * gesetzten Namen ist die Kennung alles, was eine Zeile unterscheidet.
 */
describe("filterInvitableContacts", () => {
  const contacts = [
    { id: "did:key:zTOM", name: "Tom Richter" },
    { id: "did:key:zNINA", name: "Nina Kowalski" },
    { id: "did:key:zANON" },
  ]

  it("gibt ohne Suchbegriff alle zurueck", () => {
    expect(filterInvitableContacts(contacts, "")).toHaveLength(3)
    expect(filterInvitableContacts(contacts, "   ")).toHaveLength(3)
  })

  it("sucht ohne Ruecksicht auf Gross- und Kleinschreibung", () => {
    expect(filterInvitableContacts(contacts, "nina").map((c) => c.id)).toEqual(["did:key:zNINA"])
    expect(filterInvitableContacts(contacts, "RICHTER").map((c) => c.id)).toEqual(["did:key:zTOM"])
  })

  it("findet einen Kontakt ohne Namen ueber die Kennung", () => {
    expect(filterInvitableContacts(contacts, "zanon").map((c) => c.id)).toEqual(["did:key:zANON"])
  })

  it("gibt eine leere Liste zurueck, wenn nichts passt", () => {
    expect(filterInvitableContacts(contacts, "xyz")).toEqual([])
  })
})
