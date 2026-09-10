import { describe, expect, it } from "vitest"
import type { MockConnectorSeed } from "../src/index"
import { MockConnector } from "../src/index"

/**
 * Der Profil-Editor am Mock — sinngemaess wie bei WoT und Supabase: Es gibt
 * EINE Profilquelle, aus der auch die Projektion entsteht. Wer seine Position
 * setzt, sieht sie sofort in jedem Space, dessen Mitglied er ist
 * (Spec 04 §Profile, Regel 4: opt-in und global).
 */
const kassel = { type: "Point" as const, coordinates: [9.4797, 51.3127] }

function seed(): MockConnectorSeed {
  return {
    items: [],
    groups: [
      { id: "group-a", name: "Brunnenrunde" },
      { id: "group-b", name: "Nachbarschaft" },
    ],
    users: [{ id: "user-1", displayName: "Anton" }],
    groupMembers: { "group-a": ["user-1"], "group-b": ["user-1"] },
    groupItems: { "group-a": [], "group-b": [] },
    profiles: { "user-1": { displayName: "Anton" } },
  }
}

async function warteAufProjektion(connector: MockConnector, pruefe: (data: Record<string, unknown>) => boolean) {
  for (let versuch = 0; versuch < 50; versuch++) {
    const [projektion] = await connector.getItems({ type: "person" })
    if (projektion && pruefe(projektion.data as Record<string, unknown>)) return projektion
    await Promise.resolve()
  }
  throw new Error("Projektion hat die Erwartung nicht erreicht")
}

describe("MockConnector — Position im Profil", () => {
  it("speichert Position und Ortsnamen und zieht die Projektion sofort nach", async () => {
    const connector = new MockConnector(seed())
    connector.setCurrentGroup("group-a")
    await connector.updateMyProfile({ name: "Anton", bio: "", position: kassel, locationName: "Kassel" })

    const projektion = await warteAufProjektion(connector, (data) => data.locationName === "Kassel")
    expect(projektion.id).toBe("user-1")
    expect(projektion.data.position).toEqual(kassel)
  })

  it("zeigt dieselbe Position in jedem Space — es gibt keine je Space", async () => {
    const connector = new MockConnector(seed())
    connector.setCurrentGroup("group-a")
    await connector.updateMyProfile({ name: "Anton", position: kassel, locationName: "Kassel" })
    await warteAufProjektion(connector, (data) => data.locationName === "Kassel")

    connector.setCurrentGroup("group-b")
    const inB = await warteAufProjektion(connector, (data) => data.locationName === "Kassel")
    expect(inB.data.position).toEqual(kassel)
  })

  it("loescht sie, wenn das Ortsfeld geleert wird", async () => {
    const connector = new MockConnector(seed())
    connector.setCurrentGroup("group-a")
    await connector.updateMyProfile({ name: "Anton", position: kassel, locationName: "Kassel" })
    await warteAufProjektion(connector, (data) => data.locationName === "Kassel")

    await connector.updateMyProfile({ name: "Anton", position: undefined, locationName: undefined })
    const ohne = await warteAufProjektion(connector, (data) => data.locationName === undefined)
    expect(ohne.data.position).toBeUndefined()
  })

  it("laesst sie in Ruhe, wenn der Aufrufer sie gar nicht nennt", async () => {
    const connector = new MockConnector(seed())
    connector.setCurrentGroup("group-a")
    await connector.updateMyProfile({ name: "Anton", position: kassel, locationName: "Kassel" })
    await warteAufProjektion(connector, (data) => data.locationName === "Kassel")

    await connector.updateMyProfile({ bio: "Baut am Brunnen." })
    const weiterhin = await warteAufProjektion(connector, (data) => data.bio === "Baut am Brunnen.")
    expect(weiterhin.data.locationName).toBe("Kassel")
  })

  it("gibt das eigene Profil als person-Item zurueck", async () => {
    const connector = new MockConnector(seed())
    await connector.updateMyProfile({ name: "Anton", position: kassel, locationName: "Kassel" })
    const eigenes = await connector.getMyProfile()
    expect(eigenes!.type).toBe("person")
    expect(eigenes!.data).toMatchObject({ displayName: "Anton", locationName: "Kassel" })
    // Die Projektion traegt IMMER eine did — sie ist kein Platzhalter.
    expect(eigenes!.data.did).toBe("user-1")
  })
})

describe("MockConnector — ProfileCapable vollstaendig", () => {
  it("wird von hasProfile() erkannt — sonst blieb der Profil-Editor leer", async () => {
    const { hasProfile } = await import("@real-life-stack/data-interface")
    expect(hasProfile(new MockConnector(seed()) as never)).toBe(true)
  })
})
