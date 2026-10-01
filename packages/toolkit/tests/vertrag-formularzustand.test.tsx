// @vitest-environment jsdom
import { act, createElement, StrictMode, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ActionState, FormState, useActionState, type ActionWork, type FieldAccess } from "../src/lib/form-state"
import { FormHost, single } from "./support/form-host"

/**
 * Vertrag „Formularzustand" (shared-components → Formularzustand, Regeln
 * 1–11): Der Zustand besitzt Werte, Epoche, Warte-Zustände und Abonnements;
 * Widgets bekommen nur einen Feldzugang.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

const text = single("wert", (raw) => (typeof raw === "string" ? raw : ""), "Wert")
let field!: FieldAccess<string>
const form: { current: FormState | null } = { current: null }

async function draw(props: { space?: string; type?: string; locked?: boolean; present?: boolean; data?: Record<string, unknown> } = {}) {
  await act(async () =>
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(FormHost<string>, {
          def: text,
          space: "g",
          ...props,
          form,
          render: (f) => {
            field = f
            return null
          },
        }),
      ),
    ),
  )
}
const data = () => form.current!.getData()

describe("Feldzugang (Regeln 2, 3, 5, 11)", () => {
  it("Eingaben schreiben im selben Ereignis; ein eingefangener alter Schreibweg schreibt nach einem Space-Wechsel nichts", async () => {
    await draw()
    const old = field
    await act(async () => old.set("getippt"))
    expect(data().wert).toBe("getippt")
    await draw({ space: "h" })
    await act(async () => old.set("spät"))
    expect(data().wert).toBe("getippt")
    await act(async () => field.set("neu"))
    expect(data().wert).toBe("neu")
  })

  it("ein Feld schreibt nur seine Schlüssel", async () => {
    await draw()
    const def = { label: "X", keys: ["a"], read: () => "", write: () => ({ a: 1, fremd: 2 }) }
    const access = form.current!.field<string>("x", def)
    await act(async () => access.set(""))
    expect(data().a).toBe(1)
    expect("fremd" in data()).toBe(false)
  })

  it("getippte Werte überstehen Space- und Typwechsel (die Epoche verwirft keine Werte)", async () => {
    await draw()
    await act(async () => field.set("Titel"))
    await draw({ space: "h" })
    await draw({ space: "h", type: "anders" })
    expect(field.value).toBe("Titel")
  })

  it("ein gesperrtes Feld nimmt weder Eingabe noch Ergebnis an", async () => {
    await draw()
    const work = field.begin("suche", "background", "Wert")
    await draw({ locked: true })
    await act(async () => field.set("x"))
    expect(data().wert).toBeUndefined()
    expect(work.apply((now) => now.set("y"))).toBe(false)
    const user = field.begin("bild", "user", "Bild")
    expect(user.apply((now) => now.set("z"))).toBe(false)
    expect(data().wert).toBeUndefined()
    expect(field.notice).toBeNull()
    await draw({ locked: true })
    expect(field.notice).toBe("Bild nicht übernommen: Das Feld ist gesperrt")
  })
})

describe("Hintergrundarbeit (Regeln 4, 7, 8, 10)", () => {
  it("Space-Wechsel: Warte-Zustand endet sofort, Signal bricht ab, Ergebnis schreibt nichts", async () => {
    await draw()
    let work!: ReturnType<typeof field.begin>
    await act(async () => {
      work = field.begin("suche", "background", "Vorschläge")
    })
    expect(field.busy("suche")).toBe(true)
    await draw({ space: "h" })
    expect(field.busy("suche")).toBe(false)
    expect(work.signal.aborted).toBe(true)
    expect(work.apply((now) => now.set("alt"))).toBe(false)
    expect(data().wert).toBeUndefined()
    expect(field.notice).toBeNull()
  })

  it("Zähler statt Vergleich: G → H → G lässt alte Arbeit ungültig", async () => {
    await draw()
    const work = field.begin("suche", "background", "Vorschläge")
    await draw({ space: "h" })
    await draw({ space: "g" })
    expect(work.valid()).toBe(false)
  })

  it("neue Arbeit derselben Art und cancel verwerfen die vorige; andere Arten bleiben", async () => {
    await draw()
    const first = field.begin("suche", "background", "V")
    const pick = field.begin("pick", "user", "Ort")
    const second = field.begin("suche", "background", "V")
    expect(first.valid()).toBe(false)
    expect(second.valid()).toBe(true)
    field.cancel("suche")
    expect(second.valid()).toBe(false)
    expect(pick.valid()).toBe(true)
  })

  it("Abbau des Felds verwirft Hintergrundarbeit, Schließen des Formulars alle", async () => {
    await draw()
    const bg = field.begin("suche", "background", "V")
    const user = field.begin("bild", "user", "Bild")
    await draw({ present: false })
    expect(bg.valid()).toBe(false)
    // Vom Nutzer entfernt (kein Typwechsel): auch die Nutzerarbeit nimmt er zurück.
    expect(user.valid()).toBe(false)
    await draw()
    const again = field.begin("bild", "user", "Bild")
    await act(async () => root.render(createElement("div")))
    expect(again.valid()).toBe(false)
    expect(again.signal.aborted).toBe(true)
  })

  it("Beenden ist idempotent", async () => {
    await draw()
    const work = field.begin("suche", "background", "V")
    work.finish()
    work.finish()
    field.cancel("suche")
    expect(field.busy()).toBe(false)
  })
})

describe("Nutzerarbeit: Absicht geht nie still verloren (Regel 10)", () => {
  it("Space-Wechsel: die Arbeit läuft weiter und wird übernommen", async () => {
    await draw()
    const work = field.begin("bild", "user", "Bild")
    await draw({ space: "h" })
    expect(field.busy("bild")).toBe(true)
    expect(work.apply((now) => now.set("bild.webp"))).toBe(true)
    work.finish()
    expect(data().wert).toBe("bild.webp")
    expect(field.busy("bild")).toBe(false)
  })

  it("Typwechsel ohne das Feld: nichts übernommen, Hinweis im Formular", async () => {
    await draw()
    const work = field.begin("bild", "user", "Bild")
    await draw({ type: "aufgabe", present: false })
    expect(work.valid()).toBe(true)
    form.current!.configure({ typeLabel: (t) => (t === "aufgabe" ? "Aufgabe" : t) })
    expect(work.apply((now) => now.set("bild.webp"))).toBe(false)
    expect(data().wert).toBeUndefined()
    const notices = form.current!.formNotices()
    expect(notices.map((n) => n.text)).toEqual(["Bild nicht übernommen: Der Typ Aufgabe hat kein Feld „Wert“"])
    await act(async () => notices[0]!.dismiss())
    expect(form.current!.formNotices()).toEqual([])
  })

  it("abgelehnt gegen den Stand JETZT: Hinweis am Feld, bis der Nutzer ihn schließt oder das Feld neu setzt", async () => {
    await draw()
    const work = field.begin("pick", "user", "Ort")
    await act(async () => {
      work.apply((now) => now.refuse("liegt in einem anderen Space"))
    })
    expect(field.notice).toBe("Ort nicht übernommen: liegt in einem anderen Space")
    await act(async () => field.set("neu"))
    expect(field.notice).toBeNull()
    await act(async () => {
      work.apply((now) => now.refuse("wieder"))
    })
    await act(async () => field.dismissNotice())
    expect(field.notice).toBeNull()
  })

  it("Hintergrundarbeit, die nach einem Wechsel eintrifft, zeigt keinen Hinweis", async () => {
    await draw()
    const work = field.begin("suche", "background", "Vorschläge")
    await draw({ type: "anders" })
    work.apply((now) => now.refuse("egal"))
    expect(field.notice).toBeNull()
    expect(form.current!.formNotices()).toEqual([])
  })
})

describe("Aktionszustand (Regel 9)", () => {
  function makeWatch() {
    const listeners = new Set<() => void>()
    return {
      watch: (cb: () => void) => {
        listeners.add(cb)
        return () => listeners.delete(cb)
      },
      emit: () => [...listeners].forEach((cb) => cb()),
      count: () => listeners.size,
    }
  }

  it("Abonnement nur, solange eine Arbeit läuft; ein Space-Wechsel beendet „beschäftigt“ sofort", async () => {
    const source = makeWatch()
    let state!: { begin: () => ActionWork; busy: boolean }
    function View({ scope }: { scope: string }): ReactNode {
      state = useActionState([scope], source.watch)
      return null
    }
    await act(async () => root.render(createElement(StrictMode, null, createElement(View, { scope: "g" }))))
    expect(source.count()).toBe(0)
    let work!: ActionWork
    await act(async () => {
      work = state.begin()
    })
    expect(state.busy).toBe(true)
    expect(source.count()).toBe(1)
    // Hängendes Lesen: der Space wechselt, das Lesen kommt nie zurück.
    await act(async () => source.emit())
    expect(state.busy).toBe(false)
    expect(work.valid()).toBe(false)
    expect(source.count()).toBe(0)
  })

  it("überlebt den Abbau der Anzeige bis zum Ende der Arbeit, nicht länger", async () => {
    const source = makeWatch()
    let state!: { begin: () => ActionWork; busy: boolean }
    function View(): ReactNode {
      state = useActionState(["g"], source.watch)
      return null
    }
    await act(async () => root.render(createElement(StrictMode, null, createElement(View))))
    const a = state.begin()
    const b = state.begin()
    expect(source.count()).toBe(1)
    await act(async () => root.render(createElement("div")))
    expect(a.valid()).toBe(true)
    expect(source.count()).toBe(1)
    a.finish()
    expect(source.count()).toBe(1)
    b.finish()
    b.finish()
    expect(source.count()).toBe(0)
  })

  it("ein Wechsel des Stands (Item, geöffneter Space) im Render verwirft laufende Arbeit", async () => {
    let state!: { begin: () => ActionWork; busy: boolean }
    function View({ scope }: { scope: string }): ReactNode {
      state = useActionState([scope])
      return null
    }
    await act(async () => root.render(createElement(View, { scope: "g" })))
    const work = state.begin()
    await act(async () => root.render(createElement(View, { scope: "h" })))
    expect(work.valid()).toBe(false)
    expect(state.busy).toBe(false)
  })

  it("eine Meldung schon beim Anmelden: verworfen und abgemeldet", () => {
    const action = new ActionState()
    let stopped = 0
    action.watch = (cb) => {
      cb()
      return () => {
        stopped += 1
      }
    }
    const work = action.begin()
    expect(work.valid()).toBe(false)
    expect(stopped).toBe(1)
    expect(action.subscriptions()).toBe(0)
  })
})
