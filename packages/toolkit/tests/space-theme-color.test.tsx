// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

vi.mock("../src/hooks/use-groups", () => ({
  useMembers: () => ({ data: [{ id: "did:key:zME", displayName: "Ich", isAdmin: true }], isLoading: false }),
}))

const { GroupDialog } = await import("../src/components/layout/group-dialog")
const { SPACE_COLOR_SWATCHES } = await import("../src/lib/utils")

/**
 * Der Dialog bekommt die Gruppe als SNAPSHOT (`mode.group`) und behaelt ihn,
 * solange er offen ist — die Reference-App setzt ihn beim Oeffnen einmal.
 * Eine Anzeige, die direkt aus diesem Snapshot liest, bewegt sich nach einem
 * Klick also nicht: gespeichert wird, aber der Haken bleibt stehen und es
 * sieht aus, als sei nichts passiert. Name, Bild und Modulliste halten aus
 * genau diesem Grund lokalen Zustand; die Farbe muss es ebenso.
 */
describe("Primärfarbe im Bereich Aussehen", () => {
  let root: Root
  const saved: unknown[] = []
  let rejectSave = false

  const renderDialog = () => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          // Der Snapshot bleibt absichtlich unveraendert — wie in der App.
          mode: { type: "edit", group: { id: "g1", name: "Gartenprojekt", data: {} } } as never,
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          onUpdateGroup: async (_id: string, updates: unknown) => {
            saved.push(updates)
            if (rejectSave) throw new Error("Netzwerk weg")
          },
          onDeleteGroup: async () => {},
        } as never),
      )
    })
  }

  const openAppearance = () => {
    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })
  }

  const swatch = (hex: string) =>
    document.querySelector<HTMLButtonElement>(`button[aria-label="Primärfarbe ${hex}"]`)!

  const pressed = () =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Primärfarbe"]'))
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.getAttribute("aria-label"))

  beforeEach(() => {
    document.body.innerHTML = ""
    saved.length = 0
    rejectSave = false
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    renderDialog()
    openAppearance()
  })

  it("setzt den Haken sofort auf die angeklickte Farbe", async () => {
    const hex = SPACE_COLOR_SWATCHES[1]
    await act(async () => { swatch(hex).click() })
    expect(pressed()).toEqual([`Primärfarbe ${hex}`])
  })

  it("speichert die Farbe als Merge-Patch", async () => {
    const hex = SPACE_COLOR_SWATCHES[2]
    await act(async () => { swatch(hex).click() })
    expect(saved).toEqual([{ data: { primaryColor: hex } }])
  })

  it("folgt auch einem zweiten Klick auf eine andere Farbe", async () => {
    await act(async () => { swatch(SPACE_COLOR_SWATCHES[1]).click() })
    await act(async () => { swatch(SPACE_COLOR_SWATCHES[3]).click() })
    expect(pressed()).toEqual([`Primärfarbe ${SPACE_COLOR_SWATCHES[3]}`])
  })

  it("nimmt die Anzeige zurueck, wenn das Speichern scheitert", async () => {
    rejectSave = true
    const hex = SPACE_COLOR_SWATCHES[1]
    await act(async () => { swatch(hex).click() })
    // Kein Haken auf einer Farbe, die nicht gespeichert wurde.
    expect(pressed()).not.toEqual([`Primärfarbe ${hex}`])
    expect(document.body.textContent).toContain("Netzwerk weg")
  })
})

/**
 * Der Dialog ist ein FENSTER IN DEN SPACE: er traegt dessen Primaerfarbe,
 * auch wenn gerade ein anderer Space (oder die Uebersicht) aktiv ist. Sonst
 * stuenden im selben Dialog zwei Farben — das Menue in der Farbe des
 * bearbeiteten Space, der Einladen-Knopf in der der laufenden App.
 *
 * Gesetzt werden dieselben Variablen, die `use-workspace-routing` auf
 * `:root` legt, nur lokal. Damit ziehen alle Flaechen darin mit, statt dass
 * jede fuer sich eine Farbe inline bekommt.
 */
