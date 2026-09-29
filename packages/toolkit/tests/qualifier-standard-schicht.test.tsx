// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { useItem } from "../src/hooks/use-items"
import {
  registerTypePresentation,
  resetTypePresentationForTests,
  resolveTypePresentation,
  type QualifierValuesEntry,
  type TypePresentationFragment,
} from "../src/components/preview/type-presentation"
import { peopleLine, peopleLineGroups } from "../src/components/preview/people-line"
import { contentTypeFromRegister } from "../src/components/composer/content-types"
import { EXAMPLE_LEARNING_LAYER } from "../src/story-support/example-learning-layer"

/**
 * #556: Den Standardwert eines Qualifiers DARF die Register-Schicht eines
 * Moduls oder einer App setzen (Spec 06, Regeln 7 und 20; Erweiterung und
 * Merge, Punkt 2). Er MUSS ein Wert des Kerns oder derselben Schicht sein; je
 * Kante höchstens eine Quelle; ein Kern-Standard ist nicht überschreibbar.
 * Formular und Pills lesen den Standard, die Leseform zeigt ihn nicht.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const TIMO = "u-timo"

const assigned = (type = "task") => resolveTypePresentation(type).edges?.find((e) => e.predicate === "assignedTo")

/** Die Beispiel-Schicht (can/learns) mit Standard `can`. */
const WITH_DEFAULT: TypePresentationFragment = {
  ...EXAMPLE_LEARNING_LAYER,
  qualifierValues: [{ ...EXAMPLE_LEARNING_LAYER.qualifierValues![0]!, default: "can" }],
}

const values = (entry: Partial<QualifierValuesEntry>): TypePresentationFragment => ({
  id: "task",
  qualifierValues: [{ predicate: "assignedTo", itemRole: "from", values: [], ...entry }],
})

afterEach(() => resetTypePresentationForTests())

describe("Standardwert aus der Schicht: Kompositionsprüfung (Regel 20)", () => {
  it("eine Schicht setzt default mit ihren Werten; das zusammengesetzte Register trägt ihn", () => {
    expect(assigned()?.qualifier?.default).toBeUndefined()
    registerTypePresentation("beispiel", { extensions: [WITH_DEFAULT] })
    expect(assigned()?.qualifier).toMatchObject({ key: "role", default: "can" })
    expect(assigned()?.qualifier?.values.map((v) => v.id)).toEqual(["can", "learns"])
  })

  it("ohne die Schicht bleibt eine Kante ohne Wert ohne Qualifier (kein Standard)", () => {
    registerTypePresentation("beispiel", { extensions: [EXAMPLE_LEARNING_LAYER] })
    expect(assigned()?.qualifier?.default).toBeUndefined()
  })

  it("der Standard MUSS ein Wert sein, den der Kern oder dieselbe Schicht deklariert", () => {
    expect(() => registerTypePresentation("app", { extensions: [values({ values: [{ id: "can", label: "kann" }], default: "leads" })] })).toThrow(/leads/)
  })

  it("ein Wert einer ANDEREN Schicht als Standard wird in jeder Reihenfolge abgelehnt", () => {
    const vocabulary = { extensions: [EXAMPLE_LEARNING_LAYER] }
    const onlyDefault = { extensions: [values({ default: "can" })] }
    registerTypePresentation("a-vokabular", vocabulary)
    expect(() => registerTypePresentation("b-standard", onlyDefault)).toThrow(/derselben Schicht/)
    resetTypePresentationForTests()
    expect(() => registerTypePresentation("0-standard", onlyDefault)).toThrow(/can/)
    registerTypePresentation("z-vokabular", vocabulary)
    expect(() => registerTypePresentation("0-standard", onlyDefault)).toThrow(/derselben Schicht/)
  })

  it("den Standard setzen zwei Schichten nicht, auch nicht mit demselben Wert (Konflikt, in jeder Reihenfolge)", () => {
    const second = { extensions: [values({ values: [{ id: "leads", label: "leitet" }], default: "leads" })] }
    registerTypePresentation("beispiel", { extensions: [WITH_DEFAULT] })
    expect(() => registerTypePresentation("zweite", second)).toThrow(/Standard.*bereits/)
    resetTypePresentationForTests()
    registerTypePresentation("zweite", second)
    expect(() => registerTypePresentation("beispiel", { extensions: [WITH_DEFAULT] })).toThrow(/Standard.*bereits/)
    // Derselbe Wert aus zwei Schichten: auch ein Konflikt.
    resetTypePresentationForTests()
    registerTypePresentation("beispiel", { extensions: [WITH_DEFAULT] })
    expect(() =>
      registerTypePresentation("dritte", { extensions: [values({ values: [{ id: "leads", label: "leitet" }], default: "leads" })] }),
    ).toThrow(/bereits/)
  })

  it("dieselbe Schicht nennt den Standard je Kante nur einmal", () => {
    expect(() =>
      registerTypePresentation("app", {
        extensions: [{
          id: "task",
          qualifierValues: [
            { predicate: "assignedTo", itemRole: "from", values: [{ id: "can", label: "kann" }], default: "can" },
            { predicate: "assignedTo", itemRole: "from", values: [{ id: "learns", label: "lernt" }], default: "learns" },
          ],
        }],
      }),
    ).toThrow(/Standard.*bereits/)
  })

  it("nennt der Kern den Standard, DARF ihn keine Schicht setzen", () => {
    // Der Kern setzt heute an keiner Kante einen Standard; die Zusage (attends)
    // bekommt für diesen Test einen und verliert ihn danach wieder.
    const attends = resolveTypePresentation("event").edges!.find((e) => e.predicate === "attends")!
    const qualifier = attends.qualifier as { default?: string }
    qualifier.default = "going"
    try {
      expect(() =>
        registerTypePresentation("app", { extensions: [{ id: "event", qualifierValues: [{ predicate: "attends", itemRole: "to", values: [], default: "maybe" }] }] }),
      ).toThrow(/Kern/)
      expect(() =>
        registerTypePresentation("app", { extensions: [{ id: "event", qualifierValues: [{ predicate: "attends", itemRole: "to", values: [], default: "going" }] }] }),
      ).toThrow(/Kern/)
    } finally {
      delete qualifier.default
    }
  })

  it("ein Standard aus den Werten des Kerns ist erlaubt", () => {
    registerTypePresentation("app", { extensions: [{ id: "event", qualifierValues: [{ predicate: "attends", itemRole: "to", values: [], default: "going" }] }] })
    expect(resolveTypePresentation("event").edges?.find((e) => e.predicate === "attends")?.qualifier?.default).toBe("going")
  })
})

