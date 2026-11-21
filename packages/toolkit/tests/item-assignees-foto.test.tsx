// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { User } from "@real-life/data-interface"

import { ItemAssignees, type ItemAssigneeUser } from "../src/components/preview/item-assignees"
import { getUserColor } from "../src/lib/utils"

/**
 * Loop-Review rls#360: Mit geladenem Profilfoto sahen `solid` und `outline`
 * gleich aus — Radix entfernt den Fallback, und nur der trug die Form. Eine
 * App, die die Formen als „kann / lernt" liest, verlor die Unterscheidung
 * gerade bei Menschen mit Foto. Die Form muss am sichtbaren Avatar haengen,
 * nicht am Fallback.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** Ein Bild, das sofort als geladen gilt (Radix prueft `complete` und `naturalWidth`). */
class GeladenesBild extends EventTarget {
  complete = true
  naturalWidth = 48
  src = ""
  referrerPolicy = ""
  crossOrigin: string | null = null
}

const lena: User = { id: "u1", displayName: "Lena Berg", avatarUrl: "https://example.org/lena.jpg" } as User

let host: HTMLDivElement
let root: Root
const echtesBild = window.Image

beforeEach(() => {
  ;(window as unknown as { Image: unknown }).Image = GeladenesBild
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  window.Image = echtesBild
})

async function avatar(user: ItemAssigneeUser, size: "sm" | "xs" = "sm"): Promise<HTMLElement> {
  await act(async () => {
    root.render(<ItemAssignees users={[user]} size={size} />)
  })
  const el = host.querySelector<HTMLElement>('[data-slot="avatar"]')!
  // Voraussetzung des Befunds: das Foto ist da, der Fallback weg.
  expect(el.querySelector('[data-slot="avatar-image"]')).not.toBeNull()
  expect(el.querySelector('[data-slot="avatar-fallback"]')).toBeNull()
  return el
}

describe("ItemAssignees: Formen mit geladenem Profilfoto", () => {
  for (const size of ["sm", "xs"] as const) {
    it(`unterscheidet solid und outline auch mit Foto (size ${size})`, async () => {
      const solid = (await avatar(lena, size)).outerHTML
      const outline = (await avatar({ ...lena, variant: "outline" }, size)).outerHTML
      expect(outline).not.toBe(solid)
    })
  }

  it("outline zieht mit Foto einen Ring in der Personenfarbe", async () => {
    const el = await avatar({ ...lena, variant: "outline" })
    expect(el.getAttribute("data-variant")).toBe("outline")
    // Ring in der Personenfarbe, darin ein Innenabstand im Hintergrund-Token.
    const ring = el.style.boxShadow.replace(/\s+/g, " ")
    expect(ring).toMatch(/inset/)
    const rgb = (hex: string) =>
      `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`
    const farbe = getUserColor(lena.id)
    expect(ring.includes(farbe) || ring.includes(rgb(farbe))).toBe(true)
    expect(el.style.padding).not.toBe("")
  })

  it("outline nimmt das Foto zurueck, solid zeigt es voll", async () => {
    const outline = await avatar({ ...lena, variant: "outline" })
    const bildOutline = outline.querySelector<HTMLElement>('[data-slot="avatar-image"]')!
    expect(bildOutline.className).toMatch(/opacity-/)

    const solid = await avatar(lena)
    const bildSolid = solid.querySelector<HTMLElement>('[data-slot="avatar-image"]')!
    expect(bildSolid.className).not.toMatch(/opacity-/)
    expect(solid.getAttribute("data-variant")).toBe("solid")
    expect(solid.style.padding).toBe("")
  })
})

/**
 * Codex-Review Runde 2: Foto-`alt` und Initialen wiederholten, was die
 * Profilbeschriftung und die Screenreader-Liste schon sagen („Lena Berg Lena
 * Berg lernt"). Das Bild ist Schmuck; der Name steht einmal in der Liste und
 * einmal an der Profil-Schaltflaeche.
 */
describe("ItemAssignees: keine doppelte Ansage", () => {
  it("gibt dem geladenen Foto ein leeres alt", async () => {
    const el = await avatar({ ...lena, qualifier: "lernt" })
    expect(el.querySelector("img")!.getAttribute("alt")).toBe("")
    expect(host.querySelectorAll(".sr-only").length).toBe(1)
    expect(host.querySelector(".sr-only")!.textContent).toBe("Lena Berg lernt")
  })

  it("blendet die Initialen fuer Screenreader aus", async () => {
    ;(window as unknown as { Image: unknown }).Image = echtesBild
    await act(async () => {
      root.render(<ItemAssignees users={[{ id: "u9", displayName: "Emil Kranz" }]} size="xs" />)
    })
    const fallback = host.querySelector('[data-slot="avatar-fallback"]')!
    expect(fallback.getAttribute("aria-hidden")).toBe("true")
    expect(host.querySelector('[role="button"]')!.getAttribute("aria-label")).toBe("Profil von Emil Kranz öffnen")
  })
})