describe("Dialog traegt die Farbe des bearbeiteten Space", () => {
  let root: Root

  const renderDialog = () => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: "g1", name: "Gartenprojekt", data: {} } } as never,
          currentUserId: "did:key:zME",
          contacts: [{ id: "did:key:zTOM", name: "Tom", status: "active" as const }],
          onCreateGroup: async () => {},
          onUpdateGroup: async () => {},
          onDeleteGroup: async () => {},
          onInviteMember: async () => {},
        } as never),
      )
    })
  }

  const dialog = () => document.querySelector<HTMLElement>('[data-slot="dialog-content"]')!
  const activeEntry = () =>
    Array.from(document.querySelectorAll<HTMLButtonElement>("nav button"))
      .find((b) => b.getAttribute("aria-current") === "page")!

  beforeEach(() => {
    document.body.innerHTML = ""
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    renderDialog()
  })

  it("setzt die Primaerfarbe des Space auf dem Dialog", () => {
    expect(dialog().style.getPropertyValue("--primary")).not.toBe("")
    expect(dialog().style.getPropertyValue("--primary-foreground")).not.toBe("")
  })

  it("fuehrt sie bei einem Farbwechsel nach", async () => {
    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })

    const hex = SPACE_COLOR_SWATCHES[1]
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`button[aria-label="Primärfarbe ${hex}"]`)!.click()
    })
    expect(dialog().style.getPropertyValue("--primary")).toBe(hex)
  })

  it("laesst den aktiven Menueeintrag aus denselben Tokens schoepfen", () => {
    // Keine Inline-Farbe mehr: eine zweite Mechanik neben den Tokens waere
    // genau der Bruch, den dieser Dialog aufloest.
    expect(activeEntry().style.backgroundColor).toBe("")
    expect(activeEntry().className).toContain("bg-primary")
    expect(activeEntry().className).toContain("text-primary-foreground")
  })

  it("faerbt auch den Einladen-Knopf aus derselben Quelle", () => {
    const invite = Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent?.trim() === "Einladen" && !b.closest("nav"))
    expect(invite, "der Knopf im Mitglieder-Bereich").toBeTruthy()
    expect(invite!.style.backgroundColor).toBe("")
  })
})

/**
 * Der Saver lebt so lange wie der Dialog und liest das Ziel beim AUSFUEHREN.
 * Wird ein Speichern eingereiht, waehrend ein aelteres laeuft, und wechselt
 * der Dialog inzwischen auf einen anderen Space, schrieb der eingereihte
 * Vorgang die Farbe in den NEUEN Space — ein fremder Space bekam still die
 * Farbe, die man dem vorigen zugedacht hatte.
 *
 * Das Ziel muss darum am Wert haengen, nicht am Zeitpunkt der Ausfuehrung.
 */
describe("Farbspeichern bleibt an seinem Space", () => {
  let root: Root
  const calls: Array<{ id: string; color: unknown }> = []
  let release: (() => void) | undefined

  const renderFor = (groupId: string) => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: groupId, name: groupId, data: {} } } as never,
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          onUpdateGroup: (id: string, updates: { data?: { primaryColor?: unknown } }) => {
            calls.push({ id, color: updates.data?.primaryColor })
            // Der erste Aufruf haengt, bis der Test ihn loslaesst.
            return calls.length === 1
              ? new Promise<void>((resolve) => { release = resolve })
              : Promise.resolve()
          },
          onDeleteGroup: async () => {},
        } as never),
      )
    })
  }

  const openAppearance = () => {
    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })
  }

  const pick = (hex: string) => {
    act(() => {
      document.querySelector<HTMLButtonElement>(`button[aria-label="Primärfarbe ${hex}"]`)!.click()
    })
  }

  beforeEach(() => {
    document.body.innerHTML = ""
    calls.length = 0
    release = undefined
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("schreibt einen eingereihten Vorgang nicht in den inzwischen geoeffneten Space", async () => {
    renderFor("space-a")
    openAppearance()

    pick(SPACE_COLOR_SWATCHES[1]) // laeuft, haengt
    pick(SPACE_COLOR_SWATCHES[2]) // wird eingereiht

    // Der Dialog zeigt jetzt einen ANDEREN Space.
    renderFor("space-b")

    await act(async () => {
      release?.()
      await Promise.resolve()
    })

    expect(calls).toHaveLength(2)
    expect(calls.map((c) => c.id), "beide Vorgaenge gehoeren space-a").toEqual(["space-a", "space-a"])
    expect(calls[1].color).toBe(SPACE_COLOR_SWATCHES[2])
  })
})

