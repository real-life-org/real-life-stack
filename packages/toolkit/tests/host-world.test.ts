import { describe, expect, it } from "vitest"

import { hostWorldSpace } from "../src/story-support/host-world"
import { STORY_SEED } from "../src/story-support/story-world"

/**
 * Die Story-Huelle des Hosts muss denselben Space meinen wie ihr Connector
 * (rls#423): `group` und eigene `seed.groups` gelten fuer beide.
 */
describe("hostWorldSpace", () => {
  it("nimmt ohne Angabe den Garten aus dem Grundbestand", () => {
    const { space, groups } = hostWorldSpace({})
    expect(space.id).toBe("garden")
    expect(groups).toBe(STORY_SEED.groups)
  })

  it("folgt `group` — derselbe Space wie beim Connector", () => {
    expect(hostWorldSpace({ group: "workshop" }).space.id).toBe("workshop")
  })

  it("nimmt eigene `seed.groups` und faellt bei unbekannter Gruppe auf die erste zurueck", () => {
    const groups = [{ id: "verein", name: "Verein" }]
    const ergebnis = hostWorldSpace({ seed: { groups }, group: "gibtsnicht" })
    expect(ergebnis.groups).toBe(groups)
    expect(ergebnis.space.id).toBe("verein")
  })
})