describe("Formular, Leseform und Pills lesen den Standard der Schicht (Regel 7)", () => {
  it("Leseform: ein fehlender Wert zeigt den Standard nicht („Anna“), ein ausgeschriebener schon („Timo lernt“, „Lena kann“)", () => {
    registerTypePresentation("beispiel", { extensions: [WITH_DEFAULT] })
    const item: Item = {
      id: "t1", type: "task", createdBy: ME, createdAt: "2026-09-29T10:00:00.000Z", data: { title: "T" },
      relations: [
        { predicate: "assignedTo", target: "global:anna" },
        { predicate: "assignedTo", target: "global:timo", meta: { role: "learns" } },
        { predicate: "assignedTo", target: "global:lena", meta: { role: "can" } },
      ],
    }
    const [group] = peopleLineGroups(resolveTypePresentation("task").edges)
    const byUser = Object.fromEntries(peopleLine(item, group!, []).map((e) => [e.userId, e.qualifier?.label]))
    expect(byUser).toEqual({ anna: undefined, timo: "lernt", lena: "kann" })
  })

  it("Formular: der Standard der Schicht geht in das Personenfeld (fehlend = Standard, nie ausgeschrieben)", () => {
    registerTypePresentation("beispiel", { extensions: [WITH_DEFAULT] })
    const people = contentTypeFromRegister("task").peopleRelations?.find((p) => p.predicate === "assignedTo")
    expect(people?.qualifier).toMatchObject({ key: "role", default: "can" })
  })

  describe("Pills", () => {
    let host: HTMLDivElement
    let root: Root
    let connector: MockConnector

    beforeEach(() => {
      host = document.createElement("div")
      document.body.appendChild(host)
      root = createRoot(host)
    })
    afterEach(async () => {
      await act(async () => root.unmount())
      host.remove()
    })

    async function settle() {
      for (let round = 0; round < 5; round++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
        })
      }
    }

    function Live({ id }: { id: string }): ReactNode {
      const { data: item } = useItem(id)
      if (!item) return null
      return createElement(resolveTypePresentation("task").actions!, { item })
    }

    async function render(relations: Item["relations"]) {
      const start: Item = { id: "t1", type: "task", createdBy: TIMO, createdAt: "2026-09-29T10:00:00.000Z", data: { title: "Kompost", status: "in-progress" }, relations }
      connector = new MockConnector(
        {
          items: [start],
          groups: [{ id: "g", name: "Garten", data: {} }],
          users: [{ id: ME, displayName: "Ich" }, { id: TIMO, displayName: "Timo" }],
          groupMembers: { g: [ME, TIMO] },
          groupItems: { g: [start.id] },
        } as never,
      )
      await connector.init()
      connector.setCurrentGroup("g")
      await act(async () => {
        root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Live, { id: start.id })))
      })
      await settle()
    }

    const pill = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)

    it("stehe ich ohne Wert an der Kante, gilt der Standard als mein Zustand: „✓ Kann“ gedrückt", async () => {
      registerTypePresentation("beispiel", { extensions: [WITH_DEFAULT] })
      await render([{ predicate: "assignedTo", target: `global:${ME}` }])
      // Gedrückt steht mein Zustand in seiner Leseform („✓ Kann“), die Rücknahme im Namen.
      expect(pill("Kann")?.getAttribute("aria-pressed")).toBe("true")
      expect(pill("Kann")?.getAttribute("aria-label")).toMatch(/Nicht mehr dabei/)
      expect(pill("Will lernen")?.getAttribute("aria-pressed")).toBe("false")
    })

    it("Codex Runde 2: eine eingebettete Kante mit unbekanntem Wert (role: 42) gilt nicht als Standard", async () => {
      registerTypePresentation("beispiel", { extensions: [WITH_DEFAULT] })
      await render([{ predicate: "assignedTo", target: `global:${ME}`, meta: { role: 42 } }])
      expect(pill("Kann")).toBeUndefined()
      expect(pill("Kann ich")?.getAttribute("aria-pressed")).toBe("false")
    })

    it("ohne Standard zeigt dieselbe Kante den allgemeinen Zustand statt einer gedrückten Pill", async () => {
      registerTypePresentation("beispiel", { extensions: [EXAMPLE_LEARNING_LAYER] })
      await render([{ predicate: "assignedTo", target: `global:${ME}` }])
      expect(pill("Kann")).toBeUndefined()
      expect(pill("Kann ich")?.getAttribute("aria-pressed")).toBe("false")
    })
  })
})

