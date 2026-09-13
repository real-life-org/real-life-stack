// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ContentComposer, type ContentTypeConfig } from "../src/components/composer/content-composer"

/**
 * Welche Datenschlüssel Personen tragen, sagt die KONFIGURATION — nicht das
 * `people:`-Präfix. Ein Typ mit eigenem `dataKey` muss deshalb genauso am
 * Ungespeichert-Schutz teilnehmen wie der abgeleitete Standardschlüssel;
 * sonst geht die Auswahl beim Schließen ohne Rückfrage verloren.
 */
function typMitZweitemFeld(dataKey?: string): ContentTypeConfig {
  return {
    id: "skill-task",
    label: "Aufgabe",
    defaultWidgets: ["title", "people"],
    peopleRelations: [
      { predicate: "assignedTo", label: "Kann ich" },
      { predicate: "wantsToLearn", label: "Will lernen", ...(dataKey ? { dataKey } : {}) },
    ],
  }
}

let root: Root | null = null
let host: HTMLElement | null = null

function render(ui: React.ReactElement) {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root!.render(ui))
}

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

/** Das zweite Personen-Eingabefeld (Reihenfolge = Deklarationsreihenfolge). */
function zweitesPersonenfeld(): HTMLInputElement {
  const inputs = [...document.querySelectorAll<HTMLInputElement>("input")].filter(
    (el) => el.placeholder === "Hinzufuegen...",
  )
  expect(inputs.length).toBe(2)
  return inputs[1]
}

function personWaehlen(input: HTMLInputElement, name: string) {
  act(() => {
    input.focus()
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
  })
  const vorschlag = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (el) => el.textContent?.trim() === name,
  )
  expect(vorschlag, `Vorschlag „${name}" nicht gefunden`).toBeTruthy()
  act(() => vorschlag!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
}

describe("ContentComposer — Personenfelder und Ungespeichert-Schutz", () => {
  it("meldet eine Änderung im Feld mit eigenem dataKey als ungespeichert", () => {
    const onDirtyChange = vi.fn()
    render(
      <ContentComposer
        contentTypes={[typMitZweitemFeld("learners")]}
        mode="skill-task"
        peopleOptions={[{ id: "u2", name: "Bea" }]}
        onDirtyChange={onDirtyChange}
        onSubmit={() => {}}
      />,
    )
    personWaehlen(zweitesPersonenfeld(), "Bea")
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it("meldet dasselbe für den abgeleiteten Schlüssel people:wantsToLearn", () => {
    const onDirtyChange = vi.fn()
    render(
      <ContentComposer
        contentTypes={[typMitZweitemFeld()]}
        mode="skill-task"
        peopleOptions={[{ id: "u2", name: "Bea" }]}
        onDirtyChange={onDirtyChange}
        onSubmit={() => {}}
      />,
    )
    personWaehlen(zweitesPersonenfeld(), "Bea")
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })
})