/**
 * Zeichen auf der Akzentflaeche muessen lesbar bleiben (Spec 04,
 * "Verwendung der Primaerfarbe", Regel 5). Der Haken war fest weiss — auf
 * einer hellen eigenen Farbe verschwand er im eigenen Untergrund.
 */
describe("Lesbarkeit und Benennung der Farbwahl", () => {
  let root: Root

  const renderWith = (primaryColor?: string) => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: {
            type: "edit",
            group: { id: "g1", name: "G", data: primaryColor ? { primaryColor } : {} },
          } as never,
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          onUpdateGroup: async () => {},
          onDeleteGroup: async () => {},
        } as never),
      )
    })
    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })
  }

  beforeEach(() => {
    document.body.innerHTML = ""
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("setzt den Haken auf einer hellen eigenen Farbe dunkel", () => {
    renderWith("#ffffff")
    const label = document.querySelector<HTMLElement>('input[type="color"]')!.closest("label")!
    const check = label.querySelector("svg")!
    expect(check.style.color).toBe("rgb(0, 0, 0)")
  })

  it("setzt ihn auf einer dunklen eigenen Farbe hell", () => {
    renderWith("#101010")
    const label = document.querySelector<HTMLElement>('input[type="color"]')!.closest("label")!
    expect(label.querySelector("svg")!.style.color).toBe("rgb(255, 255, 255)")
  })

  it("benennt den Farbwaehler fuer Vorlesehilfen", () => {
    renderWith()
    // `title` am umgebenden Label benennt das Bedienelement nicht.
    expect(document.querySelector('input[type="color"]')!.getAttribute("aria-label"))
      .toBe("Eigene Farbe")
  })
})

/**
 * Die Bildfarbe kommt ueber einen dynamischen Import, und sie wird an zwei
 * Stellen geholt: beim Oeffnen des Bereichs "Aussehen" (fuer das
 * Vorschlagsfeld) und beim Zuruecksetzen. Der Mock muss beides bedienen.
 *
 * Der Zustand liegt in `vi.hoisted`, nicht in `let`-Variablen im `describe`:
 * `vi.mock` wird an den Dateianfang gezogen, die Factory laeuft also, bevor
 * ein Block-Scope existiert. Griff sie darauf zu, warf sie — und weil der
 * Aufrufer `.catch(() => null)` hat, sah das aus wie "Bild ohne Farbe".
 *
 * Standard ist "antwortet sofort", damit der Vorschlag ohne Timing-Akrobatik
 * dasteht. Fuer das Rennen zwischen Extraktion und Klick schaltet ein Test
 * auf `hold` und loest die offenen Aufrufe selbst auf; mehrere warten dann
 * NEBENEINANDER, statt sich gegenseitig zu ueberschreiben.
 */
const image = vi.hoisted(() => ({
  value: "#aabbcc" as string | null,
  hold: false,
  held: [] as Array<(hex: string | null) => void>,
}))

vi.mock("../src/lib/image-utils", () => ({
  // Die echte Funktion nimmt ein File und liefert eine Data-URL. Gab der
  // Mock das File durch, landete ein Nicht-String im `src`.
  resizeImage: async () => "data:image/png;base64,MOCK",
  dominantColor: () =>
    image.hold
      ? new Promise<string | null>((resolve) => { image.held.push(resolve) })
      : Promise.resolve(image.value),
}))

