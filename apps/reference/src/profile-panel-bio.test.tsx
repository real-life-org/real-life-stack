// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom has no matchMedia; AdaptivePanel queries it for its mode decision.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  onchange: null,
  dispatchEvent: () => false,
}))
import type { DataInterface, Item, User } from "@real-life-stack/data-interface"
import { ProfilePanelHost } from "./App"

const ME: User = { id: "user-me", displayName: "Anton" }

function personItem(bio: string, ort?: { position: unknown; locationName: string }): Item {
  return {
    id: ME.id,
    type: "person",
    createdAt: "2026-08-05T10:00:00.000Z",
    createdBy: ME.id,
    data: { displayName: "Anton", bio, ...(ort ?? {}) },
  }
}

/** ProfileCapable-Fake: die Bio lebt im Profil-Item, nicht im User-Objekt. */
function makeConnector(bio: string, ort?: { position: unknown; locationName: string }) {
  const item = personItem(bio, ort)
  return {
    getMyProfile: async () => item,
    observeMyProfile: () => ({ current: item, subscribe: () => () => {} }),
    updateMyProfile: async () => item,
    setFieldVisibility: async () => {},
    getPublicProfile: async () => null,
    syncProfile: async () => {},
    isProfileSyncPending: () => ({ current: false, subscribe: () => () => {} }),
    getAuthState: () => ({ current: { status: "authenticated" as const, user: ME }, subscribe: () => () => {} }),
    getAuthMethods: () => [],
    authenticate: async () => ME,
    logout: async () => {},
    getCurrentUser: async () => ME,
    observeCurrentUser: () => ({ current: ME, subscribe: () => () => {} }),
    getUser: async () => null,
    init: async () => {},
    dispose: async () => {},
    getItems: async () => [],
    getItem: async () => null,
    observe: () => ({ current: [], subscribe: () => () => {} }),
    observeItem: () => ({ current: null, subscribe: () => () => {} }),
  } as unknown as DataInterface
}

let root: Root | null = null
let host: HTMLElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

describe("ProfilePanelHost — eigene Bio kommt aus dem Profil-Item", () => {
  it("zeigt die gespeicherte Bio beim Öffnen des eigenen Profils (kein hartes '')", async () => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => {
      root!.render(
        <ProfilePanelHost
          userId={ME.id}
          currentUser={ME}
          connector={makeConnector("Baut Netze in Kassel")}
          onSaveProfile={async () => {}}
          onClose={() => {}}
        />,
      )
    })
    await act(async () => { await Promise.resolve() })
    const bioField = [...document.querySelectorAll("input, textarea")]
      .find((el) => (el as HTMLInputElement).value?.includes("Baut Netze in Kassel"))
    const bioText = document.body.textContent?.includes("Baut Netze in Kassel")
    expect(bioField || bioText, "gespeicherte Bio sichtbar").toBeTruthy()
  })

  it("ein rejectender Profil-Read crasht das Panel nicht (kein unhandledrejection)", async () => {
    const connector = makeConnector("egal")
    ;(connector as unknown as { getMyProfile: () => Promise<never> }).getMyProfile =
      () => Promise.reject(new Error("Profil-Backend down"))
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => {
      root!.render(
        <ProfilePanelHost
          userId={ME.id}
          currentUser={ME}
          connector={connector}
          onSaveProfile={async () => {}}
          onClose={() => {}}
        />,
      )
    })
    await act(async () => { await Promise.resolve() })
    // Panel steht (kein Crash): das Edit-Formular ist gerendert und der Name
    // kommt aus dem User-Objekt (der rejectende Read wird nur geloggt).
    expect(document.body.textContent).toContain("Ueber mich")
    expect([...document.querySelectorAll("input")].some((el) => el.value === "Anton")).toBe(true)
  })
})

describe("ProfilePanelHost — Position kommt aus dem Profil-Item (Spec 04 §Profile, Regel 4)", () => {
  const kassel = { type: "Point", coordinates: [9.4797, 51.3127] }

  async function zeige(
    connector: DataInterface,
    onSaveProfile: (updates: Record<string, unknown>) => Promise<void> = async () => {},
  ) {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => {
      root!.render(
        <ProfilePanelHost
          userId={ME.id}
          currentUser={ME}
          connector={connector}
          onSaveProfile={onSaveProfile as never}
          onClose={() => {}}
        />,
      )
    })
    await act(async () => { await Promise.resolve() })
  }

  it("füllt das Ortsfeld aus der gespeicherten Position und nennt ihre Reichweite", async () => {
    await zeige(makeConnector("egal", { position: kassel, locationName: "Kassel" }))
    const ortsfeld = document.querySelector('input[role="combobox"]') as HTMLInputElement | null
    expect(ortsfeld?.value).toBe("Kassel")
    expect(document.body.textContent).toContain("Deine Position gilt in allen Spaces")
  })

  it("reicht Position und Ortsnamen beim Speichern an den Connector durch", async () => {
    const gespeichert: Record<string, unknown>[] = []
    await zeige(
      makeConnector("egal", { position: kassel, locationName: "Kassel" }),
      async (updates) => { gespeichert.push(updates) },
    )
    const knopf = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Speichern")
    await act(async () => { knopf!.click() })
    await act(async () => { await Promise.resolve() })
    expect(gespeichert[0]).toMatchObject({ locationName: "Kassel", position: kassel })
  })

  it("schickt die Position auch dann MIT, wenn sie leer ist — sonst ließe sie sich nie räumen", async () => {
    const gespeichert: Record<string, unknown>[] = []
    await zeige(makeConnector("egal"), async (updates) => { gespeichert.push(updates) })
    const knopf = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Speichern")
    await act(async () => { knopf!.click() })
    await act(async () => { await Promise.resolve() })
    expect("position" in gespeichert[0]).toBe(true)
    expect(gespeichert[0].position).toBeUndefined()
  })
})
