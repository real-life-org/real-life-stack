// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  PanelHeaderActions,
  PanelHeaderSlotContext,
} from "../src/components/layout/panel-header-actions"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Das Panel legt seine Knoepfe absolut in die obere rechte Ecke. Ein Inhalt,
 * der dort ebenfalls etwas hinstellt, laeuft darunter — genau so lag das
 * ⋮-Menue unter dem ✕. Wieviel Platz zu lassen waere, kann der Inhalt nicht
 * wissen: Je nach Modus zeigt das Panel einen, zwei oder drei Knoepfe.
 */
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

describe("PanelHeaderActions", () => {
  it("legt die Aktionen in die Knopfleiste des Panels", () => {
    const leiste = document.createElement("div")
    leiste.id = "leiste"
    document.body.appendChild(leiste)

    act(() => {
      root.render(
        createElement(
          PanelHeaderSlotContext.Provider,
          { value: leiste },
          createElement("div", { id: "inhalt" },
            createElement(PanelHeaderActions, null, createElement("button", null, "MENUE"))),
        ),
      )
    })

    expect(leiste.textContent).toBe("MENUE")
    expect(host.querySelector("#inhalt")?.textContent).toBe("")
    leiste.remove()
  })

  it("laesst die Aktionen stehen, wenn kein Panel darueber liegt", () => {
    act(() => {
      root.render(
        createElement("div", { id: "inhalt" },
          createElement(PanelHeaderActions, null, createElement("button", null, "MENUE"))),
      )
    })

    // Ohne Fallback verschwaende das ⋮ in einer Story oder einer eingebetteten
    // Ansicht spurlos.
    expect(host.querySelector("#inhalt")?.textContent).toBe("MENUE")
  })

  it("raeumt die Leiste wieder auf, wenn der Inhalt geht", () => {
    const leiste = document.createElement("div")
    document.body.appendChild(leiste)

    act(() => {
      root.render(
        createElement(PanelHeaderSlotContext.Provider, { value: leiste },
          createElement(PanelHeaderActions, null, createElement("button", null, "MENUE"))),
      )
    })
    expect(leiste.textContent).toBe("MENUE")

    act(() => { root.render(createElement("div", null, "leer")) })
    expect(leiste.textContent).toBe("")
    leiste.remove()
  })
})