/**
 * Drei Wege, auf denen die Farbe des Dialogs von der gespeicherten
 * abweichen konnte.
 */
describe("Farbzustand bleibt mit dem Gespeicherten im Gleichklang", () => {
  let root: Root
  const saved: Array<Record<string, unknown>> = []
  /** Loest alles auf, was unter `hold` haengengeblieben ist. */
  const releaseDominant = async (hex: string | null) => {
    await act(async () => {
      for (const resolve of image.held.splice(0)) resolve(hex)
      await Promise.resolve()
    })
  }

  const renderWith = (data: Record<string, unknown>) => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: "g1", name: "G", data } } as never,
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          onUpdateGroup: async (_id: string, u: { data?: Record<string, unknown> }) => {
            if (u.data) saved.push(u.data)
          },
          onDeleteGroup: async () => {},
        } as never),
      )
    })
  }

  const openAppearance = () => {
    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })
  }

  /**
   * Der Bereich "Aussehen" bestimmt seine Vorschlagsfarbe beim Oeffnen ueber
   * einen dynamischen Import. Bis der durch ist, vergehen ein paar
   * Microtasks — die hier abgewartet werden.
   */
  const openAppearanceSettled = async () => {
    openAppearance()
    for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve() })
  }

  const pressedLabels = () =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Primärfarbe"]'))
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.getAttribute("aria-label"))

  beforeEach(() => {
    document.body.innerHTML = ""
    saved.length = 0
    image.value = "#aabbcc"
    image.hold = false
    image.held.length = 0
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("verwirft die Bildfarbe, wenn waehrenddessen eine Farbe gewaehlt wurde", async () => {
    renderWith({ image: "data:image/png;base64,AAA", primaryColor: "#123456" })
    // Der Bereich bestimmt die Vorschlagsfarbe, sobald er offen ist — erst
    // dann steht das Feld da, ueber das man zu ihr zurueckfindet.
    await openAppearanceSettled()

    // Ab jetzt haengt die Extraktion, bis der Test sie freigibt.
    image.hold = true

    // Zuruecksetzen anstossen — diese Extraktion laeuft noch.
    const reset = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Farbe aus dem Bild"]',
    )!
    act(() => { reset.click() })

    // Der Nutzer waehlt inzwischen bewusst eine Farbe.
    const hex = SPACE_COLOR_SWATCHES[1]
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`button[aria-label="Primärfarbe ${hex}"]`)!.click()
    })

    // Erst jetzt kommt die Bildfarbe — sie ist ueberholt.
    await releaseDominant("#aabbcc")

    expect(pressedLabels(), "die bewusste Wahl gewinnt").toEqual([`Primärfarbe ${hex}`])
    expect(saved.at(-1)?.primaryColor, "und nichts Neueres wurde ueberschrieben").toBe(hex)
  })

  /**
   * Antons Befund: die aus dem Bild gewonnene Farbe verschwand, sobald man
   * eine andere waehlte. Sie ist aber der Vorschlag des Space und muss
   * sichtbar bleiben — sonst findet niemand zu ihr zurueck, und sie laesst
   * sich auch nicht mehr mit einer anderen vergleichen.
   */
  it("zeigt die Bildfarbe weiter, nachdem eine andere gewaehlt wurde", async () => {
    renderWith({ image: "data:image/png;base64,AAA", primaryColor: "#aabbcc" })
    await openAppearanceSettled()

    const swatch = () =>
      document.querySelector<HTMLButtonElement>('button[aria-label="Farbe aus dem Bild"]')

    expect(swatch(), "das Feld steht da").not.toBeNull()
    expect(swatch()!.style.backgroundColor, "und traegt die Bildfarbe")
      .toBe("rgb(170, 187, 204)")
    expect(swatch()!.getAttribute("aria-pressed"), "sie gilt gerade").toBe("true")

    const hex = SPACE_COLOR_SWATCHES[1]
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`button[aria-label="Primärfarbe ${hex}"]`)!.click()
    })

    expect(swatch(), "das Feld bleibt").not.toBeNull()
    expect(swatch()!.style.backgroundColor, "unveraendert in der Bildfarbe")
      .toBe("rgb(170, 187, 204)")
    expect(swatch()!.getAttribute("aria-pressed"), "nur der Haken wandert").toBe("false")
    expect(pressedLabels()).toEqual([`Primärfarbe ${hex}`])
  })

  it("setzt die Farbe zurueck, wenn das Bild entfernt wird", async () => {
    // Eine Farbe, die NICHT dem Id-Rueckfall von "g1" entspricht — sonst
    // pruefte der Test nichts: der Haken staende danach zu Recht dort.
    const chosen = SPACE_COLOR_SWATCHES[1]
    renderWith({ image: "data:image/png;base64,AAA", primaryColor: chosen })
    openAppearance()
    expect(pressedLabels()).toEqual([`Primärfarbe ${chosen}`])

    const removeBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Bild entfernen"]')!
    await act(async () => { removeBtn.click() })

    // Gespeichert wird `primaryColor: null` — die Anzeige muss folgen,
    // sonst zeigen Dialog und App verschiedene Farben.
    expect(saved.some((d) => d.primaryColor === null), "null wurde gespeichert").toBe(true)
    expect(pressedLabels(), "kein Haken auf der verworfenen Farbe")
      .not.toEqual([`Primärfarbe ${chosen}`])
  })
})

