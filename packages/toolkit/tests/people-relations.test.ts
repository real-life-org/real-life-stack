import { describe, expect, it } from "vitest"
import type { Relation } from "@real-life-stack/data-interface"

import {
  peopleDataKey,
  isPeopleDataKey,
  resolvePeopleFields,
  peopleRelationsFromWidgetData,
  peopleRelationsToWidgetData,
} from "../src/components/composer/people-relations"
import type { ContentTypeConfig } from "../src/components/composer/content-composer"

/** Karabirrdt-Fall: eine Aufgabe mit „Kann ich" und „Will lernen". */
const twoFieldType: ContentTypeConfig = {
  id: "task",
  label: "Aufgabe",
  defaultWidgets: ["title", "people"],
  peopleRelations: [
    { predicate: "assignedTo", label: "Kann ich" },
    { predicate: "wantsToLearn", label: "Will lernen" },
  ],
}

/** Kurzform: genau ein Personenfeld, wie bisher. */
const singleFieldType: ContentTypeConfig = {
  id: "event",
  label: "Veranstaltung",
  defaultWidgets: ["title", "people"],
  peopleRelation: { predicate: "invited" },
  widgetLabels: { people: "Eingeladen" },
}

describe("peopleDataKey", () => {
  it("leitet den Datenschlüssel aus dem Prädikat ab", () => {
    expect(peopleDataKey("wantsToLearn")).toBe("people:wantsToLearn")
    expect(isPeopleDataKey("people:wantsToLearn")).toBe(true)
    expect(isPeopleDataKey("people")).toBe(false)
    expect(isPeopleDataKey("tags")).toBe(false)
  })
})

describe("resolvePeopleFields", () => {
  it("gibt für jeden peopleRelations-Eintrag ein Feld zurück; das erste bleibt data.people", () => {
    expect(resolvePeopleFields(twoFieldType)).toEqual([
      { predicate: "assignedTo", dataKey: "people", label: "Kann ich" },
      { predicate: "wantsToLearn", dataKey: "people:wantsToLearn", label: "Will lernen" },
    ])
  })

  it("respektiert einen explizit gesetzten dataKey", () => {
    const fields = resolvePeopleFields({
      ...twoFieldType,
      peopleRelations: [
        { predicate: "assignedTo", label: "Kann ich", dataKey: "people:assignedTo" },
      ],
    })
    expect(fields).toEqual([
      { predicate: "assignedTo", dataKey: "people:assignedTo", label: "Kann ich" },
    ])
  })

  it("versteht die Einzahl-Kurzform peopleRelation weiterhin", () => {
    expect(resolvePeopleFields(singleFieldType)).toEqual([
      { predicate: "invited", dataKey: "people", label: "Eingeladen" },
    ])
  })

  it("liefert auch ohne deklarierte Relation genau ein Feld", () => {
    expect(resolvePeopleFields({ id: "post", label: "Post", defaultWidgets: ["people"] })).toEqual([
      { predicate: undefined, dataKey: "people", label: "Personen" },
    ])
  })
})

describe("peopleRelationsFromWidgetData", () => {
  it("schreibt zwei Prädikate aus zwei Feldern", () => {
    const relations = peopleRelationsFromWidgetData(
      twoFieldType,
      { people: ["u1"], "people:wantsToLearn": ["u2", "u3"] },
      undefined,
    )
    expect(relations).toEqual([
      { predicate: "assignedTo", target: "global:u1" },
      { predicate: "wantsToLearn", target: "global:u2" },
      { predicate: "wantsToLearn", target: "global:u3" },
    ])
  })

  it("lässt Relationen anderer Prädikate unangetastet", () => {
    const existing: Relation[] = [
      { predicate: "commentOn", target: "item:x" },
      { predicate: "assignedTo", target: "global:alt" },
      { predicate: "wantsToLearn", target: "global:alt" },
    ]
    const relations = peopleRelationsFromWidgetData(
      twoFieldType,
      { people: ["u1"], "people:wantsToLearn": [] },
      existing,
    )
    expect(relations).toEqual([
      { predicate: "commentOn", target: "item:x" },
      { predicate: "assignedTo", target: "global:u1" },
    ])
  })

  it("lässt ein nicht eingereichtes Feld unverändert", () => {
    const existing: Relation[] = [
      { predicate: "assignedTo", target: "global:alt" },
      { predicate: "wantsToLearn", target: "global:lern" },
    ]
    const relations = peopleRelationsFromWidgetData(twoFieldType, { people: ["u1"] }, existing)
    expect(relations).toEqual([
      { predicate: "wantsToLearn", target: "global:lern" },
      { predicate: "assignedTo", target: "global:u1" },
    ])
  })

  it("gibt undefined zurück, wenn kein Personenfeld eingereicht wurde", () => {
    expect(peopleRelationsFromWidgetData(twoFieldType, { title: "x" }, undefined)).toBeUndefined()
  })

  it("bleibt für die Einzahl-Kurzform rückwärtskompatibel", () => {
    expect(
      peopleRelationsFromWidgetData(singleFieldType, { people: ["u1", "u2"] }, undefined),
    ).toEqual([
      { predicate: "invited", target: "global:u1" },
      { predicate: "invited", target: "global:u2" },
    ])
  })

  it("ohne deklariertes Prädikat entstehen keine Relationen", () => {
    expect(
      peopleRelationsFromWidgetData(
        { id: "post", label: "Post", defaultWidgets: ["people"] },
        { people: ["u1"] },
        undefined,
      ),
    ).toBeUndefined()
  })
})

describe("peopleRelationsToWidgetData", () => {
  it("liest beide Prädikate je Feld zurück", () => {
    const relations: Relation[] = [
      { predicate: "commentOn", target: "item:x" },
      { predicate: "assignedTo", target: "global:u1" },
      { predicate: "wantsToLearn", target: "global:u2" },
    ]
    expect(peopleRelationsToWidgetData(twoFieldType, relations)).toEqual({
      people: ["u1"],
      "people:wantsToLearn": ["u2"],
    })
  })

  it("lässt leere Felder weg", () => {
    expect(
      peopleRelationsToWidgetData(twoFieldType, [{ predicate: "assignedTo", target: "global:u1" }]),
    ).toEqual({ people: ["u1"] })
  })

  it("bleibt für die Einzahl-Kurzform rückwärtskompatibel", () => {
    expect(
      peopleRelationsToWidgetData(singleFieldType, [
        { predicate: "invited", target: "global:u1" },
        { predicate: "assignedTo", target: "global:u9" },
      ]),
    ).toEqual({ people: ["u1"] })
  })

  it("verträgt fehlende Relationen", () => {
    expect(peopleRelationsToWidgetData(twoFieldType, undefined)).toEqual({})
  })
})
