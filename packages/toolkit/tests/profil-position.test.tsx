// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ProfilePanelContent, type ProfileData } from "../src/components/profile/profile-panel-content"

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

const anton: ProfileData = {
  did: "did:key:anton",
  name: "Anton",
  bio: "Baut am Web of Trust.",
  position: { type: "Point", coordinates: [8.6821, 50.1109] },
  locationName: "Frankfurt am Main",
}

type Gespeichert = Parameters<
  NonNullable<React.ComponentProps<typeof ProfilePanelContent>["onSave"]>
>[0]

function zeigeEditor(profile: ProfileData) {
  const gespeichert: Gespeichert[] = []
  act(() => {
    root.render(
      <ProfilePanelContent
        mode="edit"
        profile={profile}
        onSave={async (updates) => { gespeichert.push(updates) }}
        onClose={() => {}}
      />,
    )
  })
  return gespeichert
}

function ortsfeld(): HTMLInputElement {
  const feld = host.querySelector('input[role="combobox"]') as HTMLInputElement | null
  if (!feld) throw new Error("Ortsfeld nicht gefunden")
  return feld
}

function speichern() {
  const knopf = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Speichern")
  if (!knopf) throw new Error("Speichern-Knopf nicht gefunden")
  act(() => knopf.click())
}

describe("Position im Profil-Editor (Spec 04 §Profile, Regel 4)", () => {
  it("sagt, dass die Position in allen Spaces gilt", () => {
    zeigeEditor(anton)
    expect(host.textContent).toContain("Deine Position gilt in allen Spaces, in denen du Mitglied bist.")
  })

  it("zeigt die gesetzte Position im Ortsfeld", () => {
    zeigeEditor(anton)
    expect(ortsfeld().value).toBe("Frankfurt am Main")
  })

  it("gibt Position und Ortsnamen beim Speichern weiter", async () => {
    const gespeichert = zeigeEditor(anton)
    speichern()
    await act(async () => { await Promise.resolve() })
    expect(gespeichert[0]).toMatchObject({
      name: "Anton",
      locationName: "Frankfurt am Main",
      position: { type: "Point", coordinates: [8.6821, 50.1109] },
    })
  })

  it("ist opt-in: ohne Position bleibt beides ungesetzt", async () => {
    const gespeichert = zeigeEditor({ did: "did:key:ulf", name: "Ulf" })
    expect(ortsfeld().value).toBe("")
    speichern()
    await act(async () => { await Promise.resolve() })
    expect(gespeichert[0].position).toBeUndefined()
    expect(gespeichert[0].locationName).toBeUndefined()
  })

  it("zeigt ein fremdes Profil den Ort als Auskunft, nicht als Formular", () => {
    act(() => {
      root.render(<ProfilePanelContent mode="view" profile={anton} onClose={() => {}} />)
    })
    expect(host.textContent).toContain("Frankfurt am Main")
    expect(host.querySelector('input[role="combobox"]')).toBeNull()
  })
})