/**
 * Der Dialog trennt Fehler nach Zugehoerigkeit, seit ein erfolgreicher
 * Modul-Speichervorgang nur raten konnte, ob die angezeigte Meldung seine
 * eigene war (rls#232). Die Farbe hing zunaechst am gemeinsamen `error` und
 * loeschte es bei Erfolg — damit konnte sie die Meldung des Umbenennens
 * mit wegwischen.
 */
describe("Farb-Erfolg loescht keine fremden Meldungen", () => {
  let root: Root

  beforeEach(() => {
    document.body.innerHTML = ""
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: "g1", name: "G", data: {} } } as never,
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          // Nur das Umbenennen scheitert, das Farbspeichern gelingt.
          onUpdateGroup: async (_id: string, u: { name?: string }) => {
            if (u.name !== undefined) throw new Error("Umbenennen ging schief")
          },
          onDeleteGroup: async () => {},
        } as never),
      )
    })
  })

  it("laesst die Meldung des Umbenennens stehen", async () => {
    const nameInput = document.querySelector<HTMLInputElement>('input.text-\\[17px\\]')
      ?? document.querySelector<HTMLInputElement>("input")!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value")!.set!
      setter.call(nameInput, "Neuer Name")
      nameInput.dispatchEvent(new Event("input", { bubbles: true }))
      // React delegiert onBlur ueber focusout, nicht ueber blur.
      nameInput.dispatchEvent(new Event("focusout", { bubbles: true }))
      await Promise.resolve()
    })
    expect(document.body.textContent).toContain("Umbenennen ging schief")

    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })
    await act(async () => {
      document.querySelector<HTMLButtonElement>(
        `button[aria-label="Primärfarbe ${SPACE_COLOR_SWATCHES[1]}"]`)!.click()
      await Promise.resolve()
    })

    expect(document.body.textContent, "der fremde Fehler bleibt sichtbar")
      .toContain("Umbenennen ging schief")
  })
})

/**
 * `primaryColor` hat DREI Schreibwege: die bewusste Wahl, das Entfernen des
 * Bildes und der Upload. Jeder muss die Anzeige mitfuehren — sonst zeigt der
 * Dialog etwas anderes als die App daneben.
 *
 * Die ersten beiden wurden einzeln nachgezogen, der dritte blieb dabei
 * liegen. Dieser Block prueft darum nicht einen Weg, sondern den VERTRAG:
 * nach jedem Schreiben stimmt der Haken mit dem Gespeicherten ueberein.
 */
