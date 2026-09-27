import { afterEach, describe, expect, it } from "vitest"
import {
  composeTypeManifest,
  TOOLKIT_TYPE_LAYER,
  type Item,
  type RelationRecord,
  type TypeManifestEntry,
} from "@real-life-stack/data-interface"

import {
  registerTypePresentation,
  resetTypePresentationForTests,
  resolveTypePresentation,
  setTypeManifest,
} from "../src/components/preview/type-presentation"
import { peopleLine, peopleLineEdges, peopleLineGroups, summarizePeople, PEOPLE_SUMMARY_THRESHOLD } from "../src/components/preview/people-line"
import type { EdgeEntry } from "../src/components/preview/field-register"

/**
 * S2, C1 Lesen: eine Menschen-Zeile je Typ aus seinen Personen-Kanten
 * (shared-components, Detail-Anatomie, Regel 5; 08 → Teilnahme am Event).
 */

afterEach(() => resetTypePresentationForTests())

const EVENT: Item = {
  id: "e1",
  type: "event",
  createdAt: "2026-09-20T10:00:00.000Z",
  createdBy: "anton",
  data: { title: "Ernten" },
  relations: [
    { predicate: "invited", target: "global:timo" },
    { predicate: "invited", target: "global:lena" },
    { predicate: "invited", target: "global:ulf" },
  ],
}

const attends = (id: string, createdBy: string, subject: string, role: string, createdAt = "2026-09-27T10:00:00.000Z"): RelationRecord => ({
  id,
  predicate: "attends",
  from: `global:${subject}`,
  to: "item:e1",
  createdBy,
  createdAt,
  fields: { role, tense: "coming" },
})

describe("Register: Kerntypen in S2", () => {
  it("event führt invited (eingebettet) und attends (Record, one-per-subject) mit Selbstaktion", () => {
    const edges = resolveTypePresentation("event").edges ?? []
    const attendsEdge = edges.find((e) => e.predicate === "attends")!
    expect(attendsEdge).toMatchObject({ itemRole: "to", storage: "record", widget: "people", pos: "meta", count: "one-per-subject" })
    expect(attendsEdge.qualifier?.key).toBe("role")
    expect(attendsEdge.qualifier?.values.map((v) => v.id)).toEqual(["going", "maybe", "declined"])
    expect(attendsEdge.selfAction?.qualifiers).toEqual(["going", "maybe", "declined"])
    expect(attendsEdge.qualifier?.values.map((v) => v.action)).toEqual(["Zusagen", "Vielleicht", "Absagen"])
  })

  it("task führt „Übernehmen“ als Selbstaktion an assignedTo, ohne can/learns (Entscheidung 17)", () => {
    const assigned = resolveTypePresentation("task").edges?.find((e) => e.predicate === "assignedTo")
    expect(assigned?.selfAction).toMatchObject({ label: "Übernehmen", mine: "Übernommen" })
    expect(assigned?.qualifier).toBeUndefined()
  })

  it("prüft beim Registrieren: selfAction.qualifiers nennt nur deklarierte Werte", () => {
    const TYP: TypeManifestEntry = { id: "gig", vocabularies: [], relations: [{ predicate: "plays", itemRole: "to", otherKind: "person" }] }
    setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER, { name: "app", definitions: [TYP] }]))
    const kante = (qualifiers: string[]): EdgeEntry => ({
      predicate: "plays",
      itemRole: "to",
      storage: "record",
      widget: "people",
      pos: "meta",
      label: "Spielt",
      qualifier: { key: "role", values: [{ id: "lead", label: "Leitung" }] },
      count: "one-per-subject",
      selfAction: { label: "Mitspielen", mine: "Dabei", qualifiers },
    })
    expect(() => registerTypePresentation("app", [{ id: "gig", label: "Gig", edges: [kante(["solo"])] }])).toThrow(/solo/)
    expect(() => registerTypePresentation("app", [{ id: "gig", label: "Gig", edges: [kante(["lead"])] }])).not.toThrow()
  })
})

