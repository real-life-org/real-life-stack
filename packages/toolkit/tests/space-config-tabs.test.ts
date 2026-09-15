import { describe, expect, it } from "vitest"

import {
  resolveConfigTab,
  spaceConfigTabs,
  type SpaceConfigTabId,
} from "../src/components/layout/group-dialog"

/**
 * Die Faecher des Space-Dialogs sind EINE Liste, keine drei. Vorher haetten
 * Leiste, Inhalte und der Startwert die Frage "welche Faecher gibt es" je
 * eigenstaendig beantwortet — dasselbe lautlose Auseinanderlaufen, das das
 * Modul-Register (Spec 01) schon einmal eingesammelt hat.
 */
describe("spaceConfigTabs", () => {
  it("zeigt jedem Mitglied die Mitglieder", () => {
    const ids = spaceConfigTabs({ isAdmin: false }).map((t) => t.id)
    expect(ids).toEqual(["members"])
  })

  it("haengt Module nur fuer Admins an", () => {
    const ids = spaceConfigTabs({ isAdmin: true }).map((t) => t.id)
    expect(ids).toEqual(["members", "modules"])
  })

  it("beginnt immer mit Mitgliedern — der Startwert braucht keine Sonderregel", () => {
    for (const isAdmin of [true, false]) {
      expect(spaceConfigTabs({ isAdmin })[0].id).toBe("members")
    }
  })

  it("gibt jedem Fach eine sichtbare Beschriftung", () => {
    for (const tab of spaceConfigTabs({ isAdmin: true })) {
      expect(tab.label.trim()).not.toBe("")
    }
  })

  /**
   * Bild und Name stehen im Kopf, nicht in einem Fach. Ohne Modulrecht bleibt
   * darum genau ein Fach uebrig — eine Leiste mit einem einzigen Reiter waere
   * eine Wahl ohne Alternative. Die Flaeche entscheidet das an dieser Zahl.
   */
  it("laesst ohne Modulrecht nur ein Fach uebrig", () => {
    expect(spaceConfigTabs({ isAdmin: false })).toHaveLength(1)
    expect(spaceConfigTabs({ isAdmin: true }).length).toBeGreaterThan(1)
  })
})

/**
 * `isAdmin` wird aus den Mitgliedern abgeleitet und steht beim ersten Rendern
 * noch nicht fest (useMembers laedt). Das Modul-Fach kann also NACH dem
 * Oeffnen verschwinden. Radix zeigt dann einen Inhalt zu einem Reiter, den es
 * nicht mehr gibt: ein leerer Dialog. Der Rueckfall gehoert darum in eine
 * Funktion, nicht in eine Bedingung am Rendern.
 */
describe("resolveConfigTab", () => {
  const memberTabs = spaceConfigTabs({ isAdmin: false })
  const adminTabs = spaceConfigTabs({ isAdmin: true })

  it("laesst ein vorhandenes Fach unangetastet", () => {
    expect(resolveConfigTab("members", memberTabs)).toBe("members")
    expect(resolveConfigTab("modules", adminTabs)).toBe("modules")
  })

  it("faellt auf das erste Fach zurueck, wenn das gewaehlte wegfaellt", () => {
    expect(resolveConfigTab("modules", memberTabs)).toBe("members")
  })

  it("faellt auch bei unbekannten Werten zurueck", () => {
    expect(resolveConfigTab("theme" as SpaceConfigTabId, memberTabs)).toBe("members")
    expect(resolveConfigTab("" as SpaceConfigTabId, adminTabs)).toBe("members")
  })
})