describe("Jeder Schreibweg fuehrt die Anzeige mit", () => {
  let root: Root
  const saved: Array<Record<string, unknown>> = []

  const render = (data: Record<string, unknown>) => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: "g1", name: "G", data } } as never,
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          onUpdateGroup: async (_id: string, u: { data?: Record<string, unknown> }) => {
            if (u.data) saved.push(u.data)
          },
          onDeleteGroup: async () => {},
        } as never),
      )
    })
  }

  const openAppearance = () => {
    const entry = Array.from(document.querySelectorAll("nav button"))
      .find((b) => b.textContent?.startsWith("Aussehen")) as HTMLButtonElement
    act(() => { entry.click() })
  }

  /** Der Haken folgt der geltenden Farbe; ohne Palettentreffer gilt "custom". */
  /**
   * Welche Farbe die Oberflaeche als geltend ausweist.
   *
   * Zwei Orte, seit der Vorschlag ein eigenes Feld hat: die Palette traegt
   * ihren Wert im Namen, das Vorschlagsfeld nur in seiner Flaeche.
   */
  const shownColor = () => {
    const hit = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Primärfarbe"]'))
      .find((b) => b.getAttribute("aria-pressed") === "true")
    if (hit) return hit.getAttribute("aria-label")!.replace("Primärfarbe ", "")

    const suggestion = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((b) => {
        const label = b.getAttribute("aria-label")
        return (label === "Farbe aus dem Bild" || label === "Standardfarbe") &&
          b.getAttribute("aria-pressed") === "true"
      })
    if (!suggestion) return "custom"
    const rgb = suggestion.style.backgroundColor.match(/\d+/g)
    return rgb
      ? `#${rgb.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`
      : "custom"
  }

  /** Was zuletzt fuer `primaryColor` gespeichert wurde. */
  const lastSavedColor = () => {
    for (let i = saved.length - 1; i >= 0; i--) {
      if ("primaryColor" in saved[i]) return saved[i].primaryColor as string | null
    }
    return undefined
  }

  beforeEach(() => {
    document.body.innerHTML = ""
    saved.length = 0
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("Weg 1 — bewusste Wahl", async () => {
    render({})
    openAppearance()
    const hex = SPACE_COLOR_SWATCHES[1]
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`button[aria-label="Primärfarbe ${hex}"]`)!.click()
    })
    expect(lastSavedColor()).toBe(hex)
    expect(shownColor()).toBe(hex)
  })

  it("Weg 2 — Bild entfernen", async () => {
    render({ image: "data:image/png;base64,AAA", primaryColor: SPACE_COLOR_SWATCHES[1] })
    openAppearance()
    await act(async () => {
      document.querySelector<HTMLButtonElement>('button[aria-label="Bild entfernen"]')!.click()
    })
    expect(lastSavedColor()).toBeNull()
    // Nach `null` gilt der Id-Rueckfall — nicht mehr die vorige Wahl.
    expect(shownColor()).not.toBe(SPACE_COLOR_SWATCHES[1])
  })

  it("Weg 3 — Bild hochladen", async () => {
    render({ primaryColor: SPACE_COLOR_SWATCHES[1] })
    openAppearance()

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File([new Uint8Array([1, 2, 3])], "logo.png", { type: "image/png" })
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true })
    await act(async () => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
    // Das neue Bild stoesst die Vorschlagsfarbe neu an.
    for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve() })

    const stored = lastSavedColor()
    expect(stored, "der Upload speichert eine Farbe").toBeDefined()
    // Und die Anzeige zeigt genau sie — nicht mehr die vorige Wahl.
    expect(shownColor()).toBe(stored === null ? shownColor() : stored)
    expect(shownColor()).not.toBe(SPACE_COLOR_SWATCHES[1])
  })
})
