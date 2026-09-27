// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { composeTypeManifest, TOOLKIT_TYPE_LAYER } from "@real-life-stack/data-interface"

import {
  peopleQualifierKey,
  peopleRelationsFromWidgetData,
  peopleRelationsToWidgetData,
  resolvePeopleFields,
} from "../src/components/composer/people-relations"
import { PeopleWidget } from "../src/components/composer/widgets/people-widget"
import { contentTypeFromRegister } from "../src/components/composer/content-types"
import { createComposerMapping } from "../src/components/composer/composer-mapping"
import {
  registerTypePresentation,
  resetTypePresentationForTests,
  setTypeManifest,
} from "../src/components/preview/type-presentation"

/**
 * S2, C1 Schreibform: Chips mit Qualifier-Text, Antippen wechselt den
 * Qualifier im Kreis der Werte aus dem Register (shared-components,
 * Edit-Regeln 6); Kanten behalten ihr meta (08, Qualifier an Kanten, Regel 11).
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => resetTypePresentationForTests())

const QUALIFIER = { key: "role", values: [{ id: "can", label: "kann" }, { id: "learns", label: "lernt" }] }
const CONFIG = { peopleRelations: [{ predicate: "assignedTo", label: "Wer", qualifier: QUALIFIER }] }

describe("people-relations mit Qualifier", () => {
  it("schreibt den Qualifier nach meta[key] und erhält das übrige meta bestehender Kanten", () => {
    const existing = [
      { predicate: "assignedTo", target: "global:timo", meta: { role: "can", note: "bleibt" } },
      { predicate: "assignedTo", target: "global:weg", meta: { role: "can" } },
      { predicate: "invited", target: "global:x", meta: { any: 1 } },
    ]
    const data = { people: ["timo", "lena"], [peopleQualifierKey("people")]: { timo: "learns", lena: "can" } }
    expect(peopleRelationsFromWidgetData(CONFIG, data, existing)).toEqual([
      { predicate: "invited", target: "global:x", meta: { any: 1 } },
      { predicate: "assignedTo", target: "global:timo", meta: { role: "learns", note: "bleibt" } },
      { predicate: "assignedTo", target: "global:lena", meta: { role: "can" } },
    ])
  })

  it("erhält meta auch ohne Qualifier am Feld (08, Regel 11)", () => {
    const existing = [{ predicate: "assignedTo", target: "global:timo", meta: { role: "learns" } }]
    const plain = { peopleRelations: [{ predicate: "assignedTo", label: "Wer" }] }
    expect(peopleRelationsFromWidgetData(plain, { people: ["timo"] }, existing)).toEqual(existing)
  })

  it("liest den Qualifier zurück ins Formular", () => {
    const relations = [
      { predicate: "assignedTo", target: "global:timo", meta: { role: "learns" } },
      { predicate: "assignedTo", target: "global:lena" },
    ]
    expect(peopleRelationsToWidgetData(CONFIG, relations)).toEqual({
      people: ["timo", "lena"],
      [peopleQualifierKey("people")]: { timo: "learns" },
    })
  })

  it("der Qualifier-Schlüssel landet nie in item.data", () => {
    const mapping = createComposerMapping([{ id: "task", label: "Task", defaultWidgets: ["title", "people"], ...CONFIG }])
    const result = mapping.mapSubmission(
      { contentType: "task", data: { title: "T", people: ["timo"], [peopleQualifierKey("people")]: { timo: "can" } } } as never,
      { existingItem: undefined } as never,
    )
    expect(result.data).toEqual({ title: "T" })
    expect(result.relations).toEqual([{ predicate: "assignedTo", target: "global:timo", meta: { role: "can" } }])
  })
})

describe("Register → Composer", () => {
  it("event: EIN Personenfeld „Wer“ mit „Einladen…“, attends trägt seinen Zustand dorthin", () => {
    const event = contentTypeFromRegister("event")
    expect(event.peopleRelations).toHaveLength(1)
    expect(event.peopleRelations?.[0]).toMatchObject({ predicate: "invited", label: "Wer", placeholder: "Einladen…", record: { predicate: "attends", key: "role" } })
  })

  it("eine Kante mit Qualifier gibt ihn an das Personenfeld weiter (App-Typ wie die Karabirrdt-Karte)", () => {
    setTypeManifest(
      composeTypeManifest([
        TOOLKIT_TYPE_LAYER,
        { name: "app", definitions: [{ id: "card", vocabularies: [], relations: [{ predicate: "assignedTo", itemRole: "from", otherKind: "person" }] }] },
      ]),
    )
    registerTypePresentation("app", [
      {
        id: "card",
        label: "Karte",
        fields: [{ key: "title", widget: "title", pos: "head" }],
        edges: [{ predicate: "assignedTo", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "Wer", qualifier: QUALIFIER }],
      },
    ])
    const card = contentTypeFromRegister("card")
    expect(card.peopleRelations).toEqual([{ predicate: "assignedTo", label: "Wer", qualifier: QUALIFIER }])
    expect(resolvePeopleFields(card)[0].qualifier).toEqual(QUALIFIER)
  })
})

describe("PeopleWidget: Antippen wechselt den Qualifier", () => {
  it("zeigt den Qualifier am Chip und schaltet im Kreis der Werte", async () => {
    const onQualifiersChange = vi.fn()
    const container = document.createElement("div")
    const root = createRoot(container)
    await act(async () => {
      root.render(
        createElement(PeopleWidget, {
          value: ["timo"],
          onChange: () => {},
          label: "Wer",
          options: [{ id: "timo", name: "Timo" }],
          qualifier: QUALIFIER,
          qualifiers: { timo: "learns" },
          onQualifiersChange,
        }),
      )
    })
    const toggle = container.querySelector("[data-qualifier-toggle]") as HTMLButtonElement
    expect(toggle.textContent).toContain("lernt")
    await act(async () => toggle.click())
    // lernt → kann (im Kreis)
    expect(onQualifiersChange).toHaveBeenCalledWith({ timo: "can" })
    await act(async () => root.unmount())
  })

  it("setzt beim Hinzufügen den ersten Wert", async () => {
    const onQualifiersChange = vi.fn()
    const onChange = vi.fn()
    const container = document.createElement("div")
    const root = createRoot(container)
    await act(async () => {
      root.render(
        createElement(PeopleWidget, {
          value: [],
          onChange,
          label: "Wer",
          options: [],
          quickSuggestions: [{ id: "lena", name: "Lena" }],
          qualifier: QUALIFIER,
          qualifiers: {},
          onQualifiersChange,
          placeholder: "Zuweisen…",
        }),
      )
    })
    expect((container.querySelector("input") as HTMLInputElement).placeholder).toBe("Zuweisen…")
    const quick = [...container.querySelectorAll("button")].find((b) => b.textContent === "Lena") as HTMLButtonElement
    await act(async () => quick.click())
    expect(onChange).toHaveBeenCalledWith(["lena"])
    expect(onQualifiersChange).toHaveBeenCalledWith({ lena: "can" })
    await act(async () => root.unmount())
  })
})

describe("Nachzügler S1: Space im Bearbeiten-Kopf ohne Verschieben (Edit-Regeln 3)", () => {
  it("zeigt den bekannten Space fest statt ihn wegzulassen; mit Verschieben bleibt er wählbar", async () => {
    const { withEditGroup, withGroupOptions, GROUP_FIXED_NO_MOVE } = await import("../src/components/composer/composer-mapping")
    const { pickContentTypes } = await import("../src/components/composer/content-types")
    const types = withGroupOptions(pickContentTypes("task"), [{ id: "a", name: "Garten" }, { id: "b", name: "Hof" }], "a")
    expect(withEditGroup(types, true)).toBe(types)
    const fixed = withEditGroup(types, false)[0]
    expect(fixed.groupOptions).toEqual([{ id: "a", name: "Garten" }])
    expect(fixed.defaultGroup).toBe("a")
    expect(fixed.groupFixedReason).toBe(GROUP_FIXED_NO_MOVE)
    // Ohne bekannten Space kein Space im Kopf.
    const unknown = withEditGroup(pickContentTypes("task"), false)[0]
    expect(unknown.groupOptions).toBeUndefined()
  })
})