describe("Codex Runde 1", () => {
  it("Befund 2: ein Qualifier-Wert mit der Id „default“ ist als Standard erlaubt (kein reservierter Name)", () => {
    registerTypePresentation("app", { extensions: [values({ values: [{ id: "default", label: "Standard" }], default: "default" })] })
    expect(assigned()?.qualifier?.default).toBe("default")
    resetTypePresentationForTests()
    // Auch wenn eine andere Schicht den Wert „default“ bringt und diese den Standard aus eigenen Werten setzt.
    registerTypePresentation("a", { extensions: [values({ values: [{ id: "default", label: "Standard" }] })] })
    registerTypePresentation("b", { extensions: [values({ values: [{ id: "leads", label: "leitet" }], default: "leads" })] })
    expect(assigned()?.qualifier?.default).toBe("leads")
  })

  describe("Befund 3: Record-Kanten lesen den Standard ebenfalls", () => {
    let host: HTMLDivElement
    let root: Root
    let connector: MockConnector

    beforeEach(() => {
      host = document.createElement("div")
      document.body.appendChild(host)
      root = createRoot(host)
    })
    afterEach(async () => {
      await act(async () => root.unmount())
      host.remove()
    })

    const EVENT: Item = { id: "e1", type: "event", createdBy: TIMO, createdAt: "2026-09-20T10:00:00.000Z", data: { title: "Ernten", start: "2099-07-19T16:00:00.000Z" } }
    const attendsWithoutRole = (createdBy: string, subject: string): Item => ({
      id: `rel-${subject}`,
      type: "relation",
      createdBy,
      createdAt: "2026-09-27T10:00:00.000Z",
      data: { predicate: "attends", tense: "coming" },
      relations: [
        { predicate: "from", target: `global:${subject}` },
        { predicate: "to", target: "item:e1" },
      ],
    })

    async function render(node: ReactNode, extra: Item[]) {
      const items = [EVENT, ...extra]
      connector = new MockConnector(
        {
          items,
          groups: [{ id: "g", name: "Garten", data: {} }],
          users: [{ id: ME, displayName: "Ich" }, { id: TIMO, displayName: "Timo" }],
          groupMembers: { g: [ME, TIMO] },
          groupItems: { g: items.map((i) => i.id) },
        } as never,
      )
      await connector.init()
      connector.setCurrentGroup("g")
      await act(async () => {
        root.render(createElement(ConnectorProvider, { connector: connector as never }, node))
      })
      for (let round = 0; round < 5; round++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
        })
      }
    }

    const goingDefault = () =>
      registerTypePresentation("app", { extensions: [{ id: "event", qualifierValues: [{ predicate: "attends", itemRole: "to", values: [], default: "going" }] }] })

    it("Pills: mein Record ohne role gilt als Standard („Zugesagt“ gedrückt)", async () => {
      goingDefault()
      const Actions = resolveTypePresentation("event").actions!
      await render(createElement(Actions, { item: EVENT }), [attendsWithoutRole(ME, ME)])
      const pill = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Zugesagt")
      expect(pill?.getAttribute("aria-pressed")).toBe("true")
    })

    it("Codex Runde 2: ein vorhandener unbekannter Wert (role: 42) wird nicht zum Standard", async () => {
      goingDefault()
      const Actions = resolveTypePresentation("event").actions!
      const unknown = { ...attendsWithoutRole(ME, ME), data: { predicate: "attends", tense: "coming", role: 42 } }
      await render(createElement(Actions, { item: EVENT }), [unknown])
      const pill = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Zugesagt")
      expect(pill?.getAttribute("aria-pressed")).not.toBe("true")
    })

    it("Formular: ein Record ohne role steht mit dem Standard im Personenfeld", async () => {
      goingDefault()
      const { usePeopleFormStates } = await import("../src/components/preview/use-people-line")
      let seen: Record<string, { live: Record<string, { state: string }> }> = {}
      function Probe(): ReactNode {
        seen = usePeopleFormStates(EVENT, resolveTypePresentation("event").edges, "g") as never
        return null
      }
      await render(createElement(Probe), [attendsWithoutRole(TIMO, TIMO)])
      expect(seen.invited?.live[TIMO]?.state).toBe("going")
    })
  })
})
