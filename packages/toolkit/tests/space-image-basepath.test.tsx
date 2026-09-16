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

/**
 * `BASE_URL` laesst sich im Test nicht umstellen (Vite-Sonderfall, `stubEnv`
 * greift dort nicht). Geprueft wird darum die KOPPLUNG: nutzt der Dialog die
 * Aufloesung ueberhaupt, oder setzt er den gespeicherten Wert roh ein?
 */
vi.mock("../src/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/utils")>()
  return { ...actual, resolveAssetUrl: (u?: string) => (u ? `resolved:${u}` : u) }
})

const { GroupDialog } = await import("../src/components/layout/group-dialog")

describe("Space-Bild unter einem Basispfad", () => {
  let root: Root

  const renderWith = (image: string) => {
    act(() => {
      root.render(
        createElement(GroupDialog, {
          open: true,
          onOpenChange: () => {},
          mode: { type: "edit", group: { id: "g1", name: "G", data: { image } } } as never,
          currentUserId: "did:key:zME",
          onCreateGroup: async () => {},
          onUpdateGroup: async () => {},
          onDeleteGroup: async () => {},
        } as never),
      )
    })
  }

  beforeEach(() => {
    document.body.innerHTML = ""
    const host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  it("loest einen wurzel-relativen Pfad auf, statt ihn roh zu setzen", () => {
    renderWith("/logo.png")
    const img = document.querySelector<HTMLImageElement>('[data-slot="dialog-content"] img')!
    // Ohne Aufloesung laedt `/logo.png` unter `/app/` vom falschen Ort.
    expect(img.getAttribute("src")).toBe("resolved:/logo.png")
  })

  it("reicht eine Data-URL unveraendert durch", () => {
    // `resolveAssetUrl` gibt Schema-URLs zurueck, wie sie sind — der Mock
    // hier praefixt zwar stur, aber die echte Funktion ist dafuer getestet.
    renderWith("data:image/png;base64,AAA")
    const img = document.querySelector<HTMLImageElement>('[data-slot="dialog-content"] img')!
    expect(img.getAttribute("src")).toBe("resolved:data:image/png;base64,AAA")
  })
})