describe("peopleLine (rein)", () => {
  const edges = () => peopleLineEdges(resolveTypePresentation("event").edges)

  it("eine Zeile aus invited und attends: attends zeigt seinen Qualifier statt „eingeladen“", () => {
    const line = peopleLine(EVENT, edges(), [attends("rel-1", "timo", "timo", "going")])
    const timo = line.find((e) => e.userId === "timo")!
    expect(timo.qualifier).toEqual({ id: "going", label: "zugesagt" })
    expect(timo.speakerId).toBeUndefined()
    const lena = line.find((e) => e.userId === "lena")!
    expect(lena.qualifier?.label).toBe("eingeladen")
  })

  it("Aussage über andere: „eingetragen von“ nennt den Sprecher", () => {
    const line = peopleLine(EVENT, edges(), [attends("rel-2", "anton", "maria", "going")])
    expect(line.find((e) => e.userId === "maria")).toMatchObject({ speakerId: "anton", qualifier: { id: "going" } })
  })

  it("declined steht nicht in der Zeile, aber in der vollständigen Liste", () => {
    const line = peopleLine(EVENT, edges(), [attends("rel-3", "ulf", "ulf", "declined")])
    const ulf = line.find((e) => e.userId === "ulf")!
    expect(ulf.hidden).toBe(true)
    expect(line.filter((e) => !e.hidden).map((e) => e.userId)).not.toContain("ulf")
  })

  it("Testvektor 08: Jonas' declined gewinnt über Antons going — Timo fehlt in der Zeile", () => {
    const line = peopleLine(EVENT, edges(), [
      attends("rel-3f", "anton", "timo", "going"),
      attends("rel-a1", "jonas", "timo", "declined"),
    ])
    expect(line.find((e) => e.userId === "timo")).toMatchObject({ hidden: true, speakerId: "jonas" })
  })

  it("Reihenfolge: Record-Qualifier in Register-Reihenfolge, dann die Eingeladenen", () => {
    const line = peopleLine(EVENT, edges(), [
      attends("rel-1", "lena", "lena", "maybe"),
      attends("rel-2", "timo", "timo", "going"),
    ])
    expect(line.filter((e) => !e.hidden).map((e) => e.userId)).toEqual(["timo", "lena", "ulf"])
  })

  it("eine Kante allein zeigt keinen Qualifier ohne Deklaration (Aufgabe)", () => {
    const task: Item = { ...EVENT, id: "t1", type: "task", relations: [{ predicate: "assignedTo", target: "global:timo" }] }
    const line = peopleLine(task, peopleLineEdges(resolveTypePresentation("task").edges), [])
    expect(line).toEqual([expect.objectContaining({ userId: "timo", qualifier: undefined, hidden: false })])
  })

  it("eingebetteter Qualifier aus meta (Karabirrdt: assignedTo mit role can | learns)", () => {
    const kante: EdgeEntry = {
      predicate: "assignedTo",
      itemRole: "from",
      storage: "embedded",
      widget: "people",
      pos: "meta",
      label: "Zugewiesen",
      qualifier: { key: "role", values: [{ id: "can", label: "kann" }, { id: "learns", label: "lernt" }] },
    }
    const task: Item = {
      ...EVENT,
      type: "task",
      relations: [
        { predicate: "assignedTo", target: "global:timo", meta: { role: "learns" } },
        { predicate: "assignedTo", target: "global:anton", meta: { role: "unbekannt" } },
      ],
    }
    const line = peopleLine(task, [kante], [])
    expect(line[0]).toMatchObject({ userId: "timo", qualifier: { id: "learns", label: "lernt" } })
    // Ein Wert außerhalb der deklarierten Menge ist kein Qualifier.
    expect(line[1]).toMatchObject({ userId: "anton", qualifier: undefined })
  })
})

describe("Zustand „Viele“ (shared-components, Zustände)", () => {
  it(`fasst ab mehr als ${PEOPLE_SUMMARY_THRESHOLD} sichtbaren Personen je Qualifier zusammen`, () => {
    const many = Array.from({ length: 12 }, (_, i) => attends(`rel-${i}`, `p${i}`, `p${i}`, i < 9 ? "going" : "maybe"))
    const line = peopleLine({ ...EVENT, relations: [{ predicate: "invited", target: "global:x" }] }, peopleLineEdges(resolveTypePresentation("event").edges), many)
    const summary = summarizePeople(line)
    expect(summary?.map((g) => [g.label, g.count, g.entries.length])).toEqual([
      ["zugesagt", 9, 3],
      ["vielleicht", 3, 3],
      ["eingeladen", 1, 1],
    ])
    expect(summarizePeople(line.slice(0, PEOPLE_SUMMARY_THRESHOLD))).toBeNull()
  })
})

describe("Codex Runde 1, Befund 5: nur die deklarierte Kombination teilt eine Zeile", () => {
  const TYP: TypeManifestEntry = {
    id: "gig",
    vocabularies: [],
    relations: [
      { predicate: "hosts", itemRole: "from", otherKind: "person" },
      { predicate: "plays", itemRole: "from", otherKind: "person" },
      { predicate: "confirms", itemRole: "to", otherKind: "person" },
    ],
  }
  const people = (predicate: string, extra: Partial<EdgeEntry> = {}): EdgeEntry => ({
    predicate, itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: predicate, ...extra,
  })

  it("zwei Personen-Kanten ohne joins stehen in zwei Zeilen", () => {
    expect(peopleLineGroups([people("hosts"), people("plays")]).map((g) => g.map((e) => e.predicate))).toEqual([["hosts"], ["plays"]])
  })

  it("das Event führt invited und attends über attends.joins in einer Zeile", () => {
    expect(peopleLineGroups(resolveTypePresentation("event").edges).map((g) => g.map((e) => e.predicate))).toEqual([["invited", "attends"]])
  })

  it("joins muss eine Personen-Kante desselben Typs nennen", () => {
    setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER, { name: "app", definitions: [TYP] }]))
    const confirms: EdgeEntry = {
      predicate: "confirms", itemRole: "to", storage: "record", widget: "people", pos: "meta", label: "Bestätigt",
      qualifier: { key: "role", values: [{ id: "yes", label: "ja" }] }, count: "one-per-subject", joins: "gibt-es-nicht",
    }
    expect(() => registerTypePresentation("app", [{ id: "gig", label: "Gig", edges: [people("hosts"), confirms] }])).toThrow(/joins/)
    expect(() => registerTypePresentation("app", [{ id: "gig", label: "Gig", edges: [people("hosts"), { ...confirms, joins: "hosts" }] }])).not.toThrow()
  })
})

describe("Codex Runde 1/2, Befund 4/5: collect-accepted", () => {
  it("wird für Personen-Kanten ausdrücklich abgelehnt, statt anders ausgewertet", () => {
    setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER, { name: "app", definitions: [{ id: "gig", vocabularies: [], relations: [{ predicate: "confirms", itemRole: "to", otherKind: "person" }] }] }]))
    expect(() =>
      registerTypePresentation("app", [{
        id: "gig", label: "Gig",
        edges: [{ predicate: "confirms", itemRole: "to", storage: "record", widget: "people", pos: "meta", label: "War dabei",
          qualifier: { key: "role", values: [{ id: "yes", label: "dabei" }] }, count: "collect-accepted" }],
      }]),
    ).toThrow(/collect-accepted/)
  })
})
