// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ContentComposer, type ContentTypeConfig } from "../src/components/composer/content-composer"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const post: ContentTypeConfig = { id: "post", label: "Post", defaultWidgets: ["text"] }
const person: ContentTypeConfig = {
  id: "person",
  label: "Person",
  defaultWidgets: ["title", "text"],
  titleRequired: true,
  hint: "Für Menschen, die noch nicht im Netz sind.",
}

function zeige(
  typen: ContentTypeConfig[],
  initial: string,
  initialData?: Record<string, unknown>,
) {
  act(() => {
    root.render(
      <ContentComposer
        contentTypes={typen}
        initialContentType={initial}
        initialData={initialData}
        onSubmit={() => {}}
      />,
    )
  })
}

/** Der Anlege-Knopf — beschriftet aus `submitLabel`, sonst „Erstellen". */
function anlegen(): HTMLButtonElement {
  const knoepfe = [...host.querySelectorAll("button")] as HTMLButtonElement[]
  const treffer = knoepfe.find((b) => b.textContent?.trim() === "Erstellen")
  if (!treffer) throw new Error("Anlege-Knopf nicht gefunden")
  return treffer
}

describe("Typ-Wahl mit Hinweis", () => {
  it("sagt unter der Wahl, wofür der gewählte Typ da ist", () => {
    zeige([post, person], "person")
    expect(host.textContent).toContain("Für Menschen, die noch nicht im Netz sind.")
  })

  it("schweigt bei einem Typ ohne Hinweis", () => {
    zeige([post, person], "post")
    expect(host.textContent).not.toContain("noch nicht im Netz")
  })
})

describe("Pflichttitel", () => {
  it("hält den Anlege-Knopf zu, solange der Name fehlt", () => {
    zeige([post, person], "person")
    expect(anlegen().disabled).toBe(true)
  })

  it("bleibt zu, wenn nur die Bio dasteht — eine Person ohne Namen gibt es nicht", () => {
    zeige([post, person], "person", { text: "Gartenbau" })
    expect(anlegen().disabled).toBe(true)
  })

  it("öffnet sich, sobald der Name dasteht", () => {
    zeige([post, person], "person", { title: "Ulf" })
    expect(anlegen().disabled).toBe(false)
  })

  it("lässt einen Typ ohne Pflichttitel schon mit Freitext los", () => {
    zeige([post, person], "post", { text: "Hallo" })
    expect(anlegen().disabled).toBe(false)
  })
})
