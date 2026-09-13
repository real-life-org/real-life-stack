// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ContentComposer, type ContentTypeConfig } from "../src/components/composer/content-composer"

/**
 * Ein Typ kann mehrere Personen-Zuweisungen führen (Karabirrdt: „Kann ich" und
 * „Will lernen"). Der Composer rendert dafür dasselbe Personen-Widget mehrfach —
 * keine zweite Komponente, kein zweiter Composer daneben.
 */
const lernAufgabe: ContentTypeConfig = {
  id: "skill-task",
  label: "Aufgabe",
  defaultWidgets: ["title", "people"],
  peopleRelations: [
    { predicate: "assignedTo", label: "Kann ich" },
    { predicate: "wantsToLearn", label: "Will lernen" },
  ],
}

const einfacheAufgabe: ContentTypeConfig = {
  id: "task",
  label: "Aufgabe",
  defaultWidgets: ["title", "people"],
  peopleRelation: { predicate: "assignedTo" },
  widgetLabels: { people: "Zugewiesen" },
}

describe("ContentComposer — Personenfelder", () => {
  it("rendert je peopleRelations-Eintrag ein Feld mit eigenem Label und Wert", () => {
    const markup = renderToStaticMarkup(
      <ContentComposer
        contentTypes={[lernAufgabe]}
        mode="skill-task"
        initialData={{ people: ["Anna"], "people:wantsToLearn": ["Bea"] }}
        onSubmit={() => {}}
      />,
    )
    expect(markup).toContain("Kann ich")
    expect(markup).toContain("Will lernen")
    expect(markup).toContain("Anna")
    expect(markup).toContain("Bea")
  })

  it("bleibt bei der Einzahl-Kurzform bei genau einem Feld", () => {
    const markup = renderToStaticMarkup(
      <ContentComposer
        contentTypes={[einfacheAufgabe]}
        mode="task"
        onSubmit={() => {}}
      />,
    )
    expect(markup).toContain("Zugewiesen")
    expect(markup).not.toContain("Personen")
    // Genau ein Personen-Eingabefeld (das Widget zeigt den Platzhalter, solange leer).
    expect(markup.match(/Hinzufuegen\.\.\./g) ?? []).toHaveLength(1)
  })
})
